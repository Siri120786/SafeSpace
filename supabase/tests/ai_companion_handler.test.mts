// Handler-level tests for the ai-companion Edge Function (supabase/functions/
// ai-companion/handler.ts), run under Node with injected fakes: an in-memory
// store, a fake Supabase Auth check and a fake model. Child tokens use the REAL
// verifier (_shared/childToken.ts) with a test secret. No network, database
// or model calls. Usage: npx tsx supabase/tests/ai_companion_handler.test.mts

(globalThis as any).Deno = { env: { get: (k: string) => (k === "CHILD_SESSION_SECRET" ? "handler-test-secret" : undefined) } };
const { signChildToken, verifyChildToken } = await import("../functions/_shared/childToken.ts");
const { createAiCompanionHandler } = await import("../functions/ai-companion/handler.ts");
const { MAX_BODY_BYTES, RATE_LIMIT_PER_MINUTE } = await import("../functions/_shared/aiCompanion.ts");
type Owner = { column: "profile_id" | "child_id"; id: string };

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------
const ADULT_A = "11111111-1111-4111-8111-111111111111";
const ADULT_B = "22222222-2222-4222-8222-222222222222";
const CHILD_C = "33333333-3333-4333-8333-333333333333";
const ADULT_TOKENS: Record<string, string> = { "Bearer token-a": ADULT_A, "Bearer token-b": ADULT_B };
const CRISIS = "I want to hurt myself";

function makeWorld() {
  const conversations: any[] = [];
  const messages: any[] = [];
  const calls: string[] = [];
  const logs: string[] = [];
  const modelCalls: { systemPrompt: string; history: { sender: string; content: string }[] }[] = [];
  const slotCalls: { owner: Owner; limit: number; window: number }[] = [];
  const cfg = {
    slot: "allow" as "allow" | "limit" | "throw",
    model: "Here is a calm reply." as string | null | "throw",
    failList: false,
    failInsert: false,
    alert: "ok" as "ok" | "throw",
  };
  const alerts: { childId: string; source: string }[] = [];
  let t = 1_700_000_000_000;
  const owns = (o: Owner, c: any) => c[o.column] === o.id;
  const store = {
    async listConversations(o: Owner, limit: number) {
      calls.push("listConversations");
      if (cfg.failList) throw Object.assign(new Error(`relation broke near "${CRISIS}"`), { code: "XX000" });
      return conversations.filter((c) => owns(o, c)).slice(0, limit);
    },
    async getOwnedConversation(o: Owner, id: string) {
      calls.push("getOwnedConversation");
      return conversations.find((c) => c.id === id && owns(o, c)) ?? null;
    },
    async listMessages(id: string) {
      calls.push("listMessages");
      return messages.filter((m) => m.conversation_id === id);
    },
    async recentHistory(id: string, limit: number) {
      calls.push("recentHistory");
      return messages.filter((m) => m.conversation_id === id).slice(-limit).map((m) => ({ sender: m.sender, content: m.content }));
    },
    async takeRateLimitSlot(o: Owner, limit: number, window: number) {
      calls.push("takeRateLimitSlot");
      slotCalls.push({ owner: o, limit, window });
      if (cfg.slot === "throw") throw Object.assign(new Error("connection refused"), { code: "PGRST000" });
      return cfg.slot === "allow";
    },
    async createConversation(o: Owner, title: string, language: string) {
      calls.push("createConversation");
      const row = { id: crypto.randomUUID(), profile_id: o.column === "profile_id" ? o.id : null,
        child_id: o.column === "child_id" ? o.id : null, title, language,
        created_at: new Date(t).toISOString(), updated_at: new Date(t).toISOString() };
      conversations.push(row);
      return row;
    },
    async insertMessages(rows: any[]) {
      calls.push("insertMessages");
      if (cfg.failInsert) throw Object.assign(new Error("insert failed"), { code: "23514" });
      const stored = rows.map((r) => ({ id: crypto.randomUUID(), ...r }));
      messages.push(...stored);
      return stored;
    },
    async touchConversation(id: string, language: string) {
      calls.push("touchConversation");
      const c = conversations.find((x) => x.id === id);
      if (c) Object.assign(c, { language, updated_at: new Date(++t).toISOString() });
      return c ?? null;
    },
  };
  const authCalls: string[] = [];
  const handler = createAiCompanionHandler({
    store,
    async authenticateAdult(h: string) { authCalls.push(h); return ADULT_TOKENS[h] ?? null; },
    verifyChildToken,
    async askModel(systemPrompt: string, history: any[]) {
      calls.push("askModel");
      modelCalls.push({ systemPrompt, history: history.map((h) => ({ ...h })) });
      if (cfg.model === "throw") throw new Error(`model exploded on "${history.at(-1)?.content}"`);
      return cfg.model;
    },
    log: (event: string, detail?: string) => logs.push(`${event} ${detail ?? ""}`),
    now: () => (t += 10),
    async raiseSafetyAlert(childId: string, source: string) {
      alerts.push({ childId, source });
      if (cfg.alert === "throw") throw Object.assign(new Error(`rpc failed near "${CRISIS}"`), { code: "XX000" });
      return "alert-1";
    },
  });
  async function call(body: unknown, opts: { auth?: string; raw?: string; method?: string; headers?: Record<string, string> } = {}) {
    const init: RequestInit = { method: opts.method ?? "POST", headers: { "Content-Type": "application/json", ...(opts.auth ? { Authorization: opts.auth } : {}), ...(opts.headers ?? {}) } };
    if (init.method !== "GET" && init.method !== "OPTIONS") init.body = opts.raw ?? JSON.stringify(body);
    const res = await handler(new Request("http://localhost/functions/v1/ai-companion", init));
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* preflight body is "ok" */ }
    return { status: res.status, json, text, cors: res.headers.get("Access-Control-Allow-Origin") };
  }
  const seedConversation = (o: Owner, title = "seeded") => store.createConversation(o, title, "en");
  const seedMessage = (convId: string, sender: "user" | "assistant", content: string) =>
    messages.push({ id: crypto.randomUUID(), conversation_id: convId, sender, content, detected_language: "en", is_safety_response: false, created_at: new Date(t += 10).toISOString() });
  return { cfg, call, calls, logs, modelCalls, slotCalls, authCalls, conversations, messages, seedConversation, seedMessage, alerts };
}
const A = { auth: "Bearer token-a" };
const B = { auth: "Bearer token-b" };
const childToken = await signChildToken(CHILD_C);
const asChild = (body: Record<string, unknown>) => ({ ...body, child_session_token: childToken });

