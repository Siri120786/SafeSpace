// Sprint 3 routines (migration 20261024000000): schema, backfill of legacy
// routine_steps, RLS for adults / caregivers / linked caregivers / anon, the
// per-day completion log, and the atomic create/reorder helpers.
// Usage: npx tsx supabase/tests/routines.test.mts
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const ROUTINES_MIGRATION = "20261024000000_routines.sql";
const db = new PGlite();
await db.exec(`
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    raw_user_meta_data jsonb
  );
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  create role authenticated;
  create role anon;
  create role service_role bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  -- Mirror Supabase's default privileges, so the migration's revokes are tested.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);

const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const before = files.filter((f) => f < ROUTINES_MIGRATION);
const rest = files.filter((f) => f >= ROUTINES_MIGRATION);

for (const f of before) await db.exec(readFileSync(dir + f, "utf8"));

const mk = async (role: string) =>
  (await db.query<{ id: string }>(
    `insert into auth.users (raw_user_meta_data) values ($1::jsonb) returning id`,
    [JSON.stringify({ role })])).rows[0].id;
const adultA = await mk("user");
const adultB = await mk("user");
const cgA = await mk("caregiver");
const cgB = await mk("caregiver");
const kid = async (cg: string, age = 7) =>
  (await db.query<{ id: string }>(
    `insert into children (caregiver_id, name, age, pin_hash) values ($1, 'k', $2, 'h') returning id`,
    [cg, age])).rows[0].id;
const childA = await kid(cgA);
const childB = await kid(cgB);

// Legacy data shaped like production before Sprint 3: child-only steps.
await db.query(
  `insert into routine_steps (child_id, module_key, label, order_index, is_complete) values
     ($1, 'autism', 'Brush teeth', 0, true), ($1, 'autism', 'Get dressed', 1, false),
     ($1, 'adhd', 'Homework', 0, false), ($2, 'autism', 'Breakfast', 0, false)`,
  [childA, childB]);
await db.query(
  `insert into caregiver_user_links (caregiver_id, user_id, status) values ($1, $2, 'active')`, [cgA, adultA]);

for (const f of rest) await db.exec(readFileSync(dir + f, "utf8"));
ok("all migrations including routines apply cleanly over legacy data", true);

const as = async <T,>(role: string, uid: string, sql: string, params: unknown[] = []) => {
  await db.exec(`set role ${role}; select set_config('app.uid', '${uid}', false);`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec(`reset role;`);
  }
};
const fails = async (role: string, uid: string, sql: string, params: unknown[] = []) => {
  try {
    await as(role, uid, sql, params);
    return false;
  } catch {
    return true;
  }
};
const today = (await db.query<{ d: string }>(`select ((now() at time zone 'utc')::date)::text d`)).rows[0].d;
const shift = (days: number) =>
  db.query<{ d: string }>(`select (((now() at time zone 'utc')::date) + $1::int)::text d`, [days]).then((r) => r.rows[0].d);

// ---------------------------------------------------------------------------
// Backfill of legacy steps
// ---------------------------------------------------------------------------
const legacy = (await db.query<{ child_id: string; module_key: string; title: string; steps: number; with_routine: number }>(
  `select r.child_id, r.module_key, r.title,
          (select count(*)::int from routine_steps s where s.routine_id = r.id) steps,
          (select count(*)::int from routine_steps s where s.routine_id is not null) with_routine
   from routines r order by r.child_id, r.module_key`)).rows;
ok("legacy steps are grouped into one routine per child and module (3 routines)", legacy.length === 3);
ok("every legacy step now belongs to a routine, titled after its module",
  legacy.every((r) => r.with_routine === 4) &&
  legacy.some((r) => r.child_id === childA && r.module_key === "autism" && r.title === "My Space" && r.steps === 2) &&
  legacy.some((r) => r.child_id === childA && r.module_key === "adhd" && r.title === "Focus Zone" && r.steps === 1));
ok("routine_id is now required on steps",
  (await db.query<{ n: string }>(`select is_nullable n from information_schema.columns where table_name='routine_steps' and column_name='routine_id'`)).rows[0].n === "NO");
ok("caregiver still sees their child's legacy steps through the new policies",
  (await as<{ label: string }>("authenticated", cgA, `select label from routine_steps order by label`)).map((r) => r.label).join(",") === "Brush teeth,Get dressed,Homework");

// ---------------------------------------------------------------------------
// Adults: create, read, complete their own
// ---------------------------------------------------------------------------
const createFor = (uid: string, childId: string | null, title: string, steps: unknown[], days = "{}", module: string | null = null) =>
  as<{ id: string }>("authenticated", uid,
    `select public.create_routine_with_steps($1::uuid, $2, $3, $4::smallint[], $5::jsonb) as id`,
    [childId, title, module, days, JSON.stringify(steps)]).then((r) => r[0].id);

const rA = await createFor(adultA, null, "Morning", [{ label: "Water" }, { label: "Stretch", scheduled_time: "07:30" }], "{1,2,3,4,5}", "adhd");
const aSteps = await as<{ id: string; label: string; order_index: number; scheduled_time: string | null }>("authenticated", adultA,
  `select id, label, order_index, scheduled_time::text from routine_steps where routine_id = $1 order by order_index`, [rA]);
ok("adult creates a routine with ordered steps atomically",
  aSteps.length === 2 && aSteps[0].label === "Water" && aSteps[1].order_index === 1 && aSteps[1].scheduled_time === "07:30:00");
const rowA = (await as<{ profile_id: string; child_id: string | null; days_of_week: number[] }>("authenticated", adultA,
  `select profile_id, child_id, days_of_week from routines where id = $1`, [rA]))[0];
ok("adult routine is owned by the caller (server-derived), not a child",
  rowA.profile_id === adultA && rowA.child_id === null && rowA.days_of_week.join() === "1,2,3,4,5");

await as("authenticated", adultA, `insert into routine_step_completions (step_id, completed_on) values ($1, $2)`, [aSteps[0].id, today]);
ok("adult can complete their own step for today",
  (await as("authenticated", adultA, `select 1 from routine_step_completions where step_id = $1`, [aSteps[0].id])).length === 1);
ok("completing the same step twice on the same day is rejected by the key (API uses on-conflict)",
  await fails("authenticated", adultA, `insert into routine_step_completions (step_id, completed_on) values ($1, $2)`, [aSteps[0].id, today]));
ok("future-dated completion is rejected",
  await fails("authenticated", adultA, `insert into routine_step_completions (step_id, completed_on) values ($1, $2)`, [aSteps[1].id, await shift(3)]));
ok("completion older than a week is rejected",
  await fails("authenticated", adultA, `insert into routine_step_completions (step_id, completed_on) values ($1, $2)`, [aSteps[1].id, await shift(-10)]));
ok("completion a few days back is allowed",
  !(await fails("authenticated", adultA, `insert into routine_step_completions (step_id, completed_on) values ($1, $2)`, [aSteps[1].id, await shift(-3)])));
ok("adult can un-complete (delete) their completion",
  (await as("authenticated", adultA, `delete from routine_step_completions where step_id = $1 and completed_on = $2 returning 1`, [aSteps[1].id, await shift(-3)])).length === 1);

// ---------------------------------------------------------------------------
// Isolation between adults, and from linked caregivers
// ---------------------------------------------------------------------------
ok("another adult can't see the routine, its steps or completions",
  (await as("authenticated", adultB, `select 1 from routines where id = $1`, [rA])).length === 0 &&
  (await as("authenticated", adultB, `select 1 from routine_steps where routine_id = $1`, [rA])).length === 0 &&
  (await as("authenticated", adultB, `select 1 from routine_step_completions`)).length === 0);
ok("another adult can't add a step to it",
  await fails("authenticated", adultB, `insert into routine_steps (routine_id, label) values ($1, 'x')`, [rA]));
ok("another adult can't complete its steps",
  await fails("authenticated", adultB, `insert into routine_step_completions (step_id, completed_on) values ($1, $2)`, [aSteps[1].id, today]));
ok("another adult's update and delete affect nothing",
  (await as("authenticated", adultB, `update routines set title = 'hacked' where id = $1 returning 1`, [rA])).length === 0 &&
  (await as("authenticated", adultB, `delete from routines where id = $1 returning 1`, [rA])).length === 0);
ok("a linked caregiver can't see the linked adult's routines",
  (await as("authenticated", cgA, `select 1 from routines where profile_id = $1`, [adultA])).length === 0);
ok("an adult can't create a routine owned by a child",
  await fails("authenticated", adultB, `select public.create_routine_with_steps($1::uuid, 'x', null, '{}', '[]'::jsonb)`, [childA]));
ok("an adult can't insert a routine owned by someone else",
  await fails("authenticated", adultB, `insert into routines (profile_id, title) values ($1, 'x')`, [adultA]));

// ---------------------------------------------------------------------------
// Caregivers and children
// ---------------------------------------------------------------------------
const rC = await createFor(cgA, childA, "Bedtime", [{ label: "Pyjamas" }, { label: "Story" }], "{}", "autism");
const cRow = (await db.query<{ profile_id: string | null; child_id: string }>(`select profile_id, child_id from routines where id = $1`, [rC])).rows[0];
ok("caregiver creates a routine for their own child", cRow.child_id === childA && cRow.profile_id === null);
ok("another caregiver can't create a routine for that child",
  await fails("authenticated", cgB, `select public.create_routine_with_steps($1::uuid, 'x', null, '{}', '[]'::jsonb)`, [childA]));
ok("another caregiver can't see that child's routines",
  (await as("authenticated", cgB, `select 1 from routines where child_id = $1`, [childA])).length === 0);
const cSteps = (await db.query<{ id: string }>(`select id from routine_steps where routine_id = $1 order by order_index`, [rC])).rows;
ok("caregiver can edit their child's routine and steps",
  (await as("authenticated", cgA, `update routines set title = 'Bedtime routine' where id = $1 returning 1`, [rC])).length === 1 &&
  (await as("authenticated", cgA, `update routine_steps set label = 'Put on pyjamas' where id = $1 returning 1`, [cSteps[0].id])).length === 1);

// Child completions are written by the Edge Function (service role).
await as("service_role", "", `insert into routine_step_completions (step_id, completed_on) values ($1, $2)`, [cSteps[0].id, today]);
ok("caregiver can read their child's completions",
  (await as("authenticated", cgA, `select 1 from routine_step_completions where step_id = $1`, [cSteps[0].id])).length === 1);
ok("caregiver can't write completions for the child (the child ticks their own)",
  await fails("authenticated", cgA, `insert into routine_step_completions (step_id, completed_on) values ($1, $2)`, [cSteps[1].id, today]));
ok("another caregiver can't read that child's completions",
  (await as("authenticated", cgB, `select 1 from routine_step_completions where step_id = $1`, [cSteps[0].id])).length === 0);

// ---------------------------------------------------------------------------
// Reorder helper
// ---------------------------------------------------------------------------
await as("authenticated", cgA, `select public.reorder_routine_steps($1::uuid, $2::uuid[])`, [rC, `{${cSteps[1].id},${cSteps[0].id}}`]);
const order = (await db.query<{ id: string }>(`select id from routine_steps where routine_id = $1 order by order_index`, [rC])).rows.map((r) => r.id);
ok("reorder rewrites the step order", order[0] === cSteps[1].id && order[1] === cSteps[0].id);
ok("reorder with a missing or duplicated step is rejected",
  await fails("authenticated", cgA, `select public.reorder_routine_steps($1::uuid, $2::uuid[])`, [rC, `{${cSteps[0].id}}`]) &&
  await fails("authenticated", cgA, `select public.reorder_routine_steps($1::uuid, $2::uuid[])`, [rC, `{${cSteps[0].id},${cSteps[0].id}}`]));
ok("someone else can't reorder (they can't see the steps)",
  await fails("authenticated", cgB, `select public.reorder_routine_steps($1::uuid, $2::uuid[])`, [rC, `{${cSteps[0].id},${cSteps[1].id}}`]));

// ---------------------------------------------------------------------------
// Constraints and anon
// ---------------------------------------------------------------------------
ok("routine must have exactly one owner",
  await fails("service_role", "", `insert into routines (title) values ('orphan')`) &&
  await fails("service_role", "", `insert into routines (profile_id, child_id, title) values ($1, $2, 'both')`, [adultA, childA]));
ok("invalid weekday, blank title and blank step label are rejected",
  await fails("authenticated", adultA, `insert into routines (profile_id, title, days_of_week) values ($1, 'x', '{7}')`, [adultA]) &&
  await fails("authenticated", adultA, `insert into routines (profile_id, title) values ($1, '   ')`, [adultA]) &&
  await fails("authenticated", adultA, `insert into routine_steps (routine_id, label) values ($1, '  ')`, [rA]));
ok("anon has no access to routines, steps or completions",
  await fails("anon", "", `select 1 from routines`) &&
  await fails("anon", "", `select 1 from routine_steps`) &&
  await fails("anon", "", `select 1 from routine_step_completions`) &&
  await fails("anon", "", `select public.create_routine_with_steps(null, 'x', null, '{}', '[]'::jsonb)`));

// ---------------------------------------------------------------------------
// Deletion cascades
// ---------------------------------------------------------------------------
await as("authenticated", adultA, `delete from routines where id = $1`, [rA]);
ok("deleting a routine removes its steps and completion history",
  (await db.query(`select 1 from routine_steps where routine_id = $1`, [rA])).rows.length === 0 &&
  (await db.query(`select 1 from routine_step_completions where step_id = $1`, [aSteps[0].id])).rows.length === 0);
