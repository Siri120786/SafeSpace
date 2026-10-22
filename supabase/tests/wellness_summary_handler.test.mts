// Sprint 3: child `wellness-summary` Edge Function handler, run under Node
// with a fake store and the REAL child-token verifier.
// Usage: npx tsx supabase/tests/wellness_summary_handler.test.mts

(globalThis as any).Deno = { env: { get: (k: string) => (k === "CHILD_SESSION_SECRET" ? "wellness-test-secret" : undefined) } };
const { signChildToken, verifyChildToken } = await import("../functions/_shared/childToken.ts");
const { createWellnessSummaryHandler } = await import("../functions/wellness-summary/handler.ts");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const CHILD = "11111111-1111-4111-8111-111111111111";
function makeWorld() {
  const calls: { childId: string; to: string; days: number; tz: string }[] = [];
  const logs: string[] = [];
  const cfg = { mode: "ok" as "ok" | "invalid" | "fail" };
  const handler = createWellnessSummaryHandler({
    store: {
      async summaryForChild(childId: string, to: string, days: 7 | 30, tz: string) {
        calls.push({ childId, to, days, tz });
        if (cfg.mode === "invalid") throw new Error("invalid_input");
        if (cfg.mode === "fail") throw Object.assign(new Error("db down"), { code: "PGRST301" });
        return { periodDays: days, to, mood: { checkins: 2 } };
      },
    },
    verifyChildToken,
    log: (e: string, d?: string) => logs.push(`${e} ${d ?? ""}`),
  });
  const call = async (body: unknown, opts: { raw?: string; method?: string } = {}) => {
    const method = opts.method ?? "POST";
    const res = await handler(new Request("http://localhost/functions/v1/wellness-summary", {
      method, headers: { "Content-Type": "application/json" },
      body: method === "POST" ? (opts.raw ?? JSON.stringify(body)) : undefined,
    }));
    const text = await res.text();
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* preflight */ }
    return { status: res.status, json: j, text };
  };
  return { call, calls, logs, cfg };
}

const token = await signChildToken(CHILD);
const good = { action: "get", period_days: 7, to: "2026-10-24", timezone: "Asia/Kolkata", child_session_token: token };
{
  const w = makeWorld();
  ok("OPTIONS preflight is 200 before any work", (await w.call(null, { method: "OPTIONS" })).status === 200 && w.calls.length === 0);
  ok("GET is 405", (await w.call(null, { method: "GET" })).status === 405);
  const r = await w.call(good);
  ok("child gets their own summary; child_id comes from the token",
    r.status === 200 && r.json.summary.mood.checkins === 2 && w.calls[0].childId === CHILD &&
    w.calls[0].days === 7 && w.calls[0].tz === "Asia/Kolkata" && w.calls[0].to === "2026-10-24");
  ok("a child_id in the body is ignored (owner always from the token)",
    (await w.call({ ...good, child_id: "22222222-2222-4222-8222-222222222222" })).status === 200 && w.calls[1].childId === CHILD);
}
{
  const w = makeWorld();
  const bad = [
    { ...good, period_days: 14 }, { ...good, period_days: "7" }, { ...good, to: "24-10-2026" },
    { ...good, to: "2026-02-30" }, { ...good, timezone: "" }, { ...good, timezone: "Asia/Kolkata; drop table" },
  ];
  let all400 = true;
  for (const b of bad) all400 &&= (await w.call(b)).status === 400;
  ok("invalid period, date or timezone is 400 before any database work", all400 && w.calls.length === 0);
  ok("unknown action is 400", (await w.call({ ...good, action: "reset" })).json.error === "invalid_action");
  ok("missing token is 401; tampered or malformed token is 401",
    (await w.call({ ...good, child_session_token: undefined })).status === 401 &&
    (await w.call({ ...good, child_session_token: `${token.split(".")[0]}.AAAA` })).status === 401 &&
    (await w.call({ ...good, child_session_token: "abc.%%%" })).status === 401 && w.calls.length === 0);
  ok("malformed JSON 400, oversized body 413",
    (await w.call(null, { raw: "{" })).status === 400 && (await w.call(null, { raw: "x".repeat(3000) })).status === 413);
}
{
  const w = makeWorld();
  w.cfg.mode = "invalid";
  ok("a timezone the database doesn't know is 400 invalid_input", (await w.call({ ...good, timezone: "Mars/Olympus" })).json.error === "invalid_input");
  w.cfg.mode = "fail";
  const r = await w.call(good);
  ok("store failure is 500 with no details, logged with a code only",
    r.status === 500 && r.json.error === "internal_error" && !r.text.includes("db down") &&
    w.logs.length === 1 && w.logs[0] === "unhandled_exception PGRST301");
}