// ---------------------------------------------------------------------------
// CORS and method
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  const pre = await w.call(null, { method: "OPTIONS" });
  ok("OPTIONS preflight returns 200 with CORS headers before any auth or store work",
    pre.status === 200 && pre.cors === "*" && w.calls.length === 0 && w.authCalls.length === 0);
  const get = await w.call(null, { method: "GET" });
  ok("GET is 405 and still carries CORS headers", get.status === 405 && get.cors === "*");
  const unauth = await w.call({ action: "list_conversations" });
  ok("error responses (401) carry CORS headers", unauth.status === 401 && unauth.cors === "*");
}

// ---------------------------------------------------------------------------
// Malformed input: rejected before identity, store or model work
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  const cases: [string, Parameters<typeof w.call>, number, string][] = [
    ["invalid JSON", [null, { ...A, raw: "{oops" }], 400, "invalid_request"],
    ["empty body", [null, { ...A, raw: "" }], 400, "invalid_request"],
    ["null body", [null, A], 400, "invalid_request"],
    ["array body", [[1, 2], A], 400, "invalid_request"],
    ["unknown action", [{ action: "drop_tables" }, A], 400, "invalid_action"],
    ["non-UUID conversation_id", [{ action: "get_messages", conversation_id: "abc" }, A], 400, "invalid_conversation_id"],
    ["get_messages without conversation_id", [{ action: "get_messages" }, A], 400, "missing_conversation_id"],
    ["unsupported language", [{ content: "hi", language: "fr" }, A], 400, "invalid_language"],
    ["non-string child token", [{ action: "list_conversations", child_session_token: 42 }, {}], 401, "invalid_session"],
    ["declared oversized body", [{ content: "hi" }, { ...A, headers: { "Content-Length": String(MAX_BODY_BYTES + 1) } }], 413, "payload_too_large"],
    ["actual oversized body", [{ content: "a".repeat(MAX_BODY_BYTES) }, A], 413, "payload_too_large"],
  ];
  for (const [name, args, status, error] of cases) {
    const before = w.calls.length + w.authCalls.length;
    const r = await w.call(...args);
    ok(`malformed: ${name} -> ${status} ${error}, no auth/store/model work`,
      r.status === status && r.json?.error === error && w.calls.length + w.authCalls.length === before);
  }
  const empty = await w.call({ content: "   " }, A);
  const long = await w.call({ content: "a".repeat(2001) }, A);
  ok("empty and over-length messages are 400 with no slot, model or writes",
    empty.status === 400 && empty.json.error === "missing_message_content" &&
    long.status === 400 && long.json.error === "message_too_long" &&
    !w.calls.some((c) => ["takeRateLimitSlot", "askModel", "createConversation", "insertMessages"].includes(c)));
}

