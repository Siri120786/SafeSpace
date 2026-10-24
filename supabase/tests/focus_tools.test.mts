// The ADHD and autism tools in the database (migration 20261028200000,
// role-flow 8e) under the hosted project's default privileges.
// Usage: npx tsx supabase/tests/focus_tools.test.mts
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hashPin } from "../functions/_shared/pin.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
const db = new PGlite();
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  create role authenticated;
  create role anon;
  create role service_role bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public
    grant references, trigger, truncate on tables to anon, authenticated, service_role;
`);
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(dir + f, "utf8"));
ok("all migrations apply under hosted default privileges", true);

const as = async <T,>(role: string, uid: string, sql: string, params: unknown[] = []) => {
  await db.exec(`set role ${role}; select set_config('app.uid', '${uid}', false);`);
  try { return (await db.query<T>(sql, params)).rows; } finally { await db.exec(`reset role;`); }
};
const err = async (role: string, uid: string, sql: string, params: unknown[] = []) => {
  try { await as(role, uid, sql, params); return "no_error"; } catch (e) { return (e as Error).message; }
};
const denied = async (role: string, uid: string, sql: string, params: unknown[] = []) => {
  const m = await err(role, uid, sql, params);
  return m.includes("permission denied") || m.includes("row-level security");
};
const mk = async (role: string) =>
  (await db.query<{ id: string }>(`insert into auth.users (raw_user_meta_data) values ($1::jsonb) returning id`,
    [JSON.stringify({ role })])).rows[0].id;
const count = async (role: string, uid: string, table: string) =>
  (await as<{ n: number }>(role, uid, `select count(*)::int n from public.${table}`))[0].n;

const primary = await mk("caregiver");
const co = await mk("caregiver");
const stranger = await mk("caregiver");
const adult = await mk("user");
const otherAdult = await mk("user");
const year = new Date().getUTCFullYear();
const month = new Date().getUTCMonth() + 1;
const kid = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Kid', $2, $3, $4, '{}') id`,
  [primary, year - 8, month, await hashPin("4826")]))[0].id;
const teen = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Teen', $2, $3, $4, '{}') id`,
  [primary, year - 16, month, await hashPin("5937")]))[0].id;
await as("service_role", "", `select set_child_sharing($1, false)`, [teen]);
for (const k of [kid, teen]) {
  await as("authenticated", co, `select accept_caregiver_invite($1)`,
    [(await as<{ code: string }>("authenticated", primary, `select code from create_caregiver_invite($1)`, [k]))[0].code]);
}

const TABLES = ["focus_sessions", "focus_tasks", "habits", "habit_checks", "star_events", "star_goals", "emotion_choices", "tool_settings"];
const STEPS = JSON.stringify([{ id: "s1", label: "Open book", isComplete: false, orderIndex: 0 }]);

// ---------------------------------------------------------------------------
// Adults: their own rows, nobody else's
// ---------------------------------------------------------------------------
await as("authenticated", adult, `insert into focus_sessions (profile_id, duration_seconds, mode) values ($1, 600, 'simple')`, [adult]);
await as("authenticated", adult, `insert into focus_tasks (profile_id, title, steps) values ($1, 'Homework', $2::jsonb)`, [adult, STEPS]);
const habit = (await as<{ id: string }>("authenticated", adult, `insert into habits (profile_id, title, icon) values ($1, 'Drink water', '💧') returning id`, [adult]))[0].id;
await as("authenticated", adult, `insert into habit_checks (habit_id, day) values ($1, current_date)`, [habit]);
await as("authenticated", adult, `insert into star_events (profile_id, event_key, kind, stars) values ($1, 'task_step:s1:2026-10-24', 'award', 1)`, [adult]);
await as("authenticated", adult, `insert into star_goals (profile_id, title, target_stars) values ($1, 'Movie night', 2)`, [adult]);
await as("authenticated", adult, `insert into emotion_choices (profile_id, card_id) values ($1, 'calm')`, [adult]);
await as("authenticated", adult, `insert into tool_settings (profile_id, transition_preset, aac_labels) values ($1, '{"activity":"Lunch","totalSeconds":300}', '{"break":"Pause"}')`, [adult]);
let all = true;
for (const t of TABLES) all &&= (await count("authenticated", adult, t)) === 1;
ok("an Individual keeps their own focus sessions, tasks, habits, ticks, stars, goal, feelings and settings", all);
all = true;
for (const t of TABLES) all &&= (await count("authenticated", otherAdult, t)) === 0 && (await count("authenticated", primary, t)) === 0;
ok("another adult, or a caregiver, sees none of an Individual's tool data", all);
ok("anon can't read any tool table", (await Promise.all(TABLES.map((t) => denied("anon", "", `select 1 from public.${t}`)))).every(Boolean));

