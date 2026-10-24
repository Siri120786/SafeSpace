// reset-child-pin handler: only the child's primary caregiver can set a new
// PIN; authorisation happens before any PIN hash is read; the PIN must be
// unique in the family; failures are content-free. REAL PIN hashing,
// in-memory store standing in for the SQL functions.
// Usage: npx tsx supabase/tests/reset_child_pin_handler.test.mts

const { hashPin, verifyPin } = await import("../functions/_shared/pin.ts");
const { createResetChildPinHandler } = await import("../functions/reset-child-pin/handler.ts");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const PRIMARY = "aaaaaaaa-0000-4000-8000-00000000000a";
const CO = "bbbbbbbb-0000-4000-8000-00000000000b";
const STRANGER = "cccccccc-0000-4000-8000-00000000000c";
const KID = "11111111-1111-4111-8111-111111111111";
const SIBLING = "22222222-2222-4222-8222-222222222222";
const TOKENS: Record<string, string> = { "Bearer p": PRIMARY, "Bearer co": CO, "Bearer s": STRANGER };

async function makeWorld() {
  const pins: Record<string, string> = { [KID]: await hashPin("1111"), [SIBLING]: await hashPin("2222") };
  const versions: Record<string, number> = { [KID]: 1, [SIBLING]: 1 };
  const calls: string[] = [];
  const logs: string[] = [];
  const fail: { reset?: Error } = {};
  const handler = createResetChildPinHandler({
    store: {
      async roleFor(childId, caregiverId) {
        calls.push(`role ${caregiverId}`);
        if (!(childId in pins)) return null;
        return caregiverId === PRIMARY ? "primary" : caregiverId === CO ? "co_caregiver" : null;
      },
      async siblingPinHashes(childId) {
        calls.push("siblings");
        return Object.entries(pins).filter(([id]) => id !== childId).map(([, h]) => h);
      },
      async resetPin(childId, caregiverId, pinHash) {
        calls.push(`reset ${caregiverId}`);
        if (fail.reset) throw fail.reset;
        pins[childId] = pinHash;
        versions[childId] += 1;
      },
    },
    getUserId: async (auth) => TOKENS[auth] ?? null,
    hashPin,
    verifyPin,
    log: (e, d) => logs.push(`${e} ${d ?? ""}`),
  });
  const call = async (body: unknown, opts: { auth?: string | null; raw?: string; method?: string } = {}) => {
    const method = opts.method ?? "POST";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const auth = opts.auth === undefined ? "Bearer p" : opts.auth;
    if (auth) headers.Authorization = auth;
    const res = await handler(new Request("http://localhost/functions/v1/reset-child-pin", {
      method, headers, body: method === "POST" ? (opts.raw ?? JSON.stringify(body)) : undefined,
    }));
    const text = await res.text();
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* preflight */ }
    return { status: res.status, json: j, text };
  };
  return { call, calls, logs, fail, pins, versions };
}

{
  const w = await makeWorld();
  ok("OPTIONS is 200; GET is 405", (await w.call(null, { method: "OPTIONS" })).status === 200 && (await w.call(null, { method: "GET" })).status === 405);
  ok("no or invalid login is 401 and touches nothing",
    (await w.call({ child_id: KID, pin: "4826" }, { auth: null })).status === 401 &&
    (await w.call({ child_id: KID, pin: "4826" }, { auth: "Bearer forged" })).status === 401 && w.calls.length === 0);
  const bad = [
    await w.call(null, { raw: "{x" }),
    await w.call({ child_id: "not-a-uuid", pin: "4826" }),
    await w.call({ child_id: KID, pin: "482" }),
    await w.call({ child_id: KID, pin: 4826 }),
  ];
  ok("malformed requests are 400", bad.every((r) => r.status === 400 && r.json.error === "invalid_request"));
}
{
  const w = await makeWorld();
  const s = await w.call({ child_id: KID, pin: "4826" }, { auth: "Bearer s" });
  const c = await w.call({ child_id: KID, pin: "4826" }, { auth: "Bearer co" });
  ok("a stranger gets not_found and a co-caregiver not_primary_caregiver",
    s.status === 404 && s.json.error === "not_found" && c.status === 403 && c.json.error === "not_primary_caregiver");
  ok("neither ever gets PIN hashes read (no probing other families' PINs)", !w.calls.includes("siblings") &&
    !w.calls.some((x) => x.startsWith("reset")));
  ok("an unknown child is not_found", (await w.call({ child_id: "33333333-3333-4333-8333-333333333333", pin: "4826" })).status === 404);
}
{
  const w = await makeWorld();
  const dup = await w.call({ child_id: KID, pin: "2222" });
  ok("a PIN a sibling already uses is 409 and changes nothing",
    dup.status === 409 && dup.json.error === "pin_already_used_in_family" && w.versions[KID] === 1);
  const r = await w.call({ child_id: KID, pin: "4826" });
  ok("the primary sets a new PIN: stored only as a hash that verifies, and the session version bumps",
    r.status === 200 && r.json.ok === true && w.pins[KID].startsWith("pbkdf2$100000$") && !w.pins[KID].includes("4826") &&
    (await verifyPin("4826", w.pins[KID])) && w.versions[KID] === 2);
  ok("the child may keep their own current PIN (only siblings count)", (await w.call({ child_id: KID, pin: "4826" })).status === 200);
  ok("the caller id given to the database comes from the login, not the body",
    w.calls.filter((x) => x.startsWith("reset")).every((x) => x === `reset ${PRIMARY}`));
}
{
  const w = await makeWorld();
  w.fail.reset = Object.assign(new Error("not_primary_caregiver"), { code: "P0001" });
  ok("a database refusal maps to its code", (await w.call({ child_id: KID, pin: "4826" })).status === 403);
  w.fail.reset = Object.assign(new Error("permission denied for table children: 4826"), { code: "42501" });
  const r = await w.call({ child_id: KID, pin: "4826" });
  ok("any other failure is 500 with nothing leaked, logged by code only",
    r.status === 500 && !r.text.includes("4826") && w.logs.at(-1) === "unhandled_exception 42501");
}