// ---------------------------------------------------------------------------
// Authentication (adult via Supabase Auth, child via the real token verifier)
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  const none = await w.call({ action: "list_conversations" });
  ok("no Authorization header and no child token -> 401, auth not attempted",
    none.status === 401 && none.json.error === "unauthorized" && w.authCalls.length === 0);
  ok("invalid adult token -> 401", (await w.call({ action: "list_conversations" }, { auth: "Bearer forged" })).status === 401);
  const [payload] = childToken.split(".");
  const tampered = await w.call({ action: "list_conversations", child_session_token: `${payload}.AAAA` });
  const malformed = await w.call({ action: "list_conversations", child_session_token: "abc.%%%" });
  const forgedOwner = Buffer.from(JSON.stringify({ child_id: ADULT_A, exp: 9999999999 })).toString("base64url");
  const swapped = await w.call({ action: "list_conversations", child_session_token: `${forgedOwner}.${childToken.split(".")[1]}` });
  ok("tampered, malformed and payload-swapped child tokens -> 401, never 500",
    tampered.status === 401 && malformed.status === 401 && swapped.status === 401);
  ok("rejected identities never reach the store", w.calls.length === 0);
}

// ---------------------------------------------------------------------------
// Ownership: adults and children only ever see their own conversations
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  const convA = await w.seedConversation({ column: "profile_id", id: ADULT_A }, "A's chat");
  const convB = await w.seedConversation({ column: "profile_id", id: ADULT_B }, "B's chat");
  const convC = await w.seedConversation({ column: "child_id", id: CHILD_C }, "child's chat");
  w.seedMessage(convA.id, "user", "A private");
  w.seedMessage(convB.id, "user", "B private");

  const listA = await w.call({ action: "list_conversations" }, A);
  ok("adult lists only their own conversations",
    listA.status === 200 && listA.json.conversations.length === 1 && listA.json.conversations[0].title === "A's chat");
  const listC = await w.call(asChild({ action: "list_conversations" }));
  ok("child lists only their own conversations",
    listC.status === 200 && listC.json.conversations.length === 1 && listC.json.conversations[0].childId === CHILD_C);

  const own = await w.call({ action: "get_messages", conversation_id: convA.id }, A);
  ok("owner reads their messages (camelCase contract with isSafetyResponse)",
    own.status === 200 && own.json.messages.length === 1 && own.json.messages[0].content === "A private" &&
    own.json.messages[0].conversationId === convA.id && own.json.messages[0].isSafetyResponse === false);

  const probes = [
    await w.call({ action: "get_messages", conversation_id: convB.id }, A),
    await w.call({ action: "get_messages", conversation_id: convC.id }, A),
    await w.call(asChild({ action: "get_messages", conversation_id: convA.id })),
    await w.call({ action: "get_messages", conversation_id: crypto.randomUUID() }, A),
  ];
  ok("another adult's, a child's, an adult's (as child) and an unknown conversation all look identical: 404",
    probes.every((r) => r.status === 404 && r.json.error === "conversation_not_found") &&
    !probes.some((r) => r.text.includes("private")));

  const before = w.messages.length;
  const writeIntoB = await w.call({ content: "hello", conversation_id: convB.id }, A);
  ok("sending into someone else's conversation -> 404 with no slot, model call or writes",
    writeIntoB.status === 404 && w.messages.length === before &&
    !w.calls.includes("takeRateLimitSlot") && !w.calls.includes("askModel"));
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  await w.call({ content: "I had a long day" }, A);
  ok("slot is taken with limit 10 per 60 s for the adult's own identity",
    w.slotCalls.length === 1 && w.slotCalls[0].limit === RATE_LIMIT_PER_MINUTE && RATE_LIMIT_PER_MINUTE === 10 &&
    w.slotCalls[0].window === 60 && w.slotCalls[0].owner.column === "profile_id" && w.slotCalls[0].owner.id === ADULT_A);
  ok("slot is taken BEFORE the model is called",
    w.calls.indexOf("takeRateLimitSlot") > -1 && w.calls.indexOf("takeRateLimitSlot") < w.calls.indexOf("askModel"));
  await w.call(asChild({ content: "school was hard" }));
  ok("a child's slot uses the child identity, separate from adults",
    w.slotCalls[1].owner.column === "child_id" && w.slotCalls[1].owner.id === CHILD_C);
}
{
  const w = makeWorld();
  w.cfg.slot = "limit";
  const r = await w.call({ content: "one more message" }, A);
  ok("over the limit -> 429 rate_limited, model not called, nothing stored",
    r.status === 429 && r.json.error === "rate_limited" && !w.calls.includes("askModel") &&
    w.conversations.length === 0 && w.messages.length === 0);
}
{
  const w = makeWorld();
  w.cfg.slot = "throw";
  const r = await w.call({ content: "is anyone there" }, A);
  ok("rate-limit check failure fails CLOSED -> 503 rate_limit_unavailable, model not called, nothing stored",
    r.status === 503 && r.json.error === "rate_limit_unavailable" && !w.calls.includes("askModel") && w.messages.length === 0);
  ok("rate-limit failure is logged with a code only", w.logs.some((l) => l === "rate_limit_slot_failed PGRST000"));
}
{
  const w = makeWorld();
  w.cfg.slot = "limit";
  const r = await w.call({ content: CRISIS }, A);
  ok("crisis-screen message is delivered even while rate-limited (200, slot not consumed, no model call)",
    r.status === 200 && r.json.safetyResponse === true && !w.calls.includes("takeRateLimitSlot") && !w.calls.includes("askModel"));
  ok("crisis exchange is stored with is_safety_response on both messages",
    w.messages.length === 2 && w.messages.every((m) => m.is_safety_response === true) &&
    r.json.assistantMessage.isSafetyResponse === true && /14416/.test(r.json.assistantMessage.content));
}