ok("an adult can't write rows for someone else or for a child",
  await denied("authenticated", otherAdult, `insert into focus_sessions (profile_id, duration_seconds, mode) values ($1, 60, 'simple')`, [adult]) &&
  await denied("authenticated", primary, `insert into focus_sessions (child_id, duration_seconds, mode) values ($1, 60, 'simple')`, [kid]) &&
  await denied("authenticated", primary, `insert into emotion_choices (child_id, card_id) values ($1, 'sad')`, [kid]) &&
  await denied("authenticated", primary, `insert into habits (child_id, title) values ($1, 'x')`, [kid]) &&
  await denied("authenticated", primary, `insert into star_events (child_id, event_key, kind, stars) values ($1, 'x', 'award', 1)`, [kid]) &&
  await denied("authenticated", otherAdult, `insert into habit_checks (habit_id, day) values ($1, current_date)`, [habit]));

ok("an adult can't edit or delete someone else's rows (nothing changes)",
  (await as("authenticated", otherAdult, `update focus_tasks set title = 'x' returning id`)).length === 0 &&
  (await as("authenticated", otherAdult, `delete from emotion_choices returning id`)).length === 0 &&
  (await count("authenticated", adult, "emotion_choices")) === 1);

ok("an Individual can clear their own feelings and focus history",
  (await as("authenticated", adult, `delete from emotion_choices returning id`)).length === 1 &&
  (await as("authenticated", adult, `delete from focus_sessions returning id`)).length === 1);

ok("every row has exactly one owner",
  (await err("service_role", "", `insert into habits (title) values ('x')`)).includes("habits_one_owner") &&
  (await err("service_role", "", `insert into habits (profile_id, child_id, title) values ($1, $2, 'x')`, [adult, kid])).includes("habits_one_owner"));

// ---------------------------------------------------------------------------
// Children's rows: written by the focus-tools function (service role)
// ---------------------------------------------------------------------------
for (const child of [kid, teen]) {
  await as("service_role", "", `insert into focus_sessions (child_id, duration_seconds, mode, phase) values ($1, 1500, 'pomodoro', 'focus')`, [child]);
  await as("service_role", "", `insert into focus_tasks (child_id, title, steps) values ($1, 'Pack bag', $2::jsonb)`, [child, STEPS]);
  const h = (await as<{ id: string }>("service_role", "", `insert into habits (child_id, title) values ($1, 'Brush teeth') returning id`, [child]))[0].id;
  await as("service_role", "", `insert into habit_checks (habit_id, day) values ($1, current_date)`, [h]);
  await as("service_role", "", `insert into star_events (child_id, event_key, kind, stars) values ($1, 'habit_day:h:2026-10-24', 'award', 1)`, [child]);
  await as("service_role", "", `insert into emotion_choices (child_id, card_id) values ($1, 'overwhelmed')`, [child]);
}
const seen = async (uid: string, child: string) => {
  let n = 0;
  for (const t of ["focus_sessions", "focus_tasks", "habits", "star_events", "emotion_choices"]) {
    n += (await as<{ n: number }>("authenticated", uid, `select count(*)::int n from public.${t} where child_id = $1`, [child]))[0].n;
  }
  n += (await as<{ n: number }>("authenticated", uid,
    `select count(*)::int n from habit_checks hc join habits h on h.id = hc.habit_id where h.child_id = $1`, [child]))[0].n;
  return n;
};
ok("the primary and a co-caregiver see an under-15 child's tool activity", (await seen(primary, kid)) === 6 && (await seen(co, kid)) === 6);
ok("a stranger sees none of it", (await seen(stranger, kid)) === 0);
ok("a 15+ child who chose not to share: caregivers see none of it (same rule as mood)",
  (await seen(primary, teen)) === 0 && (await seen(co, teen)) === 0);
