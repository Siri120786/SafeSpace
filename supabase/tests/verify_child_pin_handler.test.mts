// verify-child-pin handler: input validation, the 5-failures-per-15-minutes
// family limit, the same answer for unknown families and wrong PINs, and
// fail-closed behaviour on every store error. Uses the REAL PIN hashing and
// child-session token code with an in-memory store that mirrors
// pin_attempt_begin / pin_attempt_succeeded (migration 20261026100000).
// Usage: npx tsx supabase/tests/verify_child_pin_handler.test.mts

(globalThis as any).Deno = { env: { get: (k: string) => (k === "CHILD_SESSION_SECRET" ? "pin-test-secret" : undefined) } };
const { hashPin, verifyPin } = await import("../functions/_shared/pin.ts");
const { signChildToken, verifyChildToken, readChildToken } = await import("../functions/_shared/childToken.ts");
const { createVerifyChildPinHandler } = await import("../functions/verify-child-pin/handler.ts");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const KID_A = "11111111-1111-4111-8111-111111111111";
const KID_B = "22222222-2222-4222-8222-222222222222";
const KID_OTHER = "33333333-3333-4333-8333-333333333333";
const families: Record<string, { id: string; pin_hash: string }[]> = {
  AB12CD: [{ id: KID_A, pin_hash: await hashPin("4826") }, { id: KID_B, pin_hash: await hashPin("5937"), session_version: 3 }],
  EF34AB: [{ id: KID_OTHER, pin_hash: await hashPin("4826") }],
};

const WINDOW_MS = 15 * 60_000;
function makeWorld() {
  let clock = Date.parse("2026-10-24T10:00:00Z");
  const attempts: { id: number; code: string; succeeded: boolean; at: number }[] = [];
  const calls: string[] = [];
  const logs: string[] = [];
  const fail = { begin: false, list: false, mark: false };
  const handler = createVerifyChildPinHandler({
    store: {
      async beginAttempt(code) {
        calls.push(`begin ${code}`);
        if (fail.begin) throw Object.assign(new Error("db down for AB12CD"), { code: "PGRST301" });
        const failed = attempts.filter((a) => a.code === code && !a.succeeded && a.at > clock - WINDOW_MS).length;
        if (failed >= 5) return null;
        attempts.push({ id: attempts.length + 1, code, succeeded: false, at: clock });
        return attempts.length;
      },
      async listFamilyChildren(code) {
        calls.push(`list ${code}`);
        if (fail.list) throw Object.assign(new Error("permission denied for table children"), { code: "42501" });
        return families[code] ?? [];
      },
      async markSucceeded(id) {
        calls.push(`mark ${id}`);
        if (fail.mark) throw Object.assign(new Error("rpc failed"), { code: "attempt_not_marked" });
        attempts[id - 1].succeeded = true;
      },
    },
    verifyPin,
    signChildToken,
    log: (e, d) => logs.push(`${e} ${d ?? ""}`),
  });
  const call = async (body: unknown, opts: { raw?: string; method?: string } = {}) => {
    const method = opts.method ?? "POST";
    const res = await handler(new Request("http://localhost/functions/v1/verify-child-pin", {
      method, headers: { "Content-Type": "application/json" },
      body: method === "POST" ? (opts.raw ?? JSON.stringify(body)) : undefined,
    }));
    const text = await res.text();
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* preflight */ }
    return { status: res.status, json: j, text };
  };
  const failures = (code: string) => attempts.filter((a) => a.code === code && !a.succeeded && a.at > clock - WINDOW_MS).length;
  return { call, calls, logs, fail, attempts, failures, advance: (ms: number) => { clock += ms; } };
}

// ---------------------------------------------------------------------------
// Validation (never counts as an attempt)
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  ok("OPTIONS preflight is 200; GET is 405",
    (await w.call(null, { method: "OPTIONS" })).status === 200 && (await w.call(null, { method: "GET" })).status === 405);
  const bad = [
    await w.call(null, { raw: "{not json" }),
    await w.call({ family_code: "AB12CD" }),
    await w.call({ family_code: "AB12CD", pin: "482" }),
    await w.call({ family_code: "AB12CD", pin: 4826 }),
    await w.call({ family_code: 12, pin: "4826" }),
    await w.call({ family_code: "   ", pin: "4826" }),
    await w.call({ family_code: "AB-12'CD", pin: "4826" }),
  ];
  ok("malformed requests are 400 invalid_request", bad.every((r) => r.status === 400 && r.json.error === "invalid_request"));
  ok("oversized body is 413", (await w.call(null, { raw: JSON.stringify({ family_code: "AB12CD", pin: "4826", x: "y".repeat(2000) }) })).status === 413);
  ok("invalid requests reserve no attempt and touch no data", w.attempts.length === 0 && w.calls.length === 0);
}

