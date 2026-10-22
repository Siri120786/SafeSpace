// Sprint 3 reminders (migration 20261024300000): ownership and RLS for adults,
// caregivers, linked caregivers and anon; the routine-owner rule; timezone
// validation; kind/routine consistency; the acknowledgement window; cascades.
// Usage: npx tsx supabase/tests/reminders.test.mts
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

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
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);
const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(dir + f, "utf8"));
ok("all migrations including reminders apply cleanly", true);

const mk = async (role: string) =>
  (await db.query<{ id: string }>(`insert into auth.users (raw_user_meta_data) values ($1::jsonb) returning id`,
    [JSON.stringify({ role })])).rows[0].id;
const adultA = await mk("user");
const adultB = await mk("user");
const cg = await mk("caregiver");
const cgOther = await mk("caregiver");
const child = (await db.query<{ id: string }>(
  `insert into children (caregiver_id, name, age, pin_hash) values ($1, 'k', 8, 'h') returning id`, [cg])).rows[0].id;
await db.query(`insert into caregiver_user_links (caregiver_id, user_id, status) values ($1, $2, 'active')`, [cg, adultA]);
const routineA = (await db.query<{ id: string }>(`insert into routines (profile_id, title) values ($1, 'A routine') returning id`, [adultA])).rows[0].id;
const routineB = (await db.query<{ id: string }>(`insert into routines (profile_id, title) values ($1, 'B routine') returning id`, [adultB])).rows[0].id;
const routineChild = (await db.query<{ id: string }>(`insert into routines (child_id, title) values ($1, 'kid routine') returning id`, [child])).rows[0].id;

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
const shift = async (n: number) => (await db.query<{ d: string }>(`select ((now() at time zone 'utc')::date + $1::int)::text d`, [n])).rows[0].d;
const ins = (uid: string, cols: string, vals: string, params: unknown[]) =>
  as<{ id: string }>("authenticated", uid, `insert into reminders (${cols}) values (${vals}) returning id`, params);

// ---------------------------------------------------------------------------
// Adults
// ---------------------------------------------------------------------------
const water = (await ins(adultA, "profile_id, kind, title, time_of_day, days_of_week, timezone",
  "$1, 'water', 'Glass of water', '10:00', '{1,2,3,4,5}', 'Asia/Kolkata'", [adultA]))[0].id;
ok("adult creates a water reminder", !!water);
ok("adult links a reminder to their own routine",
  (await ins(adultA, "profile_id, kind, title, routine_id, time_of_day, timezone",
    "$1, 'routine', 'Morning routine', $2, '07:00', 'Asia/Kolkata'", [adultA, routineA])).length === 1);
ok("adult can't link a reminder to someone else's routine (or a child's)",
  await fails("authenticated", adultA, `insert into reminders (profile_id, kind, title, routine_id, time_of_day, timezone)
    values ($1, 'routine', 'x', $2, '07:00', 'Asia/Kolkata')`, [adultA, routineB]) &&
  await fails("authenticated", adultA, `insert into reminders (profile_id, kind, title, routine_id, time_of_day, timezone)
    values ($1, 'routine', 'x', $2, '07:00', 'Asia/Kolkata')`, [adultA, routineChild]));
ok("kind and routine must agree (routine kind needs a routine; others must not have one)",
  await fails("authenticated", adultA, `insert into reminders (profile_id, kind, title, time_of_day, timezone)
    values ($1, 'routine', 'x', '07:00', 'Asia/Kolkata')`, [adultA]) &&
  await fails("authenticated", adultA, `insert into reminders (profile_id, kind, title, routine_id, time_of_day, timezone)
    values ($1, 'water', 'x', $2, '07:00', 'Asia/Kolkata')`, [adultA, routineA]));
ok("unknown timezone, unknown kind, blank title and bad weekday rejected",
  await fails("authenticated", adultA, `insert into reminders (profile_id, kind, title, time_of_day, timezone) values ($1, 'water', 'x', '07:00', 'Mars/Olympus')`, [adultA]) &&
  await fails("authenticated", adultA, `insert into reminders (profile_id, kind, title, time_of_day, timezone) values ($1, 'snack', 'x', '07:00', 'UTC')`, [adultA]) &&
  await fails("authenticated", adultA, `insert into reminders (profile_id, kind, title, time_of_day, timezone) values ($1, 'water', '  ', '07:00', 'UTC')`, [adultA]) &&
  await fails("authenticated", adultA, `insert into reminders (profile_id, kind, title, time_of_day, days_of_week, timezone) values ($1, 'water', 'x', '07:00', '{9}', 'UTC')`, [adultA]));