// ---------------------------------------------------------------------------
// Model failures and successes
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  w.cfg.model = null;
  const r = await w.call({ content: "I feel a bit low" }, A);
  ok("model unavailable/failed/blocked -> 503 ai_unavailable",
    r.status === 503 && r.json.error === "ai_unavailable");
  ok("failed model attempt still consumed its rate-limit slot", w.slotCalls.length === 1);
  ok("failed model attempt stores nothing (no conversation, no messages, no fake reply)",
    w.conversations.length === 0 && w.messages.length === 0);
}
{
  const w = makeWorld();
  w.cfg.model = "throw";
  const r = await w.call({ content: "secret worry about exams" }, A);
  ok("model exception -> 500 internal_error with no details leaked",
    r.status === 500 && r.json.error === "internal_error" && !r.text.includes("exams") && !r.text.includes("exploded"));
  ok("model exception stores nothing", w.messages.length === 0);
}
{
  const w = makeWorld();
  const r = await w.call({ content: "  I had a tough day at work today  ", language: "hi" }, A);
  ok("successful reply -> 200 with a new conversation titled from the message",
    r.status === 200 && r.json.conversation.title === "I had a tough day at work today" &&
    r.json.conversation.profileId === ADULT_A && r.json.conversation.preferredLanguage === "hi");
  ok("both messages stored in order with the model's reply and the selected language",
    w.messages.length === 2 && w.messages[0].sender === "user" && w.messages[1].sender === "assistant" &&
    w.messages[1].content === "Here is a calm reply." && w.messages.every((m) => m.detected_language === "hi") &&
    w.messages[0].created_at < w.messages[1].created_at && r.json.safetyResponse === false);
  ok("adult gets the adult prompt in the selected language",
    w.modelCalls[0].systemPrompt.includes("Always reply in Hindi") && w.modelCalls[0].systemPrompt.includes("You are talking with an adult."));

  const convId = r.json.conversation.id;
  const r2 = await w.call({ content: "thanks, that helps", conversation_id: convId, language: "hi" }, A);
  const hist = w.modelCalls[1].history;
  ok("follow-up reuses the conversation and sends prior history plus the new message last",
    r2.status === 200 && r2.json.conversation.id === convId && w.conversations.length === 1 &&
    hist.length === 3 && hist[0].content === "I had a tough day at work today" && hist[1].sender === "assistant" &&
    hist[2].content === "thanks, that helps");
}
{
  const w = makeWorld();
  await w.call(asChild({ content: "my friend was mean to me", language: "te" }));
  ok("child identity gets the child prompt (age-appropriate rules) in the selected language",
    w.modelCalls[0].systemPrompt.includes("You are talking with a child aged 4 to 17") &&
    w.modelCalls[0].systemPrompt.includes("Always reply in Telugu") && w.conversations[0].child_id === CHILD_C &&
    w.conversations[0].profile_id === null);
}

