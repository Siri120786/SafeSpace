// safety-check and emergency-escalation Edge Functions, the shared check
// (_shared/safety.ts) and the journal function's safety hook, run under Node
// with fakes and the REAL child-token verifier.
// Usage: npx tsx supabase/tests/safety_functions_handler.test.mts

(globalThis as any).Deno = { env: { get: (k: string) => (k === "CHILD_SESSION_SECRET" ? "safety-test-secret" : undefined) } };
const { signChildToken, verifyChildToken } = await import("../functions/_shared/childToken.ts");
const { safetyCheck, escalateChildText, CHILD_ALERT_NOTICE } = await import("../functions/_shared/safety.ts");
const { createSafetyCheckHandler } = await import("../functions/safety-check/handler.ts");
const { createEscalationHandler } = await import("../functions/emergency-escalation/handler.ts");
const { createJournalHandler } = await import("../functions/journal/handler.ts");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const CHILD = "11111111-1111-4111-8111-111111111111";
const token = await signChildToken(CHILD);
const CRISIS = "I want to die";

async function send(handler: (r: Request) => Promise<Response>, body: unknown, opts: { raw?: string; method?: string; auth?: string } = {}) {
  const method = opts.method ?? "POST";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth) headers.Authorization = opts.auth;
  const res = await handler(new Request("http://localhost/functions/v1/x", {
    method, headers, body: method === "POST" ? (opts.raw ?? JSON.stringify(body)) : undefined,
  }));
  const text = await res.text();
  let j: any = null;
  try { j = JSON.parse(text); } catch { /* preflight */ }
  return { status: res.status, json: j };
}

// ---- The shared check --------------------------------------------------------
ok("the check matches crisis words (English and Hindi)", safetyCheck(CRISIS) && safetyCheck("मैं आत्महत्या के बारे में सोच रहा हूँ"));
ok("the check ignores ordinary text and non-strings", !safetyCheck("I had a tiring day at school") && !safetyCheck("") && !safetyCheck(null) && !safetyCheck(42));
{
  const raised: string[] = [];
  const none = await escalateChildText("a calm day", CHILD, "journal_flag", async (_c, s) => { raised.push(s); return "a"; }, () => {});
  ok("no crisis words: nothing raised, no notice", none === null && raised.length === 0);
  const hit = await escalateChildText(CRISIS, CHILD, "journal_flag", async (_c, s) => { raised.push(s); return "a"; }, () => {});
  ok("crisis words: alert raised, message with 112 and 14416, gentle notice",
    raised.join() === "journal_flag" && !!hit && hit.caregiverAlerted && /112/.test(hit.message) && /14416/.test(hit.message) &&
    hit.notice === CHILD_ALERT_NOTICE);
}

// ---- safety-check ------------------------------------------------------------
{
  const logs: string[] = [];
  const h = createSafetyCheckHandler({
    verifyChildToken,
    authenticateAdult: async (a: string) => (a === "Bearer good-jwt" ? "adult" : null),
    log: (e: string) => logs.push(e),
  });
  ok("safety-check: OPTIONS is 200, GET is 405", (await send(h, null, { method: "OPTIONS" })).status === 200 && (await send(h, null, { method: "GET" })).status === 405);
  const c = await send(h, { action: "check", text: CRISIS, child_session_token: token });
  ok("safety-check: a child's crisis text gets the message and helplines", c.status === 200 && c.json.crisis === true && /14416/.test(c.json.safetyMessage) && c.json.resources.length === 2);
  const a = await send(h, { text: "lovely walk today" }, { auth: "Bearer good-jwt" });
  ok("safety-check: ordinary text is not a crisis", a.status === 200 && a.json.crisis === false && a.json.safetyMessage === null && a.json.resources.length === 0);
  ok("safety-check: needs a signed-in person", (await send(h, { text: CRISIS })).status === 401 && (await send(h, { text: CRISIS }, { auth: "Bearer bad" })).status === 401 &&
    (await send(h, { text: CRISIS, child_session_token: "x.y" })).status === 401);
  ok("safety-check: bad input is 400", (await send(h, { text: 5 }, { auth: "Bearer good-jwt" })).status === 400 &&
    (await send(h, { text: "x".repeat(5001) }, { auth: "Bearer good-jwt" })).status === 400 &&
    (await send(h, { action: "raise", text: "x" }, { auth: "Bearer good-jwt" })).status === 400 &&
    (await send(h, null, { raw: "{", auth: "Bearer good-jwt" })).status === 400);
}

