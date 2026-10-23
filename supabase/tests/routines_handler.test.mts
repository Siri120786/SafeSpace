// Sprint 3 routines: pure helpers (dates, schedule, completion window,
// request parsing, shaping) and the child `routines` Edge Function handler,
// run under Node with an in-memory store and the REAL child-token verifier.
// Usage: npx tsx supabase/tests/routines_handler.test.mts

(globalThis as any).Deno = { env: { get: (k: string) => (k === "CHILD_SESSION_SECRET" ? "routines-test-secret" : undefined) } };
const { signChildToken, verifyChildToken } = await import("../functions/_shared/childToken.ts");
const R = await import("../functions/_shared/routines.ts");
const { createRoutinesHandler } = await import("../functions/routines/handler.ts");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------
ok("valid local dates accepted, impossible or malformed ones rejected",
  R.isValidLocalDate("2026-10-24") && R.isValidLocalDate("2028-02-29") &&
  !R.isValidLocalDate("2026-02-30") && !R.isValidLocalDate("2026-13-01") &&
  !R.isValidLocalDate("2026-1-5") && !R.isValidLocalDate(20261024) && !R.isValidLocalDate("2026-10-24T00:00"));
ok("dayOfWeek is timezone-independent (0 = Sunday)",
  R.dayOfWeek("2026-10-25") === 0 && R.dayOfWeek("2026-10-24") === 6 && R.dayOfWeek("2026-10-26") === 1);
ok("empty daysOfWeek means every day; otherwise only listed weekdays",
  R.isScheduledOn([], "2026-10-25") && R.isScheduledOn([1, 2, 3, 4, 5], "2026-10-26") && !R.isScheduledOn([1, 2, 3, 4, 5], "2026-10-25"));
const NOW = new Date("2026-10-24T10:00:00Z");
ok("completion window: -7..+1 days around the UTC date (matches the DB trigger)",
  R.isWithinCompletionWindow("2026-10-24", NOW) && R.isWithinCompletionWindow("2026-10-25", NOW) &&
  R.isWithinCompletionWindow("2026-10-17", NOW) && !R.isWithinCompletionWindow("2026-10-16", NOW) &&
  !R.isWithinCompletionWindow("2026-10-26", NOW));
ok("toHHMM trims seconds", R.toHHMM("07:30:00") === "07:30" && R.toHHMM(null) === null);

const STEP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const p = (b: unknown) => R.parseRoutinesRequest(b);
ok("parse: non-object body is 400 invalid_request", !p(null).ok && (p([]) as any).error === "invalid_request");
ok("parse: missing or non-string child token is 401 invalid_session",
  (p({ action: "list", date: "2026-10-24" }) as any).status === 401 &&
  (p({ action: "list", date: "2026-10-24", child_session_token: 5 }) as any).error === "invalid_session");
ok("parse: bad date or unknown action rejected",
  (p({ action: "list", date: "24/10/2026", child_session_token: "t" }) as any).error === "invalid_input" &&
  (p({ action: "delete_all", date: "2026-10-24", child_session_token: "t" }) as any).error === "invalid_action");
ok("parse: set_step_completed needs a UUID step_id and boolean completed",
  (p({ action: "set_step_completed", date: "2026-10-24", child_session_token: "t", step_id: "x", completed: true }) as any).error === "invalid_input" &&
  (p({ action: "set_step_completed", date: "2026-10-24", child_session_token: "t", step_id: STEP, completed: "yes" }) as any).error === "invalid_input" &&
  p({ action: "set_step_completed", date: "2026-10-24", child_session_token: "t", step_id: STEP, completed: false }).ok);