// ---------------------------------------------------------------------------
// Sign-in
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  const r = await w.call({ family_code: " ab12cd ", pin: "5937" });
  ok("correct PIN returns a token for the matching child (code trimmed and upper-cased)",
    r.status === 200 && r.json.child_id === KID_B && (await verifyChildToken(r.json.child_session_token)) === KID_B);
  ok("the token carries the child's current session version (role flow M3)", (await readChildToken(r.json.child_session_token))?.sessionVersion === 3);
  ok("a successful attempt is marked succeeded and doesn't count as a failure",
    w.attempts.length === 1 && w.attempts[0].succeeded && w.failures("AB12CD") === 0);
  ok("the PIN only matches within its own family",
    (await w.call({ family_code: "EF34AB", pin: "4826" })).json.child_id === KID_OTHER);

  const wrong = await w.call({ family_code: "AB12CD", pin: "0000" });
  const unknown = await w.call({ family_code: "ZZ99ZZ", pin: "4826" });
  ok("wrong PIN and unknown family get the identical 401 response",
    wrong.status === 401 && unknown.status === 401 && wrong.text === unknown.text && wrong.json.error === "invalid_credentials");
  ok("both are counted as failures for their family code", w.failures("AB12CD") === 1 && w.failures("ZZ99ZZ") === 1);
  ok("no token in any failure response", !wrong.text.includes("token") && !unknown.text.includes("token"));
}

// ---------------------------------------------------------------------------
// Rate limit: 5 failures per family per 15 minutes
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  for (let i = 0; i < 5; i++) await w.call({ family_code: "AB12CD", pin: `000${i}` });
  w.calls.length = 0;
  const sixth = await w.call({ family_code: "AB12CD", pin: "4826" });
  ok("after 5 failures, even the correct PIN gets 429 too_many_attempts",
    sixth.status === 429 && sixth.json.error === "too_many_attempts" && !sixth.text.includes("token"));
  ok("a limited request never reads the family's PIN hashes", w.calls.join() === "begin AB12CD");
  ok("other families are unaffected", (await w.call({ family_code: "EF34AB", pin: "4826" })).status === 200);
  w.advance(14 * 60_000);
  ok("still limited 14 minutes later", (await w.call({ family_code: "AB12CD", pin: "4826" })).status === 429);
  w.advance(60_000 + 1);
  ok("allowed again once the failures are older than 15 minutes",
    (await w.call({ family_code: "AB12CD", pin: "4826" })).status === 200);
}
{
  const w = makeWorld();
  for (let i = 0; i < 4; i++) await w.call({ family_code: "AB12CD", pin: `000${i}` });
  await w.call({ family_code: "AB12CD", pin: "4826" });
  ok("a success doesn't wipe earlier failures (4 failures + 1 success)", w.failures("AB12CD") === 4);
  await w.call({ family_code: "AB12CD", pin: "0009" });
  ok("the 5th failure is still allowed, then the family is limited",
    w.failures("AB12CD") === 5 && (await w.call({ family_code: "AB12CD", pin: "4826" })).status === 429);
  ok("a limited request reserves nothing", w.attempts.length === 6);
}

// ---------------------------------------------------------------------------
// Fail closed
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  w.fail.begin = true;
  const r = await w.call({ family_code: "AB12CD", pin: "4826" });
  ok("if the attempt can't be reserved: 500, no token, PIN hashes never read",
    r.status === 500 && r.json.error === "internal_error" && !r.text.includes("token") && w.calls.join() === "begin AB12CD");
  ok("logged with the error code only", w.logs.length === 1 && w.logs[0] === "unhandled_exception PGRST301");
}
{
  const w = makeWorld();
  w.fail.list = true;
  const r = await w.call({ family_code: "AB12CD", pin: "4826" });
  ok("if the family lookup fails: 500, no token, and the attempt stays counted as a failure",
    r.status === 500 && !r.text.includes("token") && w.failures("AB12CD") === 1);
  ok("the error text isn't leaked or logged", !r.text.includes("permission") && w.logs[0] === "unhandled_exception 42501");
}
{
  const w = makeWorld();
  w.fail.mark = true;
  const r = await w.call({ family_code: "AB12CD", pin: "4826" });
  ok("if the success can't be recorded: 500 and NO token (the attempt stays a failure)",
    r.status === 500 && !r.text.includes("token") && w.failures("AB12CD") === 1);
}