await as("service_role", "", `select set_child_sharing($1, true)`, [teen]);
ok("…and see it once the teen chooses to share", (await seen(primary, teen)) === 6);
ok("caregivers can't change or delete a child's activity",
  (await as("authenticated", primary, `delete from emotion_choices where child_id = $1 returning id`, [kid])).length === 0 &&
  (await as("authenticated", primary, `update focus_tasks set title = 'x' where child_id = $1 returning id`, [kid])).length === 0 &&
  (await seen(primary, kid)) === 6);

// ---------------------------------------------------------------------------
// Stars
// ---------------------------------------------------------------------------
const award = (key: string) => as("authenticated", adult,
  `insert into star_events (profile_id, event_key, kind, stars) values ($1, $2, 'award', 1) on conflict (profile_id, event_key) do nothing returning id`, [adult, key]);
const firstTime = await award("task_step:s2:2026-10-24");
const again = await award("task_step:s2:2026-10-24");
const stars = async () => (await as<{ n: number }>("authenticated", adult, `select coalesce(sum(stars), 0)::int n from star_events`))[0].n;
ok("each star event is awarded once: ticking again earns nothing", firstTime.length === 1 && again.length === 0 && (await stars()) === 2);
ok("adults can't add claims or big awards directly",
  await denied("authenticated", adult, `insert into star_events (profile_id, event_key, kind, stars) values ($1, 'c', 'claim', -2)`, [adult]) &&
  (await err("authenticated", adult, `insert into star_events (profile_id, event_key, kind, stars) values ($1, 'big', 'award', 50)`, [adult])).includes("star_events_amount"));
const claim = async () => (await as<{ r: { claimed: boolean; currentStars: number } }>("authenticated", adult, `select claim_my_star_goal() r`))[0].r;
const c1 = await claim();
const c2 = await claim();
ok("claiming the goal spends its target once there are enough stars", c1.claimed && c1.currentStars === 0 && !c2.claimed && (await stars()) === 0);
ok("a child's goal is claimed only by the server",
  (await err("authenticated", primary, `select claim_child_star_goal($1)`, [kid])).includes("permission denied") &&
  (await as<{ r: { claimed: boolean } }>("service_role", "", `select claim_child_star_goal($1) r`, [kid]))[0].r.claimed === false);

// ---------------------------------------------------------------------------
// Goals and settings: any caregiver of the child
// ---------------------------------------------------------------------------
await as("authenticated", co, `insert into star_goals (child_id, title, target_stars, icon) values ($1, 'Park trip', 5, '🛝')`, [kid]);
await as("authenticated", primary, `insert into tool_settings (child_id, transition_preset) values ($1, '{"activity":"Bath time","totalSeconds":120}')`, [kid]);
ok("any caregiver sets a child's star goal and countdown preset",
  (await as("authenticated", primary, `select 1 from star_goals where child_id = $1`, [kid])).length === 1 &&
  (await as("authenticated", co, `update tool_settings set aac_labels = '{"play":"Lego"}' where child_id = $1 returning id`, [kid])).length === 1);
ok("a stranger can't read or set them",
  (await as("authenticated", stranger, `select 1 from star_goals where child_id = $1`, [kid])).length === 0 &&
  await denied("authenticated", stranger, `insert into tool_settings (child_id) values ($1)`, [teen]) &&
  (await as("authenticated", stranger, `update tool_settings set aac_labels = '{}' where child_id = $1 returning id`, [kid])).length === 0);
ok("one goal and one settings row per person",
  (await err("service_role", "", `insert into star_goals (child_id, title, target_stars) values ($1, 'x', 3)`, [kid])).includes("star_goals_child_id_key"));