// ---- emergency-escalation ------------------------------------------------------
function escalationWorld() {
  const raised: { childId: string; source: string }[] = [];
  const logs: string[] = [];
  const cfg = { fail: false };
  const h = createEscalationHandler({
    verifyChildToken,
    async raiseSafetyAlert(childId: string, source: string) {
      raised.push({ childId, source });
      if (cfg.fail) throw Object.assign(new Error("rpc failed"), { code: "XX000" });
      return "alert-1";
    },
    log: (e: string, d?: string) => logs.push(`${e} ${d ?? ""}`),
  });
  return { h, raised, logs, cfg };
}
{
  const w = escalationWorld();
  const r = await send(w.h, { action: "escalate", child_session_token: token, source: "mood", text: CRISIS, child_id: "22222222-2222-4222-8222-222222222222" });
  ok("escalation: crisis text alerts the token's child, from the right source",
    r.status === 200 && r.json.escalated === true && w.raised.length === 1 && w.raised[0].childId === CHILD && w.raised[0].source === "check_in");
  ok("escalation: the child gets the message, helplines and the gentle notice",
    /14416/.test(r.json.safety.message) && r.json.safety.notice === CHILD_ALERT_NOTICE && r.json.resources.length === 2);
  const calm = await send(w.h, { child_session_token: token, source: "journal", text: "Played football" });
  ok("escalation: the server decides; ordinary text raises nothing", calm.status === 200 && calm.json.escalated === false && calm.json.safety === null && w.raised.length === 1);
  for (const [src, expected] of [["companion", "companion_flag"], ["journal", "journal_flag"]]) {
    await send(w.h, { child_session_token: token, source: src, text: CRISIS });
    ok(`escalation: '${src}' maps to ${expected}`, w.raised.at(-1)!.source === expected);
  }
}
{
  const w = escalationWorld();
  ok("escalation: children only (no token is 401, adult JWT doesn't count)",
    (await send(w.h, { source: "journal", text: CRISIS }, { auth: "Bearer good-jwt" })).status === 401 &&
    (await send(w.h, { source: "journal", text: CRISIS, child_session_token: "x.y" })).status === 401 && w.raised.length === 0);
  ok("escalation: help sources and unknown sources are refused",
    (await send(w.h, { child_session_token: token, source: "aac_tap", text: CRISIS })).status === 400 &&
    (await send(w.h, { child_session_token: token, source: "__proto__", text: CRISIS })).status === 400 && w.raised.length === 0);
  ok("escalation: bad text is 400", (await send(w.h, { child_session_token: token, source: "journal" })).status === 400 &&
    (await send(w.h, { child_session_token: token, source: "journal", text: "x".repeat(5001) })).status === 400);
  w.cfg.fail = true;
  const r = await send(w.h, { child_session_token: token, source: "journal", text: CRISIS });
  ok("escalation: a failed alert still returns the message and helplines, not alerted",
    r.status === 200 && r.json.escalated === false && /14416/.test(r.json.safety.message) && r.json.safety.notice === null && r.json.resources.length === 2);
  ok("escalation: the failure is logged by code, without the words", w.logs.some((l) => l.startsWith("safety_alert_failed") && l.includes("XX000")) &&
    !w.logs.join(" ").includes("want to die"));
}

// ---- The journal function's hook -----------------------------------------------
{
  const raised: string[] = [];
  const saved: string[] = [];
  const h = createJournalHandler({
    store: {
      async createEntry(row: any) {
        saved.push(row.content);
        return { id: "e1", profile_id: null, child_id: row.child_id, module_key: null, entry_type: row.entry_type, content: row.content,
          is_private_note: false, created_at: "2026-10-26T00:00:00Z", updated_at: "2026-10-26T00:00:00Z" };
      },
      async listEntries() { return []; },
    },
    verifyChildToken,
    log: () => {},
    async raiseSafetyAlert(_c: string, source: string) { raised.push(source); return "a"; },
  });
  const r = await send(h, { action: "create", child_session_token: token, content: CRISIS });
  ok("journal: a crisis entry is saved, alerts from the journal, and tells the child",
    r.status === 200 && saved.length === 1 && raised.join() === "journal_flag" && r.json.entry.content === CRISIS &&
    r.json.safety?.caregiverAlerted === true && r.json.safety?.notice === CHILD_ALERT_NOTICE);
  const calm = await send(h, { action: "create", child_session_token: token, content: "We baked a cake" });
  ok("journal: an ordinary entry has no safety notice and raises nothing", calm.status === 200 && calm.json.safety === null && raised.length === 1);
}
