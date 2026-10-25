// focus-tools handler (role-flow 8e): the ADHD and autism tools for a
// signed-in child. REAL child-token verification, an in-memory store.
// Usage: npx tsx supabase/tests/focus_tools_handler.test.mts

(globalThis as any).Deno = { env: { get: (k: string) => (k === "CHILD_SESSION_SECRET" ? "focus-test-secret" : undefined) } };
const { signChildToken, verifyChildToken } = await import("../functions/_shared/childToken.ts");
const { createFocusToolsHandler, starTotals } = await import("../functions/focus-tools/handler.ts");
const { parseFocusToolsRequest, validDay, validTaskSteps } = await import("../functions/_shared/focusTools.ts");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const KID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const TASK = "33333333-3333-4333-8333-333333333333";
const HABIT = "44444444-4444-4444-8444-444444444444";
let n = 0;
const nextId = () => `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function makeWorld() {
  const db = {
    sessions: [] as any[], tasks: [] as any[], habits: [] as any[], checks: new Set<string>(),
    stars: [] as any[], emotions: [] as any[], settings: new Map<string, any>(), favorites: [] as { child_id: string; track_id: string }[],
    calmPlans: new Map<string, unknown>(),
  };
  const fail: { next: any } = { next: null };
  const maybeFail = () => { if (fail.next) { const e = fail.next; fail.next = null; throw e; } };
  const logs: string[] = [];
  const store = {
    async listSessions(c: string) { maybeFail(); return db.sessions.filter((s) => s.child_id === c); },
    async addSession(c: string, row: any) { maybeFail(); const s = { id: nextId(), ended_at: "2026-10-24T10:00:00Z", child_id: c, ...row }; db.sessions.push(s); return s; },
    async listTasks(c: string) { return db.tasks.filter((t) => t.child_id === c); },
    async createTask(c: string, title: string, steps: any) { maybeFail(); const t = { id: nextId(), child_id: c, title, steps, is_archived: false, created_at: "t", updated_at: "t" }; db.tasks.push(t); return t; },
    async updateTask(c: string, id: string, f: any) { const t = db.tasks.find((x) => x.id === id && x.child_id === c); if (!t) return null; Object.assign(t, f); return t; },
    async deleteTask(c: string, id: string) { const i = db.tasks.findIndex((x) => x.id === id && x.child_id === c); if (i < 0) return false; db.tasks.splice(i, 1); return true; },
    async listHabits(c: string) { return db.habits.filter((h) => h.child_id === c); },
    async listChecks(c: string) { return [...db.checks].map((k) => k.split("|")).filter(([h]) => db.habits.find((x) => x.id === h)?.child_id === c).map(([habit_id, day]) => ({ habit_id, day })); },
    async addHabit(c: string, title: string, icon: string | null) { maybeFail(); const h = { id: HABIT, child_id: c, title, icon, is_archived: false, created_at: "t" }; db.habits.push(h); return h; },
    async archiveHabit(c: string, id: string) { const h = db.habits.find((x) => x.id === id && x.child_id === c); if (!h) return false; h.is_archived = true; return true; },
    async childOwnsHabit(c: string, id: string) { return db.habits.some((x) => x.id === id && x.child_id === c); },
    async setCheck(h: string, day: string, checked: boolean) { if (checked) db.checks.add(`${h}|${day}`); else db.checks.delete(`${h}|${day}`); },
    async listStars(c: string) { return db.stars.filter((s) => s.child_id === c); },
    async getGoal() { return { title: "Park trip", target_stars: 3, icon: "🛝" }; },
    async awardStars(c: string, key: string, stars: number) { if (db.stars.some((s) => s.child_id === c && s.key === key)) return false; db.stars.push({ child_id: c, key, kind: "award", stars }); return true; },
    async claimGoal(c: string) { const cur = starTotals(db.stars.filter((s) => s.child_id === c)).currentStars; if (cur < 3) return { claimed: false, currentStars: cur }; db.stars.push({ child_id: c, key: "claim", kind: "claim", stars: -3 }); return { claimed: true, currentStars: cur - 3 }; },
    async listEmotions(c: string) { return db.emotions.filter((e) => e.child_id === c); },
    async addEmotion(c: string, card: string) { const e = { id: nextId(), child_id: c, card_id: card, created_at: "t" }; db.emotions.push(e); return e; },
    async getSettings(c: string) { return db.settings.get(c) ?? null; },
    async listFavorites(c: string) { return db.favorites.filter((f) => f.child_id === c).map((f) => f.track_id); },
    async addFavorite(c: string, t: string) { if (!db.favorites.some((f) => f.child_id === c && f.track_id === t)) db.favorites.push({ child_id: c, track_id: t }); },
    async removeFavorite(c: string, t: string) { db.favorites = db.favorites.filter((f) => !(f.child_id === c && f.track_id === t)); },
    async getCalmPlan(c: string) { maybeFail(); return db.calmPlans.get(c) ?? null; },
    async saveCalmPlan(c: string, plan: unknown) { maybeFail(); db.calmPlans.set(c, plan); },
  };
  const handler = createFocusToolsHandler({ store, verifyChildToken, log: (e: string, d?: string) => logs.push(`${e} ${d ?? ""}`) });
  const call = async (body: unknown, opts: { raw?: string; method?: string } = {}) => {
    const method = opts.method ?? "POST";
    const res = await handler(new Request("http://localhost/functions/v1/focus-tools", {
      method, headers: { "Content-Type": "application/json" },
      body: method === "POST" ? (opts.raw ?? JSON.stringify(body)) : undefined,
    }));
    const text = await res.text();
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* preflight */ }
    return { status: res.status, json: j };
  };
  return { call, db, fail, logs };
}

const tok = await signChildToken(KID);
const otherTok = await signChildToken(OTHER);
const w = makeWorld();
const as = (action: string, body: Record<string, unknown> = {}, token = tok) => w.call({ action, child_session_token: token, ...body });

ok("OPTIONS is 200; GET is 405; bad JSON 400; too big 413",
  (await w.call(null, { method: "OPTIONS" })).status === 200 && (await w.call(null, { method: "GET" })).status === 405 &&
  (await w.call(null, { raw: "{x" })).status === 400 && (await w.call(null, { raw: "x".repeat(16_385) })).status === 413);
ok("no token or a tampered one is invalid_session; an unknown action is invalid_action",
  (await w.call({ action: "sessions.list" })).status === 401 &&
  (await as("sessions.list", {}, `${tok.split(".")[0]}.AAAA`)).status === 401 &&
  (await as("emotions.delete")).json.error === "invalid_action");

let r = await as("sessions.add", { duration_seconds: 1500, mode: "pomodoro", phase: "focus", activity_label: "  Maths  " });
ok("a child records a focus session (tidy label, completed by default)",
  r.status === 200 && r.json.session.durationSeconds === 1500 && r.json.session.activityLabel === "Maths" && r.json.session.completed === true &&
  w.db.sessions[0].child_id === KID);
ok("bad sessions are refused before any write",
  (await Promise.all([
    as("sessions.add", { duration_seconds: 0, mode: "simple" }),
    as("sessions.add", { duration_seconds: 1.5, mode: "simple" }),
    as("sessions.add", { duration_seconds: 60, mode: "turbo" }),
    as("sessions.add", { duration_seconds: 60, mode: "simple", phase: "nap" }),
    as("sessions.add", { duration_seconds: 60, mode: "simple", activity_label: "x".repeat(81) }),
  ])).every((x) => x.status === 400) && w.db.sessions.length === 1);
ok("a child only ever sees their own sessions",
  (await as("sessions.list")).json.sessions.length === 1 && (await as("sessions.list", {}, otherTok)).json.sessions.length === 0);

const steps = [{ id: "s1", label: "Open book", isComplete: false, orderIndex: 0 }];
r = await as("tasks.create", { title: "Homework", steps });
const taskId = r.json.task.id;
ok("tasks: create, update and delete their own", r.status === 200 &&
  (await as("tasks.update", { task_id: taskId, title: "Homework", steps: [{ ...steps[0], isComplete: true, completedAt: 5 }], is_archived: false })).json.task.steps[0].isComplete === true &&
  (await as("tasks.delete", { task_id: taskId })).json.deleted === true);
ok("another child's (or a missing) task is not_found",
  (await as("tasks.update", { task_id: TASK, title: "x", steps: [], is_archived: false })).status === 404 &&
  (await as("tasks.delete", { task_id: TASK })).status === 404);
ok("bad task steps are refused",
  (await as("tasks.create", { title: "x", steps: [{ id: "a", label: "", isComplete: false, orderIndex: 0 }] })).status === 400 &&
  (await as("tasks.create", { title: "x", steps: Array.from({ length: 31 }, (_, i) => ({ id: `s${i}`, label: "x", isComplete: false, orderIndex: i })) })).status === 400 &&
  (await as("tasks.create", { title: "", steps: [] })).status === 400);

await as("habits.add", { title: "Brush teeth", icon: "🪥" });
ok("habits: tick and untick a day (twice is harmless); a list shows the ticks",
  (await as("habits.set", { habit_id: HABIT, day: "2026-10-24", checked: true })).status === 200 &&
  (await as("habits.set", { habit_id: HABIT, day: "2026-10-24", checked: true })).status === 200 &&
  (await as("habits.list")).json.checks.length === 1 &&
  (await as("habits.set", { habit_id: HABIT, day: "2026-10-24", checked: false })).status === 200 &&
  (await as("habits.list")).json.checks.length === 0);
ok("another child can't tick it; bad days are refused",
  (await as("habits.set", { habit_id: HABIT, day: "2026-10-24", checked: true }, otherTok)).status === 404 &&
  (await as("habits.set", { habit_id: HABIT, day: "2026-02-30", checked: true })).status === 400 &&
  (await as("habits.set", { habit_id: HABIT, day: "24-10-2026", checked: true })).status === 400);
ok("removing a habit archives it (its history stays)",
  (await as("habits.archive", { habit_id: HABIT })).json.archived === true && w.db.habits[0].is_archived === true);

const a1 = await as("stars.award", { event_key: "habit_day:h:2026-10-24" });
const a2 = await as("stars.award", { event_key: "habit_day:h:2026-10-24" });
ok("stars: the same event never earns twice", a1.json.awarded === true && a2.json.awarded === false && a2.json.currentStars === 1);
ok("children can't fake a claim or a big award",
  (await as("stars.award", { event_key: "claim:abc" })).status === 400 &&
  (await as("stars.award", { event_key: "x", stars: 50 })).status === 400);
await as("stars.award", { event_key: "e2", stars: 2 });
const g = await as("stars.get");
ok("stars.get shows totals and the goal", g.json.currentStars === 3 && g.json.lifetimeStars === 3 && g.json.goal.targetStars === 3);
ok("claiming spends the goal once", (await as("stars.claim")).json.claimed === true && (await as("stars.claim")).json.claimed === false);

ok("feelings cards: known cards only, newest kept; there is no delete for children",
  (await as("emotions.add", { card_id: "overwhelmed" })).status === 200 &&
  (await as("emotions.add", { card_id: "furious" })).status === 400 &&
  (await as("emotions.list")).json.choices[0].cardId === "overwhelmed");
ok("settings default to nothing set, with music on",
  JSON.stringify((await as("settings.get")).json) ===
  JSON.stringify({ transitionPreset: null, aacLabels: {}, music: { enabled: true, volumeMax: null, sleepMinutes: null } }));
w.db.settings.set(KID, { transition_preset: null, aac_labels: {}, music_enabled: false, music_volume_max: 30, music_sleep_minutes: 20 });
ok("a caregiver's music controls reach the child",
  JSON.stringify((await as("settings.get")).json.music) === JSON.stringify({ enabled: false, volumeMax: 30, sleepMinutes: 20 }));

ok("favorites: heart, heart again (no change), list, un-heart",
  (await as("favorites.add", { track_id: "gentle-waves" })).json.favorite === true &&
  (await as("favorites.add", { track_id: "gentle-waves" })).status === 200 &&
  (await as("favorites.add", { track_id: "rhyme-twinkle-twinkle" })).status === 200 &&
  JSON.stringify((await as("favorites.list")).json.trackIds) === JSON.stringify(["gentle-waves", "rhyme-twinkle-twinkle"]) &&
  (await as("favorites.remove", { track_id: "gentle-waves" })).json.favorite === false &&
  JSON.stringify((await as("favorites.list")).json.trackIds) === JSON.stringify(["rhyme-twinkle-twinkle"]));
ok("favorites: catalog ids only",
  (await as("favorites.add", { track_id: "Bad Id" })).status === 400 && (await as("favorites.add", {})).status === 400 &&
  (await as("favorites.remove", { track_id: "x".repeat(81) })).status === 400);
ok("favorites: another child sees only their own",
  (await as("favorites.list", {}, otherTok)).json.trackIds.length === 0);

ok("calm plan: empty at first, then saved and read back, trimmed",
  JSON.stringify((await as("calmPlan.get")).json.plan) === JSON.stringify({ signs: [], helps: [], people: [], places: [] }) &&
  (await as("calmPlan.save", { plan: { signs: [" My heart races "], helps: ["A warm drink"] } })).status === 200 &&
  (await as("calmPlan.get")).json.plan.signs[0] === "My heart races" &&
  (await as("calmPlan.get")).json.plan.people.length === 0);
ok("calm plan: bad plans are refused",
  (await as("calmPlan.save", { plan: { other: ["x"] } })).status === 400 &&
  (await as("calmPlan.save", { plan: { helps: ["x".repeat(121)] } })).status === 400 &&
  (await as("calmPlan.save", {})).status === 400);
ok("calm plan: another child sees only their own",
  (await as("calmPlan.get", {}, otherTok)).json.plan.signs.length === 0);

w.fail.next = Object.assign(new Error("limit_reached"), { code: "P0001" });
ok("the database cap is limit_reached (409)", (await as("sessions.add", { duration_seconds: 60, mode: "simple" })).status === 409);
w.fail.next = { code: "23514", message: "violates check constraint" };
ok("a failed database check is invalid_input (400)", (await as("tasks.create", { title: "x", steps: [] })).status === 400);
w.fail.next = Object.assign(new Error("db down: secret detail"), { code: "PGRST301" });
r = await as("sessions.list");
ok("any other failure is a 500 that logs only an error code",
  r.status === 500 && r.json.error === "internal_error" && w.logs.at(-1)?.trim() === "unhandled_exception PGRST301");

ok("request rules: real days only, step lists checked, token required",
  validDay("2026-10-24") && !validDay("2026-13-01") && !validDay("2026-02-29") && validDay("2028-02-29") &&
  validTaskSteps([]) && !validTaskSteps({}) && !validTaskSteps([{ id: "a", label: "x", isComplete: "no", orderIndex: 0 }]) &&
  !parseFocusToolsRequest({ action: "stars.get" }).ok);
