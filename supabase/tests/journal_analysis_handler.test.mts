// `journal-analysis` Edge Function: the pure rules and the handler, run under
// Node with a fake store, a fake adult check and the REAL child-token verifier.
// Usage: npx tsx supabase/tests/journal_analysis_handler.test.mts

(globalThis as any).Deno = { env: { get: (k: string) => (k === "CHILD_SESSION_SECRET" ? "journal-analysis-secret" : undefined) } };
const { signChildToken, verifyChildToken } = await import("../functions/_shared/childToken.ts");
const { analyzeJournal, MAX_THEMES } = await import("../functions/_shared/journalAnalysis.ts");
const { createJournalAnalysisHandler } = await import("../functions/journal-analysis/handler.ts");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const NOW = new Date("2026-10-26T12:00:00Z");   // 17:30 in Kolkata
const TZ = "Asia/Kolkata";
const daysAgo = (d: number, hour = 6) => new Date(Date.UTC(2026, 9, 26 - d, hour)).toISOString();
const entry = (content: string, d: number, type = "journal") => ({ content, entry_type: type, created_at: daysAgo(d) });
const writer = { viewer: "writer" as const, timezone: TZ, now: NOW };
const caregiver = { viewer: "caregiver" as const, timezone: TZ, now: NOW };

// ---- Rules -----------------------------------------------------------------
{
  const rows = [
    entry("Played with my dog in the park after school", 0),
    entry("School was long. My friends made it better.", 1),
    entry("Thankful for my friends", 1, "gratitude"),
    entry("Grateful for dinner with family", 2, "gratitude"),
    entry("Grateful for sleep", 3, "gratitude"),
    entry("Old entry about school", 40),
  ];
  const r = analyzeJournal(rows, writer);
  ok("counts only the last 30 days", r.entries === 5 && r.periodDays === 30);
  ok("days written are local days", r.daysWritten === 4);
  ok("gratitude entries counted", r.gratitudeEntries === 3);
  ok("gratitude streak runs back from yesterday when today has none", r.gratitudeStreakDays === 3);
  ok("top themes, most-mentioned first, at most three",
    r.themes.length <= MAX_THEMES && r.themes[0].key === "school" && r.themes[0].entries === 2 &&
    r.themes.some((t) => t.key === "friends"));
  ok("no safety message without crisis words", r.safetyMessage === null);
}
{
  const words = (text: string) => analyzeJournal([entry(text, 0)], writer).themes.map((t) => t.key);
  ok("whole words with endings match ('friends', 'walking')", words("walking with friends").join() === "friends,outdoors" || words("walking with friends").join() === "outdoors,friends");
  ok("no matches inside other words ('category', 'ready', 'petrol')", words("I'm ready, the category list, petrol").length === 0);
  ok("an empty journal has no themes and no streak", (() => {
    const e = analyzeJournal([], writer);
    return e.entries === 0 && e.themes.length === 0 && e.gratitudeStreakDays === 0 && e.safetyMessage === null;
  })());
}
{
  const rows = [entry("I want to die", 2), entry("School and friends", 1), entry("friends again", 0)];
  const w = analyzeJournal(rows, writer);
  ok("writer: a recent crisis entry shows the fixed safety message instead of themes",
    !!w.safetyMessage && /112/.test(w.safetyMessage) && /14416/.test(w.safetyMessage) && w.themes.length === 0);
  ok("writer: counts still shown alongside", w.entries === 3);
  const c = analyzeJournal(rows, caregiver);
  ok("caregiver: no safety message, and the crisis entry is left out of themes",
    c.safetyMessage === null && c.themes.length > 0 && c.themes.every((t) => t.entries <= 2));
  const old = analyzeJournal([entry("I want to die", 12), entry("friends", 0)], writer);
  ok("writer: an older crisis entry is only left out of themes", old.safetyMessage === null && old.themes.map((t) => t.key).join() === "friends");
}
{
  const many = analyzeJournal(
    ["sleep", "school", "work", "friends", "family", "food", "play", "park", "dog", "music"].map((w, i) => entry(w, i % 5)), writer);
  const text = JSON.stringify(many).toLowerCase();
  ok("never more than three themes", many.themes.length === 3);
  ok("nothing diagnostic in the output", !/(depress|anxiety|symptom|diagnos|risk|score|disorder)/.test(text));
}