// ---------------------------------------------------------------------------
// What can be stored
// ---------------------------------------------------------------------------
const bad = async (sql: string, params: unknown[]) => (await err("service_role", "", sql, params)) !== "no_error";
ok("task steps must be a short list of proper steps",
  await bad(`insert into focus_tasks (child_id, title, steps) values ($1, 't', '{}')`, [kid]) &&
  await bad(`insert into focus_tasks (child_id, title, steps) values ($1, 't', '[{"id":"a","label":"x","orderIndex":0}]')`, [kid]) &&
  await bad(`insert into focus_tasks (child_id, title, steps) values ($1, 't', '[{"id":"a","label":"","isComplete":false,"orderIndex":0}]')`, [kid]) &&
  await bad(`insert into focus_tasks (child_id, title, steps) values ($1, 't', $2::jsonb)`,
    [kid, JSON.stringify(Array.from({ length: 31 }, (_, i) => ({ id: `s${i}`, label: "x", isComplete: false, orderIndex: i })))]) &&
  !(await bad(`insert into focus_tasks (child_id, title, steps) values ($1, 't', '[{"id":"a","label":"Ok","isComplete":true,"orderIndex":0,"completedAt":1}]')`, [kid])));
ok("only known feelings cards, sensible durations, presets and labels",
  await bad(`insert into emotion_choices (child_id, card_id) values ($1, 'furious')`, [kid]) &&
  await bad(`insert into focus_sessions (child_id, duration_seconds, mode) values ($1, 0, 'simple')`, [kid]) &&
  await bad(`insert into focus_sessions (child_id, duration_seconds, mode) values ($1, 60, 'turbo')`, [kid]) &&
  await bad(`insert into tool_settings (child_id, transition_preset) values ($1, '{"activity":"x","totalSeconds":5}')`, [teen]) &&
  await bad(`insert into tool_settings (child_id, aac_labels) values ($1, '{"play":""}')`, [teen]) &&
  await bad(`insert into tool_settings (child_id, aac_labels) values ($1, '{"play":3}')`, [teen]));
ok("habit ticks only for the last month",
  await bad(`insert into habit_checks (habit_id, day) values ($1, current_date - 40)`, [habit]) &&
  await bad(`insert into habit_checks (habit_id, day) values ($1, current_date + 3)`, [habit]) &&
  !(await bad(`insert into habit_checks (habit_id, day) values ($1, current_date - 3)`, [habit])));

for (let i = 0; i < 19; i++) await as("authenticated", adult, `insert into habits (profile_id, title) values ($1, $2)`, [adult, `H${i}`]);
ok("up to 20 habits each", (await err("authenticated", adult, `insert into habits (profile_id, title) values ($1, 'one more')`, [adult])).includes("limit_reached"));
// The kid already has one session today; 99 more reaches the cap.
for (let i = 0; i < 99; i++) await as("service_role", "", `insert into focus_sessions (child_id, duration_seconds, mode) values ($1, 60, 'simple')`, [kid]);
ok("at most 100 focus sessions a day each",
  (await err("service_role", "", `insert into focus_sessions (child_id, duration_seconds, mode) values ($1, 60, 'simple')`, [kid])).includes("limit_reached") &&
  (await err("service_role", "", `insert into focus_sessions (child_id, duration_seconds, mode) values ($1, 60, 'simple')`, [teen])) === "no_error");

// ---------------------------------------------------------------------------
// "I want a grown-up"
// ---------------------------------------------------------------------------
const help = async (child: string, source?: string) => source
  ? (await as<{ id: string }>("service_role", "", `select raise_help_alert($1, $2) id`, [child, source]))[0].id
  : (await as<{ id: string }>("service_role", "", `select raise_help_alert($1) id`, [child]))[0].id;
const fromCards = await help(kid, "feelings_card");
const fromBoard = await help(kid);
const src = (await db.query<{ t: string }>(`select triggered_by t from emergency_events where id = $1`, [fromCards])).rows;
ok("'I want a grown-up' raises a caregiver alert labelled as from the feelings cards", src[0]?.t === "feelings_card");
ok("a talk-board tap within 2 minutes is the same alert (and the old call still works)", fromBoard === fromCards);
ok("caregivers see it like any help alert",
  (await as("authenticated", co, `select 1 from emergency_events where id = $1`, [fromCards])).length === 1);
ok("only the two help sources, only from the server",
  (await err("service_role", "", `select raise_help_alert($1, 'journal_flag')`, [kid])).includes("invalid_input") &&
  (await err("authenticated", primary, `select raise_help_alert($1, 'feelings_card')`, [kid])).includes("permission denied"));