ok("adult edits and disables their reminder",
  (await as("authenticated", adultA, `update reminders set title = 'Water!', is_enabled = false where id = $1 returning 1`, [water])).length === 1);

await as("authenticated", adultA, `insert into reminder_acknowledgements (reminder_id, occurs_on) values ($1, $2)`, [water, today]);
ok("adult acknowledges today's occurrence", (await as("authenticated", adultA, `select 1 from reminder_acknowledgements where reminder_id = $1`, [water])).length === 1);
ok("acknowledgement window: no future (+3) or old (-10) dates",
  await fails("authenticated", adultA, `insert into reminder_acknowledgements (reminder_id, occurs_on) values ($1, $2)`, [water, await shift(3)]) &&
  await fails("authenticated", adultA, `insert into reminder_acknowledgements (reminder_id, occurs_on) values ($1, $2)`, [water, await shift(-10)]));

// ---------------------------------------------------------------------------
// Isolation
// ---------------------------------------------------------------------------
ok("another adult can't see, edit, delete or acknowledge A's reminder",
  (await as("authenticated", adultB, `select 1 from reminders where id = $1`, [water])).length === 0 &&
  (await as("authenticated", adultB, `update reminders set title = 'x' where id = $1 returning 1`, [water])).length === 0 &&
  (await as("authenticated", adultB, `delete from reminders where id = $1 returning 1`, [water])).length === 0 &&
  await fails("authenticated", adultB, `insert into reminder_acknowledgements (reminder_id, occurs_on) values ($1, $2)`, [water, await shift(-1)]) &&
  (await as("authenticated", adultB, `select 1 from reminder_acknowledgements`)).length === 0);
ok("another adult can't create a reminder owned by A",
  await fails("authenticated", adultB, `insert into reminders (profile_id, kind, title, time_of_day, timezone) values ($1, 'water', 'x', '07:00', 'UTC')`, [adultA]));
ok("a linked caregiver sees none of the adult's reminders",
  (await as("authenticated", cg, `select 1 from reminders where profile_id = $1`, [adultA])).length === 0);

// ---------------------------------------------------------------------------
// Caregivers and children
// ---------------------------------------------------------------------------
const kidReminder = (await ins(cg, "child_id, kind, title, routine_id, time_of_day, timezone",
  "$1, 'routine', 'Bedtime routine', $2, '19:30', 'Asia/Kolkata'", [child, routineChild]))[0].id;
ok("caregiver creates a routine reminder for their child (child's own routine)", !!kidReminder);
ok("caregiver can't attach an adult's routine to the child's reminder",
  await fails("authenticated", cg, `insert into reminders (child_id, kind, title, routine_id, time_of_day, timezone)
    values ($1, 'routine', 'x', $2, '07:00', 'UTC')`, [child, routineA]));
ok("another caregiver can't see or create reminders for that child",
  (await as("authenticated", cgOther, `select 1 from reminders where child_id = $1`, [child])).length === 0 &&
  await fails("authenticated", cgOther, `insert into reminders (child_id, kind, title, time_of_day, timezone) values ($1, 'water', 'x', '07:00', 'UTC')`, [child]));
await as("service_role", "", `insert into reminder_acknowledgements (reminder_id, occurs_on) values ($1, $2)`, [kidReminder, today]);
ok("caregiver reads the child's acknowledgements but can't write them",
  (await as("authenticated", cg, `select 1 from reminder_acknowledgements where reminder_id = $1`, [kidReminder])).length === 1 &&
  await fails("authenticated", cg, `insert into reminder_acknowledgements (reminder_id, occurs_on) values ($1, $2)`, [kidReminder, await shift(-1)]));

// ---------------------------------------------------------------------------
// anon, cascades
// ---------------------------------------------------------------------------
ok("anon has no access to reminders or acknowledgements",
  await fails("anon", "", `select 1 from reminders`) && await fails("anon", "", `select 1 from reminder_acknowledgements`));
await db.query(`delete from routines where id = $1`, [routineChild]);
ok("deleting a routine deletes its reminders and their acknowledgements",
  (await db.query(`select 1 from reminders where id = $1`, [kidReminder])).rows.length === 0 &&
  (await db.query(`select 1 from reminder_acknowledgements where reminder_id = $1`, [kidReminder])).rows.length === 0);
await as("authenticated", adultA, `delete from reminders where id = $1`, [water]);
ok("deleting a reminder removes its acknowledgements",
  (await db.query(`select 1 from reminder_acknowledgements where reminder_id = $1`, [water])).rows.length === 0);
