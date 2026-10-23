// Age and the age-15 sharing rule (migration 20261027100000, role-flow M2),
// under the hosted project's default privileges: the age calculation to the
// day of the month (and parity with both TypeScript copies), each sharing
// status across every gated table for primary and co-caregivers, what is never
// gated, private-note removal, who may set sharing / change details / modules,
// both create_child versions, and the age-only insert fallback.
// Usage: npx tsx supabase/tests/sharing.test.mts
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hashPin } from "../functions/_shared/pin.ts";
import * as edgeShare from "../functions/_shared/childSharing.ts";
import * as clientShare from "../../packages/api-client/src/childSharing.ts";

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
const mk = async (role: string) =>
  (await db.query<{ id: string }>(`insert into auth.users (raw_user_meta_data) values ($1::jsonb) returning id`,
    [JSON.stringify({ role })])).rows[0].id;
const one = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

// ---------------------------------------------------------------------------
// 1. Age calculation, to the month, and parity with the TypeScript copies
// ---------------------------------------------------------------------------
const age = async (by: number, bm: number, on: string) =>
  (await one<{ a: number }>(`select child_age_years($1, $2, $3::date) a`, [by, bm, on])).a;
ok("born October 2011: 14 on 30 Sept 2026, 15 on 1 Oct 2026",
  (await age(2011, 10, "2026-09-30")) === 14 && (await age(2011, 10, "2026-10-01")) === 15);
ok("year boundary: born January 2012 is 14 on 31 Dec 2026 and 15 on 1 Jan 2027",
  (await age(2012, 1, "2026-12-31")) === 14 && (await age(2012, 1, "2027-01-01")) === 15);
{
  let same = true;
  for (const on of ["2026-01-01", "2026-06-15", "2026-10-01", "2026-12-31", "2027-02-28"]) {
    for (let y = 2007; y <= 2023; y += 2) for (let m = 1; m <= 12; m += 1) {
      const sql = await age(y, m, on);
      const d = new Date(on + "T12:00:00Z");
      if (edgeShare.childAgeYears(y, m, d) !== sql || clientShare.childAgeYears(y, m, d) !== sql) { same = false; break; }
    }
  }
  ok("child_age_years is identical in SQL, the Edge Functions and the api-client (5 dates x 108 births)", same);
}
ok("sharing status is identical in both TypeScript copies",
  [10, 14, 15, 17].every((a) => [null, true, false].every((s) =>
    edgeShare.childSharingStatus(a, s) === clientShare.childSharingStatus(a, s))));

// ---------------------------------------------------------------------------
// Fixtures: one family with four children, a co-caregiver, a stranger
// ---------------------------------------------------------------------------
const primary = await mk("caregiver");
const co = await mk("caregiver");
const stranger = await mk("caregiver");
const hash = await hashPin("4826");
const yearsAgo = (n: number) => new Date().getUTCFullYear() - n;
const month = new Date().getUTCMonth() + 1;
const child = async (name: string, years: number) =>
  (await as<{ id: string }>("service_role", "",
    `select create_child($1, $2, $3, $4, $5, '{autism}') id`, [primary, name, yearsAgo(years), month, hash]))[0].id;
const kid10 = await child("Ten", 10);
const teenAsk = await child("Teen not asked", 16);
const teenYes = await child("Teen shares", 16);
const teenNo = await child("Teen doesn't share", 16);
await as("service_role", "", `select set_child_sharing($1, true)`, [teenYes]);
await as("service_role", "", `select set_child_sharing($1, false)`, [teenNo]);
await as("authenticated", co, `select accept_caregiver_invite($1)`,
  [(await as<{ code: string }>("authenticated", primary, `select code from create_caregiver_invite($1)`, [teenNo]))[0].code]);
for (const k of [kid10, teenAsk, teenYes]) {
  await as("authenticated", co, `select accept_caregiver_invite($1)`,
    [(await as<{ code: string }>("authenticated", primary, `select code from create_caregiver_invite($1)`, [k]))[0].code]);
}

const status = async (id: string) => (await as<{ s: string }>("service_role", "", `select child_sharing_status($1) s`, [id]))[0].s;
ok("statuses: under_15, not_asked, shared, not_shared",
  (await status(kid10)) === "under_15" && (await status(teenAsk)) === "not_asked" &&
  (await status(teenYes)) === "shared" && (await status(teenNo)) === "not_shared");

