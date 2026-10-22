// Sprint 3 journaling: pure helpers (validation, shaping, parity with
// shared-types) and the child `journal` Edge Function handler, run under Node
// with an in-memory store and the REAL child-token verifier.
// Usage: npx tsx supabase/tests/journal_handler.test.mts

(globalThis as any).Deno = { env: { get: (k: string) => (k === "CHILD_SESSION_SECRET" ? "journal-test-secret" : undefined) } };
const { signChildToken, verifyChildToken } = await import("../functions/_shared/childToken.ts");
const J = await import("../functions/_shared/journal.ts");
const { createJournalHandler, MAX_BODY_BYTES } = await import("../functions/journal/handler.ts");
const shared = await import("../../packages/shared-types/src/index.ts");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

// ---------------------------------------------------------------------------
// Parity with shared-types (Edge Functions can't import workspace packages)
// ---------------------------------------------------------------------------
ok("MODULE_KEYS match shared-types", JSON.stringify(J.MODULE_KEYS) === JSON.stringify(shared.MODULE_KEYS));
ok("journal entry types match shared-types", JSON.stringify(J.JOURNAL_ENTRY_TYPES) === JSON.stringify(shared.JOURNAL_ENTRY_TYPES));
ok("content limit matches shared-types", J.CONTENT_MAX_LENGTH === shared.JOURNAL_CONTENT_MAX_LENGTH);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const T = { child_session_token: "t" };
const p = (b: unknown) => J.parseJournalRequest(b);
ok("non-object body is 400, missing token is 401",
  (p(null) as any).status === 400 && (p({ action: "list" }) as any).status === 401);
const created = p({ ...T, action: "create", content: "  A good day  " });
ok("create: trims content and defaults to a shared 'journal' entry, not private",
  created.ok && (created.value as any).content === "A good day" && (created.value as any).entryType === "journal" &&
  (created.value as any).moduleKey === null && (created.value as any).isPrivateNote === false);
ok("create: blank or non-string content is invalid_input; over 5000 chars is content_too_long",
  (p({ ...T, action: "create", content: "   " }) as any).error === "invalid_input" &&
  (p({ ...T, action: "create", content: 42 }) as any).error === "invalid_input" &&
  (p({ ...T, action: "create", content: "a".repeat(5001) }) as any).error === "content_too_long");
ok("create: unknown entry type or module, or non-boolean private flag, is invalid_input",
  (p({ ...T, action: "create", content: "x", entry_type: "diary" }) as any).error === "invalid_input" &&
  (p({ ...T, action: "create", content: "x", module_key: "sleep" }) as any).error === "invalid_input" &&
  (p({ ...T, action: "create", content: "x", is_private_note: "yes" }) as any).error === "invalid_input");
const gratitude = p({ ...T, action: "create", content: "x", entry_type: "gratitude", module_key: "depression" });
ok("create: gratitude entry for a module parses", gratitude.ok && (gratitude.value as any).entryType === "gratitude" && (gratitude.value as any).moduleKey === "depression");
ok("list: limit defaults to 30, caps at 100; bad entry type rejected",
  (p({ ...T, action: "list" }) as any).value.limit === 30 && (p({ ...T, action: "list", limit: 500 }) as any).value.limit === 100 &&
  (p({ ...T, action: "list", entry_type: "x" }) as any).error === "invalid_input");
ok("unknown action is invalid_action", (p({ ...T, action: "edit" }) as any).error === "invalid_action");
const shaped = J.toJournalEntry({ id: "1", profile_id: null, child_id: "c", module_key: null, entry_type: "journal",
  content: "hi", is_private_note: false, created_at: "a", updated_at: "b", sentiment_flags: { x: 1 } } as any);
ok("shaping is camelCase and never exposes sentiment_flags",
  shaped.childId === "c" && shaped.entryType === "journal" && !("sentimentFlags" in shaped) && !("sentiment_flags" in shaped));

