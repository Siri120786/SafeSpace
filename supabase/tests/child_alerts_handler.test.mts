// child-alerts handler: "I need help" from a signed-in child. REAL child-token
// verification, in-memory store standing in for raise_help_alert().
// Usage: npx tsx supabase/tests/child_alerts_handler.test.mts

(globalThis as any).Deno = { env: { get: (k: string) => (k === "CHILD_SESSION_SECRET" ? "alerts-test-secret" : undefined) } };
const { signChildToken, verifyChildToken } = await import("../functions/_shared/childToken.ts");
const { createChildAlertsHandler } = await import("../functions/child-alerts/handler.ts");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const KID = "11111111-1111-4111-8111-111111111111";
function makeWorld() {
  const raised: string[] = [];
  const logs: string[] = [];
  const fail = { raise: false };
  const handler = createChildAlertsHandler({
    store: {
      async raiseHelp(childId) {
        if (fail.raise) throw Object.assign(new Error("db down: I need help"), { code: "PGRST301" });
        raised.push(childId);
        return "alert-1";
      },
    },
    verifyChildToken,
    log: (e, d) => logs.push(`${e} ${d ?? ""}`),
  });
  const call = async (body: unknown, opts: { raw?: string; method?: string } = {}) => {
    const method = opts.method ?? "POST";
    const res = await handler(new Request("http://localhost/functions/v1/child-alerts", {
      method, headers: { "Content-Type": "application/json" },
      body: method === "POST" ? (opts.raw ?? JSON.stringify(body)) : undefined,
    }));
    const text = await res.text();
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* preflight */ }
    return { status: res.status, json: j, text };
  };
  return { call, raised, logs, fail };
}

const tok = await signChildToken(KID);
{
  const w = makeWorld();
  ok("OPTIONS is 200; GET is 405", (await w.call(null, { method: "OPTIONS" })).status === 200 && (await w.call(null, { method: "GET" })).status === 405);
  ok("bad JSON 400, unknown action 400, missing token 401",
    (await w.call(null, { raw: "{x" })).status === 400 &&
    (await w.call({ action: "call_police", child_session_token: tok })).json.error === "invalid_action" &&
    (await w.call({ action: "raise_help" })).status === 401);
  ok("a tampered token is 401 and raises nothing",
    (await w.call({ action: "raise_help", child_session_token: `${tok.split(".")[0]}.AAAA` })).status === 401 && w.raised.length === 0);
  const r = await w.call({ action: "raise_help", child_session_token: tok });
  ok("'I need help' raises an alert for the token's own child", r.status === 200 && r.json.alertId === "alert-1" && w.raised.join() === KID);
}
{
  const w = makeWorld();
  w.fail.raise = true;
  const r = await w.call({ action: "raise_help", child_session_token: tok });
  ok("a store failure is 500 with nothing leaked, logged by code only",
    r.status === 500 && !r.text.includes("db down") && w.logs.length === 1 && w.logs[0] === "unhandled_exception PGRST301");
}
