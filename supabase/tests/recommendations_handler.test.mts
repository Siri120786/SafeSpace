// `recommendations` Edge Function: the pure rules and the handler, run under
// Node with a fake store, a fake adult check and the REAL child-token verifier.
// Usage: npx tsx supabase/tests/recommendations_handler.test.mts

(globalThis as any).Deno = { env: { get: (k: string) => (k === "CHILD_SESSION_SECRET" ? "recs-test-secret" : undefined) } };
const { signChildToken, verifyChildToken } = await import("../functions/_shared/childToken.ts");
const { recommend, MAX_RECOMMENDATIONS, RECOMMENDATION_KEYS } = await import("../functions/_shared/recommendations.ts");
const { createRecommendationsHandler } = await import("../functions/recommendations/handler.ts");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const NOW = new Date("2026-10-26T10:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();
const summary = (o: { days?: number; latest?: { mood: string; createdAt: string } | null; scheduled?: number; completed?: number; journal?: number } = {}) => ({
  mood: { daysWithCheckin: o.days ?? 3, latest: o.latest === undefined ? { mood: "happy", createdAt: hoursAgo(2) } : o.latest },
  routines: { scheduledSteps: o.scheduled ?? 0, completedSteps: o.completed ?? 0 },
  journal: { entries: o.journal ?? 2 },
});
const keys = (r: { key: string }[]) => r.map((x) => x.key);
const base = { audience: "individual" as const, modules: [] as string[], localHour: 14, now: NOW };

// ---- Rules -----------------------------------------------------------------
{
  const r = recommend({ ...base, summary: summary({ latest: { mood: "stressed", createdAt: hoursAgo(1) } }) });
  ok("a recent 'stressed' check-in puts Calm Space first", r[0].key === "calm_space" && /stressed/.test(r[0].reason));
  const old = recommend({ ...base, summary: summary({ latest: { mood: "stressed", createdAt: hoursAgo(30) } }) });
  ok("an old 'stressed' check-in doesn't; it nudges a check-in instead", old[0].key === "mood_check_in" && !/stressed/.test(old.map((x) => x.reason).join(" ")));
  const sad = recommend({ ...base, summary: summary({ latest: { mood: "sad", createdAt: hoursAgo(1) } }) });
  ok("a recent 'sad' check-in offers music, then the companion", keys(sad).slice(0, 2).join() === "music,companion");
  ok("no check-ins this week asks for a first one",
    recommend({ ...base, summary: summary({ days: 0, latest: null }) })[0].key === "mood_check_in");
  ok("routine steps waiting are suggested",
    keys(recommend({ ...base, summary: summary({ scheduled: 6, completed: 1 }) })).includes("routines"));
  ok("mostly-done routines aren't",
    !keys(recommend({ ...base, summary: summary({ scheduled: 6, completed: 5 }) })).includes("routines"));
  ok("ADHD with no routines suggests starting one",
    keys(recommend({ ...base, modules: ["adhd"], summary: summary() })).includes("routines"));
  ok("anxiety leans on Calm Space", keys(recommend({ ...base, modules: ["anxiety"], summary: summary() })).includes("calm_space"));
  ok("evening for a child suggests a story",
    keys(recommend({ ...base, audience: "child", localHour: 21, summary: summary() })).includes("stories"));
  ok("Stories are never suggested to an Individual",
    [0, 9, 14, 21, 23].every((h) => !keys(recommend({ ...base, localHour: h, summary: summary({ journal: 3 }) })).includes("stories")));

  const all = [
    recommend({ ...base, summary: summary({ days: 0, latest: null, scheduled: 4, journal: 0 }), modules: ["anxiety", "adhd"] }),
    recommend({ ...base, audience: "child", summary: summary({ latest: { mood: "overwhelmed", createdAt: hoursAgo(1) } }) }),
    recommend({ ...base, summary: summary() }),
  ];
  ok("never more than three, never repeated, always known keys",
    all.every((r) => r.length > 0 && r.length <= MAX_RECOMMENDATIONS && new Set(keys(r)).size === r.length &&
      r.every((x) => (RECOMMENDATION_KEYS as readonly string[]).includes(x.key))));
  const words = all.flat().map((x) => x.reason).join(" ").toLowerCase();
  ok("reasons stay non-diagnostic", !/(depress|anxiety disorder|symptom|diagnos|risk|score|condition)/.test(words));
}

// ---- Handler ---------------------------------------------------------------
const CHILD = "11111111-1111-4111-8111-111111111111";
const ADULT = "33333333-3333-4333-8333-333333333333";
function makeWorld() {
  const calls: { owner: any; to?: string; tz?: string }[] = [];
  const logs: string[] = [];
  const cfg = { mode: "ok" as "ok" | "invalid" | "fail" };
  const handler = createRecommendationsHandler({
    store: {
      async summary(owner: any, to: string, tz: string) {
        calls.push({ owner, to, tz });
        if (cfg.mode === "invalid") throw new Error("invalid_input");
        if (cfg.mode === "fail") throw Object.assign(new Error("db down"), { code: "PGRST301" });
        return summary({ latest: { mood: "stressed", createdAt: hoursAgo(1) } });
      },
      async modules(owner: any) {
        return owner.kind === "child" ? ["autism"] : ["anxiety"];
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
    const res = await handler(new Request("http://localhost/functions/v1/recommendations", {
      method, headers, body: method === "POST" ? (opts.raw ?? JSON.stringify(body)) : undefined,
    }));
    const text = await res.text();
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* preflight */ }
    return { status: res.status, json: j };
  };
  return { call, calls, logs, cfg };
}

const token = await signChildToken(CHILD);
const good = { action: "get", to: "2026-10-26", timezone: "Asia/Kolkata", local_hour: 15 };
{
  const w = makeWorld();
  ok("OPTIONS preflight is 200 before any work", (await w.call(null, { method: "OPTIONS" })).status === 200 && w.calls.length === 0);
  ok("GET is 405", (await w.call(null, { method: "GET" })).status === 405);
  const c = await w.call({ ...good, child_session_token: token });
  ok("a child gets suggestions for their own data (owner from the token)",
    c.status === 200 && c.json.recommendations[0].key === "calm_space" && w.calls[0].owner.kind === "child" &&
    w.calls[0].owner.childId === CHILD && w.calls[0].tz === "Asia/Kolkata" && w.calls[0].to === "2026-10-26");
  ok("child copy is the child wording", c.json.recommendations[0].reason.startsWith("Feeling a bit much"));
  const a = await w.call(good, { auth: "Bearer good-jwt" });
  ok("an adult gets suggestions for their own data (owner from the JWT)",
    a.status === 200 && w.calls[1].owner.kind === "adult" && w.calls[1].owner.profileId === ADULT &&
    a.json.recommendations.length > 0 && a.json.recommendations.length <= 3);
  ok("an id in the body is ignored",
    (await w.call({ ...good, child_session_token: token, child_id: "22222222-2222-4222-8222-222222222222", profile_id: ADULT })).status === 200 &&
    w.calls[2].owner.childId === CHILD);
}
{
  const w = makeWorld();
  ok("no token and no JWT is 401", (await w.call(good)).status === 401);
  ok("a bad JWT is 401", (await w.call(good, { auth: "Bearer nope" })).status === 401);
  ok("a forged child token is 401", (await w.call({ ...good, child_session_token: "x.y" })).status === 401);
  ok("an empty child token is 401, not an adult fallback", (await w.call({ ...good, child_session_token: "" }, { auth: "Bearer good-jwt" })).status === 401);
  const bad = [
    { ...good, to: "2026-13-01" },
    { ...good, timezone: "Asia/Kolkata; drop" },
    { ...good, local_hour: 24 },
    { ...good, local_hour: 1.5 },
    { ...good, local_hour: "9" },
  ];
  let allBad = true;
  for (const b of bad) allBad = allBad && (await w.call(b, { auth: "Bearer good-jwt" })).status === 400;
  ok("bad dates, timezones and hours are 400", allBad && w.calls.length === 0);
  ok("unknown action is 400", (await w.call({ ...good, action: "save" }, { auth: "Bearer good-jwt" })).status === 400);
  ok("malformed JSON is 400", (await w.call(null, { raw: "{", auth: "Bearer good-jwt" })).status === 400);
  ok("an oversized body is 413", (await w.call(null, { raw: JSON.stringify({ ...good, pad: "x".repeat(3000) }), auth: "Bearer good-jwt" })).status === 413);
}
{
  const w = makeWorld();
  w.cfg.mode = "invalid";
  ok("a timezone the database rejects is 400", (await w.call(good, { auth: "Bearer good-jwt" })).status === 400);
  w.cfg.mode = "fail";
  const r = await w.call(good, { auth: "Bearer good-jwt" });
  ok("a store failure is a generic 500 and is logged", r.status === 500 && r.json.error === "internal_error" && w.logs.some((l) => l.startsWith("unhandled_exception")));
}