// ---- Handler ---------------------------------------------------------------
const CHILD = "11111111-1111-4111-8111-111111111111";
const OTHER_CHILD = "22222222-2222-4222-8222-222222222222";
const ADULT = "33333333-3333-4333-8333-333333333333";
function makeWorld() {
  const reads: any[] = [];
  const logs: string[] = [];
  const cfg = { fail: false };
  const handler = createJournalAnalysisHandler({
    store: {
      async entries(reader: any, since: string) {
        reads.push({ reader, since });
        if (cfg.fail) throw Object.assign(new Error("db down"), { code: "PGRST301" });
        return [entry("friends at school", 0), entry("I want to die", 1)];
      },
    },
    verifyChildToken,
    authenticateAdult: async (auth: string) => (auth === "Bearer good-jwt" ? ADULT : null),
    log: (e: string, d?: string) => logs.push(`${e} ${d ?? ""}`),
    now: () => NOW,
  });
  const call = async (body: unknown, opts: { raw?: string; method?: string; auth?: string } = {}) => {
    const method = opts.method ?? "POST";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (opts.auth) headers.Authorization = opts.auth;
    const res = await handler(new Request("http://localhost/functions/v1/journal-analysis", {
      method, headers, body: method === "POST" ? (opts.raw ?? JSON.stringify(body)) : undefined,
    }));
    const text = await res.text();
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* preflight */ }
    return { status: res.status, json: j };
  };
  return { call, reads, logs, cfg };
}

const token = await signChildToken(CHILD);
const good = { action: "get", timezone: TZ };
{
  const w = makeWorld();
  ok("OPTIONS preflight is 200 before any work", (await w.call(null, { method: "OPTIONS" })).status === 200 && w.reads.length === 0);
  ok("GET is 405", (await w.call(null, { method: "GET" })).status === 405);

  const c = await w.call({ ...good, child_session_token: token, child_id: OTHER_CHILD });
  ok("a child reads their own journal; a child_id in the body is ignored",
    c.status === 200 && w.reads[0].reader.kind === "child" && w.reads[0].reader.childId === CHILD);
  ok("the child (the writer) gets the safety message", !!c.json.insights.safetyMessage);
  ok("reads only the last 30 days", w.reads[0].since === new Date(NOW.getTime() - 30 * 86_400_000).toISOString());

  const a = await w.call(good, { auth: "Bearer good-jwt" });
  ok("an adult reads their own journal under their JWT",
    a.status === 200 && w.reads[1].reader.kind === "adult_own" && w.reads[1].reader.profileId === ADULT &&
    w.reads[1].reader.authorization === "Bearer good-jwt" && !!a.json.insights.safetyMessage);

  const g = await w.call({ ...good, child_id: CHILD }, { auth: "Bearer good-jwt" });
  ok("a caregiver reads a child's journal under their own JWT (RLS applies sharing)",
    g.status === 200 && w.reads[2].reader.kind === "caregiver_child" && w.reads[2].reader.childId === CHILD &&
    w.reads[2].reader.authorization === "Bearer good-jwt");
  ok("the caregiver never gets the safety message; the crisis entry is just left out",
    g.json.insights.safetyMessage === null && g.json.insights.themes.length > 0);
}
{
  const w = makeWorld();
  ok("no token and no JWT is 401", (await w.call(good)).status === 401);
  ok("a bad JWT is 401", (await w.call(good, { auth: "Bearer nope" })).status === 401);
  ok("a forged child token is 401", (await w.call({ ...good, child_session_token: "x.y" })).status === 401);
  ok("an empty child token is 401, not an adult fallback", (await w.call({ ...good, child_session_token: "" }, { auth: "Bearer good-jwt" })).status === 401);
  let allBad = true;
  for (const b of [{ ...good, timezone: "Not/AZone" }, { ...good, timezone: "x; drop" }, { action: "get" }, { ...good, child_id: "nope" }, { ...good, child_id: 5 }]) {
    allBad = allBad && (await w.call(b, { auth: "Bearer good-jwt" })).status === 400;
  }
  ok("bad timezones and child ids are 400 before any read", allBad && w.reads.length === 0);
  ok("unknown action is 400", (await w.call({ ...good, action: "save" }, { auth: "Bearer good-jwt" })).status === 400);
  ok("malformed JSON is 400", (await w.call(null, { raw: "{", auth: "Bearer good-jwt" })).status === 400);
  ok("an oversized body is 413", (await w.call(null, { raw: JSON.stringify({ ...good, pad: "x".repeat(3000) }), auth: "Bearer good-jwt" })).status === 413);
  w.cfg.fail = true;
  const r = await w.call(good, { auth: "Bearer good-jwt" });
  ok("a store failure is a generic 500 and is logged", r.status === 500 && r.json.error === "internal_error" && w.logs.some((l) => l.startsWith("unhandled_exception")));
}