const rows = [
  { id: "r1", profile_id: null, child_id: "c", module_key: "autism", title: "Weekdays", days_of_week: [1, 2, 3, 4, 5], is_active: true, created_at: "x", updated_at: "x",
    routine_steps: [
      { id: "s2", routine_id: "r1", label: "Second", scheduled_time: "08:00:00", order_index: 1, routine_step_completions: [] },
      { id: "s1", routine_id: "r1", label: "First", scheduled_time: null, order_index: 0, routine_step_completions: [{ completed_on: "2026-10-26" }] },
    ] },
  { id: "r2", profile_id: null, child_id: "c", module_key: null, title: "Every day", days_of_week: [], is_active: true, created_at: "x", updated_at: "x", routine_steps: [] },
  { id: "r3", profile_id: null, child_id: "c", module_key: null, title: "Paused", days_of_week: [], is_active: false, created_at: "x", updated_at: "x", routine_steps: [] },
];
const monday = R.shapeRoutinesForDate(rows as any, "2026-10-26");
const sunday = R.shapeRoutinesForDate(rows as any, "2026-10-25");
ok("shaping: only active routines scheduled on the date are returned",
  monday.map((r) => r.id).join() === "r1,r2" && sunday.map((r) => r.id).join() === "r2");
ok("shaping: steps ordered, camelCase, HH:MM time and completedOnDate for that date",
  monday[0].steps.map((s) => s.id).join() === "s1,s2" && monday[0].steps[0].completedOnDate === true &&
  monday[0].steps[1].completedOnDate === false && monday[0].steps[1].scheduledTime === "08:00" &&
  monday[0].moduleKey === "autism" && monday[0].daysOfWeek.join() === "1,2,3,4,5");

// ---------------------------------------------------------------------------
// Handler with an in-memory store and real child tokens
// ---------------------------------------------------------------------------
const CHILD_A = "11111111-1111-4111-8111-111111111111";
const CHILD_B = "22222222-2222-4222-8222-222222222222";
const STEP_A = "aaaaaaaa-0000-4000-8000-00000000000a";
const STEP_B = "bbbbbbbb-0000-4000-8000-00000000000b";

function makeWorld() {
  const completions = new Set<string>();
  const calls: string[] = [];
  const logs: string[] = [];
  const cfg = { failList: false };
  const routines: Record<string, any[]> = {
    [CHILD_A]: [{ id: "ra", profile_id: null, child_id: CHILD_A, module_key: "autism", title: "Morning", days_of_week: [], is_active: true,
      created_at: "x", updated_at: "x", routine_steps: [{ id: STEP_A, routine_id: "ra", label: "Brush teeth", scheduled_time: null, order_index: 0 }] }],
    [CHILD_B]: [{ id: "rb", profile_id: null, child_id: CHILD_B, module_key: null, title: "B's", days_of_week: [], is_active: true,
      created_at: "x", updated_at: "x", routine_steps: [{ id: STEP_B, routine_id: "rb", label: "B step", scheduled_time: null, order_index: 0 }] }],
  };
  const store = {
    async listRoutines(childId: string, date: string) {
      calls.push("listRoutines");
      if (cfg.failList) throw Object.assign(new Error("db down: Brush teeth"), { code: "PGRST301" });
      return (routines[childId] ?? []).map((r) => ({ ...r, routine_steps: r.routine_steps.map((s: any) => ({
        ...s, routine_step_completions: completions.has(`${s.id}|${date}`) ? [{ completed_on: date }] : [] })) }));
    },
    async childOwnsStep(childId: string, stepId: string) {
      calls.push("childOwnsStep");
      return (routines[childId] ?? []).some((r) => r.routine_steps.some((s: any) => s.id === stepId));
    },
    async setCompletion(stepId: string, date: string, completed: boolean) {
      calls.push("setCompletion");
      if (completed) completions.add(`${stepId}|${date}`); else completions.delete(`${stepId}|${date}`);
    },
  };
  const handler = createRoutinesHandler({
    store, verifyChildToken, log: (e: string, d?: string) => logs.push(`${e} ${d ?? ""}`),
    now: () => new Date("2026-10-24T10:00:00Z"),
  });
  const call = async (body: unknown, opts: { raw?: string; method?: string } = {}) => {
    const method = opts.method ?? "POST";
    const res = await handler(new Request("http://localhost/functions/v1/routines", {
      method, headers: { "Content-Type": "application/json" },
      body: method === "POST" ? (opts.raw ?? JSON.stringify(body)) : undefined,
    }));
    const text = await res.text();
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* preflight */ }
    return { status: res.status, json: j, text, cors: res.headers.get("Access-Control-Allow-Origin") };
  };
  return { call, calls, logs, cfg, completions };
}