// Activity for every child, written the way the Edge Functions do (service role).
const kids = { kid10, teenAsk, teenYes, teenNo };
const reminderOf: Record<string, string> = {};
for (const [name, id] of Object.entries(kids)) {
  await as("service_role", "", `insert into mood_checkins (child_id, mood, note) values ($1, 'happy', $2)`, [id, name]);
  await as("service_role", "", `insert into journal_entries (child_id, content) values ($1, $2)`, [id, name]);
  const rid = (await as<{ id: string }>("authenticated", primary,
    `select create_routine_with_steps($1, 'Morning', null, '{}', '[{"label":"Teeth"}]'::jsonb) id`, [id]))[0].id;
  const step = (await one<{ id: string }>(`select id from routine_steps where routine_id = $1`, [rid])).id;
  await as("service_role", "", `insert into routine_step_completions (step_id, completed_on) values ($1, current_date)`, [step]);
  reminderOf[name] = (await as<{ id: string }>("authenticated", primary,
    `insert into reminders (child_id, kind, title, time_of_day, timezone) values ($1, 'water', 'Water', '00:00', 'UTC') returning id`, [id]))[0].id;
  await as("service_role", "", `insert into reminder_acknowledgements (reminder_id, occurs_on) values ($1, current_date)`, [reminderOf[name]]);
  const conv = (await as<{ id: string }>("service_role", "", `insert into ai_companion_conversations (child_id) values ($1) returning id`, [id]))[0].id;
  await as("service_role", "", `insert into ai_companion_messages (conversation_id, sender, content) values ($1, 'user', $2)`, [conv, name]);
}

// ---------------------------------------------------------------------------
// 2. Gated activity: visible unless the young person chose not to share
// ---------------------------------------------------------------------------
const gated: Record<string, string> = {
  "mood check-ins": `select 1 from mood_checkins where child_id = $1`,
  "journal entries": `select 1 from journal_entries where child_id = $1`,
  "routine completions": `select 1 from routine_step_completions c join routine_steps s on s.id = c.step_id join routines r on r.id = s.routine_id where r.child_id = $1`,
  "reminder acknowledgements": `select 1 from reminder_acknowledgements a join reminders r on r.id = a.reminder_id where r.child_id = $1`,
  "AI conversations": `select 1 from ai_companion_conversations where child_id = $1`,
  "AI messages": `select 1 from ai_companion_messages m join ai_companion_conversations c on c.id = m.conversation_id where c.child_id = $1`,
};
for (const [label, sql] of Object.entries(gated)) {
  let good = true;
  for (const who of [primary, co]) {
    good &&= (await as("authenticated", who, sql, [kid10])).length === 1;
    good &&= (await as("authenticated", who, sql, [teenAsk])).length === 1;
    good &&= (await as("authenticated", who, sql, [teenYes])).length === 1;
    good &&= (await as("authenticated", who, sql, [teenNo])).length === 0;
  }
  ok(`${label}: primary and co-caregiver see under 15, not asked and shared; not when not shared`, good);
}
ok("a stranger sees no activity even for a child who shares",
  (await Promise.all(Object.values(gated).map((sql) => as("authenticated", stranger, sql, [teenYes])))).every((r) => r.length === 0));
ok("the caregiver's wellness summary for a child who doesn't share is all zeros",
  (await as<{ s: any }>("authenticated", primary, `select wellness_summary(null, $1, current_date, 7, 'UTC') s`, [teenNo]))[0].s.mood.checkins === 0);
ok("...while the young person's own summary (service role) still counts everything",
  (await as<{ s: any }>("service_role", "", `select wellness_summary(null, $1, current_date, 7, 'UTC') s`, [teenNo]))[0].s.mood.checkins === 1);

// ---------------------------------------------------------------------------
// 3. Never gated
// ---------------------------------------------------------------------------
ok("for a child who doesn't share, caregivers still see the child, modules, routines, steps and reminders",
  (await as("authenticated", co, `select id from children where id = $1`, [teenNo])).length === 1 &&
  (await as("authenticated", co, `select module_key from child_modules where child_id = $1`, [teenNo])).length === 1 &&
  (await as("authenticated", co, `select id from routines where child_id = $1`, [teenNo])).length === 1 &&
  (await as("authenticated", co, `select s.id from routine_steps s join routines r on r.id = s.routine_id where r.child_id = $1`, [teenNo])).length === 1 &&
  (await as("authenticated", co, `select id from reminders where child_id = $1`, [teenNo])).length === 1);
ok("...and can still set up routines and reminders for them",
  (await as("authenticated", primary, `insert into reminders (child_id, kind, title, time_of_day, timezone) values ($1, 'wellness', 'Breathe', '18:00', 'UTC') returning id`, [teenNo])).length === 1);
ok("caregivers can read the sharing choice itself",
  (await as<{ s: boolean }>("authenticated", co, `select shares_with_caregiver s from children where id = $1`, [teenNo]))[0].s === false);