// ---------------------------------------------------------------------------
// Store failures surface as generic 500s
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  w.cfg.failList = true;
  const r = await w.call({ action: "list_conversations" }, A);
  ok("database error while listing -> 500 internal_error, no database details in the response",
    r.status === 500 && r.json.error === "internal_error" && !r.text.includes("relation") && !r.text.includes("XX000"));
  ok("unhandled errors are logged with a code only", w.logs.some((l) => l === "unhandled_exception XX000"));
}
{
  const w = makeWorld();
  w.cfg.failInsert = true;
  const r = await w.call({ content: "saving should fail" }, A);
  ok("database error while saving messages -> 500 internal_error", r.status === 500 && r.json.error === "internal_error");
}

// ---------------------------------------------------------------------------
// Logging never contains conversation content or tokens
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  w.cfg.slot = "throw"; await w.call({ content: "private thought one" }, A);
  w.cfg.slot = "allow"; w.cfg.model = "throw"; await w.call({ content: "private thought two" }, A);
  w.cfg.model = null; w.cfg.failList = true; await w.call({ action: "list_conversations" }, A);
  await w.call(asChild({ action: "list_conversations" }));
  const all = w.logs.join("\n");
  ok("logs contain no message content, crisis text, child token or auth header",
    w.logs.length >= 3 && !/private thought|hurt myself|token-a/.test(all) && !all.includes(childToken));
}

// ---------------------------------------------------------------------------
// Safety alerts (migration 20261031000000): a child's crisis-screen match
// alerts their caregivers; an adult's never does.
// ---------------------------------------------------------------------------
{
  const w = makeWorld();
  const r = await w.call(asChild({ action: "send_message", content: CRISIS }));
  ok("child crisis message: safety reply, caregiver alerted from the companion",
    r.status === 200 && r.json.safetyResponse === true && r.json.caregiverAlerted === true &&
    w.alerts.length === 1 && w.alerts[0].childId === CHILD_C && w.alerts[0].source === "companion_flag");
  ok("the child is told gently that their grown-up knows", /grown-up know/.test(r.json.safetyNotice ?? ""));
  ok("no model call for the crisis message", !w.calls.includes("askModel"));

  const calm = await w.call(asChild({ action: "send_message", content: "I had a nice day" }));
  ok("an ordinary child message raises nothing", calm.status === 200 && calm.json.caregiverAlerted === false && w.alerts.length === 1);

  const adult = await w.call({ action: "send_message", content: CRISIS }, A);
  ok("adult crisis message: safety reply, no alert (no linked contact)",
    adult.status === 200 && adult.json.safetyResponse === true && adult.json.caregiverAlerted === false &&
    adult.json.safetyNotice === null && w.alerts.length === 1);
}
{
  const w = makeWorld();
  w.cfg.alert = "throw";
  const r = await w.call(asChild({ action: "send_message", content: CRISIS }));
  ok("a failed alert never blocks the safety reply", r.status === 200 && r.json.safetyResponse === true && r.json.caregiverAlerted === false && r.json.safetyNotice === null);
  ok("the failure is logged by code, without the child's words",
    w.logs.some((l) => l.startsWith("safety_alert_failed") && l.includes("XX000")) && !w.logs.join(" ").includes("hurt myself"));
}