const tokenA = await signChildToken(CHILD_A);
const tokenB = await signChildToken(CHILD_B);
{
  const w = makeWorld();
  const pre = await w.call(null, { method: "OPTIONS" });
  ok("OPTIONS preflight is 200 with CORS, before any store work", pre.status === 200 && pre.cors === "*" && w.calls.length === 0);
  ok("GET is 405 with CORS", (await w.call(null, { method: "GET" })).status === 405);
  const bad = await w.call(null, { raw: "{oops" });
  const big = await w.call(null, { raw: JSON.stringify({ pad: "x".repeat(5000) }) });
  ok("malformed JSON is 400 and oversized body is 413, no store work",
    bad.status === 400 && big.status === 413 && w.calls.length === 0);
  const [payload] = tokenA.split(".");
  const tampered = await w.call({ action: "list", date: "2026-10-24", child_session_token: `${payload}.AAAA` });
  const garbage = await w.call({ action: "list", date: "2026-10-24", child_session_token: "abc.%%%" });
  ok("tampered and malformed child tokens are 401, never 500, with no store work",
    tampered.status === 401 && garbage.status === 401 && w.calls.length === 0);
}
{
  const w = makeWorld();
  const list = await w.call({ action: "list", date: "2026-10-24", child_session_token: tokenA });
  ok("child lists only their own routines, in the contract shape",
    list.status === 200 && list.json.routines.length === 1 && list.json.routines[0].title === "Morning" &&
    list.json.routines[0].steps[0].completedOnDate === false && !list.text.includes("B step"));

  const done = await w.call({ action: "set_step_completed", date: "2026-10-24", step_id: STEP_A, completed: true, child_session_token: tokenA });
  const after = await w.call({ action: "list", date: "2026-10-24", child_session_token: tokenA });
  const tomorrow = await w.call({ action: "list", date: "2026-10-25", child_session_token: tokenA });
  ok("child ticks a step: done today, not done tomorrow (per-day progress)",
    done.status === 200 && done.json.completed === true &&
    after.json.routines[0].steps[0].completedOnDate === true && tomorrow.json.routines[0].steps[0].completedOnDate === false);
  const again = await w.call({ action: "set_step_completed", date: "2026-10-24", step_id: STEP_A, completed: true, child_session_token: tokenA });
  ok("completing twice is idempotent", again.status === 200 && w.completions.size === 1);
  await w.call({ action: "set_step_completed", date: "2026-10-24", step_id: STEP_A, completed: false, child_session_token: tokenA });
  ok("child can un-tick a step", w.completions.size === 0);

  const other = await w.call({ action: "set_step_completed", date: "2026-10-24", step_id: STEP_B, completed: true, child_session_token: tokenA });
  const unknown = await w.call({ action: "set_step_completed", date: "2026-10-24", step_id: "cccccccc-0000-4000-8000-00000000000c", completed: true, child_session_token: tokenA });
  ok("another child's step and an unknown step look the same (404) and nothing is written",
    other.status === 404 && unknown.status === 404 && other.json.error === "not_found" && w.completions.size === 0);

  const future = await w.call({ action: "set_step_completed", date: "2026-10-27", step_id: STEP_A, completed: true, child_session_token: tokenA });
  const old = await w.call({ action: "set_step_completed", date: "2026-10-10", step_id: STEP_A, completed: true, child_session_token: tokenA });
  ok("future and too-old dates are rejected before any ownership check or write",
    future.status === 400 && old.status === 400 && w.completions.size === 0);

  const listB = await w.call({ action: "list", date: "2026-10-24", child_session_token: tokenB });
  ok("child B sees only B's routine", listB.json.routines.length === 1 && listB.json.routines[0].title === "B's");
}
{
  const w = makeWorld();
  w.cfg.failList = true;
  const r = await w.call({ action: "list", date: "2026-10-24", child_session_token: tokenA });
  ok("store failure is 500 internal_error with no details leaked", r.status === 500 && r.json.error === "internal_error" && !r.text.includes("Brush"));
  ok("store failure is logged with a code only, no content or token",
    w.logs.length === 1 && w.logs[0] === "unhandled_exception PGRST301" && !w.logs[0].includes(tokenA));
}