// ---------------------------------------------------------------------------
// 4. Private notes
// ---------------------------------------------------------------------------
ok("new private notes are refused for every child, mood and journal",
  (await err("service_role", "", `insert into mood_checkins (child_id, mood, is_private_note) values ($1, 'sad', true)`, [kid10])).includes("invalid_input") &&
  (await err("service_role", "", `insert into journal_entries (child_id, content, is_private_note) values ($1, 'x', true)`, [teenYes])).includes("invalid_input"));
const plain = (await one<{ id: string }>(`select id from journal_entries where child_id = $1`, [kid10])).id;
ok("no client role can update a journal entry at all",
  (await err("service_role", "", `update journal_entries set is_private_note = true where id = $1`, [plain])).includes("permission denied"));
let ownerUpdate = "no_error";
try { await db.query(`update journal_entries set is_private_note = true where id = $1`, [plain]); } catch (e) { ownerUpdate = (e as Error).message; }
ok("even the table owner can't turn an existing entry into a private note (trigger)", ownerUpdate.includes("invalid_input"));
await db.exec(`set session_replication_role = replica`);
await db.query(`insert into mood_checkins (child_id, mood, note, is_private_note) values ($1, 'sad', 'legacy private', true)`, [kid10]);
await db.exec(`set session_replication_role = origin`);
ok("a legacy private note stays hidden from caregivers, even under 15",
  !(await as<{ note: string }>("authenticated", primary, `select note from mood_checkins where child_id = $1`, [kid10]))
    .some((r) => r.note === "legacy private"));

// ---------------------------------------------------------------------------
// 5. The sharing choice: the young person only, 15 or over
// ---------------------------------------------------------------------------
ok("under 15 the choice can't be set", (await err("service_role", "", `select set_child_sharing($1, false)`, [kid10])).includes("sharing_not_available_under_15"));
ok("caregivers can't set it (server only), nor read raw statuses",
  (await err("authenticated", primary, `select set_child_sharing($1, true)`, [teenNo])).includes("permission denied") &&
  (await err("authenticated", primary, `select child_sharing_status($1)`, [teenNo])).includes("permission denied") &&
  (await err("authenticated", primary, `update children set shares_with_caregiver = true where id = $1`, [teenNo])).includes("permission denied"));
const back = (await as<{ s: string }>("service_role", "", `select set_child_sharing($1, true) s`, [teenNo]))[0].s;
ok("the young person changes their mind: shared again, and caregivers see activity again",
  back === "shared" && (await as("authenticated", primary, gated["mood check-ins"], [teenNo])).length === 1);
await as("service_role", "", `select set_child_sharing($1, false)`, [teenNo]);
ok("a null choice is refused", (await err("service_role", "", `select set_child_sharing($1, null)`, [teenNo])).includes("invalid_input"));

// ---------------------------------------------------------------------------
// 6. Changing a child
// ---------------------------------------------------------------------------
await as("authenticated", primary, `select update_child($1, p_name => '  Ten Renamed ', p_birth_year => $2, p_birth_month => $3)`, [kid10, yearsAgo(11), month]);
const renamed = await one<{ name: string; age: number; privacy_tier: string }>(`select name, age, privacy_tier from children where id = $1`, [kid10]);
ok("the primary renames and corrects the birth date; legacy age/privacy_tier follow",
  renamed.name === "Ten Renamed" && renamed.age === 11 && renamed.privacy_tier === "full");
ok("a co-caregiver can't change name or birth date",
  (await err("authenticated", co, `select update_child($1, p_name => 'x')`, [kid10])).includes("not_primary_caregiver") &&
  (await err("authenticated", co, `select update_child($1, p_birth_year => 2015)`, [kid10])).includes("not_primary_caregiver"));
await as("authenticated", co, `select update_child($1, p_theme => 'trains', p_low_sensory_default => true)`, [kid10]);
const look = await one<{ theme: string; l: boolean }>(`select theme, low_sensory_default l from children where id = $1`, [kid10]);
ok("any caregiver sets the theme and low-sensory default", look.theme === "trains" && look.l === true);
await as("authenticated", co, `select update_child($1, p_theme => '')`, [kid10]);
ok("an empty theme clears it", (await one<{ theme: string | null }>(`select theme from children where id = $1`, [kid10])).theme === null);
ok("invalid values are refused: unknown theme, age 3, age 18, a future month, a blank name",
  (await err("authenticated", co, `select update_child($1, p_theme => 'jungle')`, [kid10])).includes("invalid_input") &&
  (await err("authenticated", primary, `select update_child($1, p_birth_year => $2, p_birth_month => $3)`, [kid10, yearsAgo(3), month])).includes("invalid_input") &&
  (await err("authenticated", primary, `select update_child($1, p_birth_year => $2, p_birth_month => $3)`, [kid10, yearsAgo(18), month])).includes("invalid_input") &&
  (await err("authenticated", primary, `select update_child($1, p_birth_year => $2, p_birth_month => 12)`, [kid10, new Date().getUTCFullYear() + 1])).includes("invalid_input") &&
  (await err("authenticated", primary, `select update_child($1, p_name => '   ')`, [kid10])).includes("invalid_input"));