// ---------------------------------------------------------------------------
// Handler with an in-memory store and real child tokens
// ---------------------------------------------------------------------------
const PARTIAL = "11111111-1111-4111-8111-111111111111";
const FULL = "22222222-2222-4222-8222-222222222222";
function makeWorld() {
  const rows: any[] = [];
  const calls: string[] = [];
  const logs: string[] = [];
  const cfg = { failCreate: false };
  const tiers: Record<string, string> = { [PARTIAL]: "partial", [FULL]: "full" };
  let n = 0;
  const store = {
    async childPrivacyTier(id: string) { calls.push("tier"); return tiers[id] ?? null; },
    async createEntry(row: any) {
      calls.push("create");
      if (cfg.failCreate) throw Object.assign(new Error(`insert failed: ${row.content}`), { code: "23514" });
      const r = { id: `e${++n}`, profile_id: null, created_at: new Date(1_700_000_000_000 + n).toISOString(), updated_at: "u", ...row };
      rows.push(r);
      return r;
    },
    async listEntries(childId: string, limit: number, entryType: string | null) {
      calls.push("list");
      return rows.filter((r) => r.child_id === childId && (!entryType || r.entry_type === entryType)).reverse().slice(0, limit);
    },
  };
  const handler = createJournalHandler({ store, verifyChildToken, log: (e: string, d?: string) => logs.push(`${e} ${d ?? ""}`) });
  const call = async (body: unknown, opts: { raw?: string; method?: string } = {}) => {
    const method = opts.method ?? "POST";
    const res = await handler(new Request("http://localhost/functions/v1/journal", {
      method, headers: { "Content-Type": "application/json" },
      body: method === "POST" ? (opts.raw ?? JSON.stringify(body)) : undefined,
    }));
    const text = await res.text();
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* preflight */ }
    return { status: res.status, json: j, text, cors: res.headers.get("Access-Control-Allow-Origin") };
  };
  return { call, rows, calls, logs, cfg };
}

const tokPartial = await signChildToken(PARTIAL);
const tokFull = await signChildToken(FULL);
{
  const w = makeWorld();
  ok("OPTIONS preflight is 200 with CORS, before any store work",
    (await w.call(null, { method: "OPTIONS" })).status === 200 && w.calls.length === 0);
  const bad = await w.call(null, { raw: "{oops" });
  const huge = await w.call(null, { raw: JSON.stringify({ child_session_token: tokFull, action: "create", content: "日".repeat(9000) }) });
  ok("malformed JSON is 400; an oversized body (multi-byte) is 413; no store work",
    bad.status === 400 && huge.status === 413 && 9000 * 3 > MAX_BODY_BYTES && w.calls.length === 0);
  const [payload] = tokFull.split(".");
  ok("tampered and malformed child tokens are 401, never 500",
    (await w.call({ action: "list", child_session_token: `${payload}.AAAA` })).status === 401 &&
    (await w.call({ action: "list", child_session_token: "abc.%%%" })).status === 401 && w.calls.length === 0);
}
{
  const w = makeWorld();
  const c1 = await w.call({ action: "create", content: "Played football", child_session_token: tokFull });
  await w.call({ action: "create", content: "Thankful for my dog", entry_type: "gratitude", module_key: "depression", child_session_token: tokFull });
  await w.call({ action: "create", content: "Partial child's entry", child_session_token: tokPartial });
  ok("child creates entries owned by themselves (child_id from the token, not the body)",
    c1.status === 200 && c1.json.entry.childId === FULL && w.rows.filter((r) => r.child_id === FULL).length === 2);
  const list = await w.call({ action: "list", child_session_token: tokFull });
  ok("child lists only their own entries, newest first",
    list.status === 200 && list.json.entries.length === 2 && list.json.entries[0].content === "Thankful for my dog" &&
    !list.text.includes("Partial child's entry"));
  const grat = await w.call({ action: "list", entry_type: "gratitude", child_session_token: tokFull });
  ok("list can filter to gratitude entries", grat.json.entries.length === 1 && grat.json.entries[0].moduleKey === "depression");

  const privFull = await w.call({ action: "create", content: "secret", is_private_note: true, child_session_token: tokFull });
  const privPartial = await w.call({ action: "create", content: "my secret", is_private_note: true, child_session_token: tokPartial });
  ok("private note refused for a full-tier child, allowed for a partial-tier child",
    privFull.status === 400 && privFull.json.error === "private_note_not_allowed_for_privacy_tier" &&
    privPartial.status === 200 && privPartial.json.entry.isPrivateNote === true);
  ok("refused private note writes nothing", !w.rows.some((r) => r.content === "secret"));
}
{
  const w = makeWorld();
  w.cfg.failCreate = true;
  const r = await w.call({ action: "create", content: "very private words", child_session_token: tokFull });
  ok("store failure is 500 internal_error with nothing leaked", r.status === 500 && r.json.error === "internal_error" && !r.text.includes("private words"));
  ok("store failure is logged with a code only (no content, no token)",
    w.logs.length === 1 && w.logs[0] === "unhandled_exception 23514" && !w.logs[0].includes("private") && !w.logs[0].includes(tokFull));
}