ok("a stranger can't change the child (not_found)",
  (await err("authenticated", stranger, `select update_child($1, p_theme => 'ocean')`, [kid10])).includes("not_found"));
await as("authenticated", primary, `select update_child($1, p_birth_year => $2, p_birth_month => $3)`, [kid10, yearsAgo(15), month]);
ok("correcting a birth date to 15 moves the child to 'not asked yet' (still shared)", (await status(kid10)) === "not_asked");
await as("authenticated", primary, `select update_child($1, p_birth_year => $2, p_birth_month => $3)`, [kid10, yearsAgo(10), month]);

await as("authenticated", co, `select set_child_modules($1, '{adhd,anxiety,adhd}')`, [kid10]);
ok("any caregiver replaces the module list (duplicates ignored)",
  (await as<{ m: string }>("authenticated", primary, `select module_key m from child_modules where child_id = $1 order by 1`, [kid10]))
    .map((r) => r.m).join() === "adhd,anxiety");
ok("unknown modules and strangers are refused",
  (await err("authenticated", co, `select set_child_modules($1, '{adhd,nope}')`, [kid10])).includes("invalid_input") &&
  (await err("authenticated", stranger, `select set_child_modules($1, '{adhd}')`, [kid10])).includes("not_found"));

// ---------------------------------------------------------------------------
// 7. Creating children
// ---------------------------------------------------------------------------
const v2 = await one<{ birth_year: number; birth_month: number; age: number; privacy_tier: string }>(
  `select birth_year, birth_month, age, privacy_tier from children where id = $1`, [teenYes]);
ok("create_child with birth month/year stores them and fills the legacy columns",
  v2.birth_year === yearsAgo(16) && v2.birth_month === month && v2.age === 16 && v2.privacy_tier === "private");
const v1 = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Old API', 9, $2, '{}') id`, [primary, await hashPin("1357")]))[0].id;
const v1row = await one<{ birth_year: number; age: number }>(`select birth_year, age from children where id = $1`, [v1]);
ok("the old create_child(age) still works, approximating the birth month/year", v1row.birth_year === yearsAgo(9) && v1row.age === 9);
ok("create_child refuses a birth date outside ages 4 to 17",
  (await err("service_role", "", `select create_child($1, 'x', $2, $3, $4, '{}')`, [primary, yearsAgo(2), month, hash])).includes("invalid_input") &&
  (await err("service_role", "", `select create_child($1, 'x', $2, $3, $4, '{}')`, [primary, yearsAgo(19), month, hash])).includes("invalid_input"));
const direct = (await one<{ id: string }>(`insert into children (caregiver_id, name, age, pin_hash) values ($1, 'Seed', 7, 'h') returning id`, [primary])).id;
ok("a direct insert with only an age gets an approximate birth month/year",
  (await one<{ birth_year: number }>(`select birth_year from children where id = $1`, [direct])).birth_year === yearsAgo(7));

// ---------------------------------------------------------------------------
// 8. Function privileges
// ---------------------------------------------------------------------------
{
  const fn = async (role: string, sig: string) =>
    (await db.query<{ h: boolean }>(`select has_function_privilege($1, $2, 'EXECUTE') h`, [role, sig])).rows[0].h;
  const serverOnly = ["public.set_child_sharing(uuid, boolean)", "public.child_sharing_status(uuid, date)",
    "public.create_child(uuid, text, integer, integer, text, text[])", "public.create_child(uuid, text, integer, text, text[])"];
  const caregiverFns = ["public.update_child(uuid, text, integer, integer, text, boolean)", "public.set_child_modules(uuid, text[])",
    "public.caregiver_can_see_child_activity(uuid)"];
  const internal = ["public.legacy_privacy_tier(integer, integer)", "public.check_child_birth(integer, integer)",
    "public.fill_child_birth_from_age()"];
  let good = true;
  for (const f of serverOnly) good &&= (await fn("service_role", f)) && !(await fn("authenticated", f)) && !(await fn("anon", f));
  for (const f of caregiverFns) good &&= (await fn("authenticated", f)) && !(await fn("anon", f));
  for (const f of internal) good &&= !(await fn("authenticated", f)) && !(await fn("anon", f));
  ok("function privileges: server-only, caregiver and internal functions are each limited correctly", good);
}
