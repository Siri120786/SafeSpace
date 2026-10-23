// Alerts, PIN reset with session versions, and the reminder heads-up
// (migration 20261027200000, role-flow M3), under the hosted project's default
// privileges.
// Usage: npx tsx supabase/tests/alerts_sessions.test.mts
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
const mk = async (role: string) =>
  (await db.query<{ id: string }>(`insert into auth.users (raw_user_meta_data) values ($1::jsonb) returning id`,
    [JSON.stringify({ role })])).rows[0].id;
const one = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

const primary = await mk("caregiver");
const co = await mk("caregiver");
const stranger = await mk("caregiver");
const year = new Date().getUTCFullYear();
const month = new Date().getUTCMonth() + 1;
const kid = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Kid', $2, $3, $4, '{}') id`,
  [primary, year - 9, month, await hashPin("4826")]))[0].id;
const teen = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Teen', $2, $3, $4, '{}') id`,
  [primary, year - 16, month, await hashPin("5937")]))[0].id;
await as("service_role", "", `select set_child_sharing($1, false)`, [teen]);
for (const k of [kid, teen]) {
  await as("authenticated", co, `select accept_caregiver_invite($1)`,
    [(await as<{ code: string }>("authenticated", primary, `select code from create_caregiver_invite($1)`, [k]))[0].code]);
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
const raise = async (child: string) => (await as<{ id: string }>("service_role", "", `select raise_help_alert($1) id`, [child]))[0].id;
const a1 = await raise(kid);
const a1again = await raise(kid);
ok("'I need help' raises an alert; a second tap within 2 minutes returns the same one",
  !!a1 && a1 === a1again && (await one<{ n: number }>(`select count(*)::int n from emergency_events where child_id = $1`, [kid])).n === 1);
ok("the alert is an 'aac_tap' event, marked as notified (in-app)",
  (await one<{ t: string; n: string | null }>(`select triggered_by t, caregiver_notified_at n from emergency_events where id = $1`, [a1])).t === "aac_tap" &&
  (await one<{ n: string | null }>(`select caregiver_notified_at n from emergency_events where id = $1`, [a1])).n !== null);
await db.query(`update emergency_events set created_at = now() - interval '3 minutes' where id = $1`, [a1]);
const a2 = await raise(kid);
ok("after 2 minutes a new tap raises a new alert", a2 !== a1);
const teenAlert = await raise(teen);
ok("an unknown child can't raise an alert", (await err("service_role", "", `select raise_help_alert(gen_random_uuid())`)).includes("not_found"));

const seen = async (uid: string, child: string) =>
  (await as<{ id: string }>("authenticated", uid, `select id from emergency_events where child_id = $1`, [child])).length;
ok("primary and co-caregiver see the child's alerts", (await seen(primary, kid)) === 2 && (await seen(co, kid)) === 2);
ok("alerts reach caregivers even when a 15+ child has chosen not to share",
  (await seen(primary, teen)) === 1 && (await seen(co, teen)) === 1 &&
  (await as("authenticated", primary, `select 1 from mood_checkins where child_id = $1`, [teen])).length === 0);
ok("a stranger sees none", (await seen(stranger, kid)) === 0);
ok("clients can't raise, write or edit alerts directly",
  (await err("authenticated", primary, `select raise_help_alert($1)`, [kid])).includes("permission denied") &&
  (await err("authenticated", primary, `insert into emergency_events (child_id, triggered_by) values ($1, 'aac_tap')`, [kid])).includes("permission denied") &&
  (await err("authenticated", primary, `update emergency_events set reviewed_at = now() where id = $1`, [a1])).includes("permission denied") &&
  (await err("anon", "", `select * from emergency_events`)).includes("permission denied"));

await as("authenticated", co, `select mark_alert_reviewed($1)`, [a2]);
const r1 = await one<{ at: string | null; by: string | null }>(`select reviewed_at at, reviewed_by by from emergency_events where id = $1`, [a2]);
ok("any caregiver marks an alert reviewed, recording who", r1.at !== null && r1.by === co);
await as("authenticated", primary, `select mark_alert_reviewed($1)`, [a2]);
ok("marking it again keeps the first reviewer",
  (await one<{ by: string }>(`select reviewed_by by from emergency_events where id = $1`, [a2])).by === co);
ok("a stranger can't mark it, and an unknown alert is not_found",
  (await err("authenticated", stranger, `select mark_alert_reviewed($1)`, [teenAlert])).includes("not_found") &&
  (await err("authenticated", primary, `select mark_alert_reviewed(gen_random_uuid())`)).includes("not_found"));
let badSource = "no_error";
try { await db.query(`insert into emergency_events (child_id, triggered_by) values ($1, 'bogus')`, [kid]); } catch (e) { badSource = (e as Error).message; }
ok("alert sources are limited to the known kinds", badSource.includes("emergency_events_triggered_by_check"));

// ---------------------------------------------------------------------------
// PIN reset and session versions
// ---------------------------------------------------------------------------
const version = async (child: string) => (await one<{ v: number }>(`select session_version v from children where id = $1`, [child])).v;
ok("children start at session version 1", (await version(kid)) === 1);
ok("caregiver_role_for_child (server only) reports primary, co-caregiver or nothing",
  (await as<{ r: string }>("service_role", "", `select caregiver_role_for_child($1, $2) r`, [kid, primary]))[0].r === "primary" &&
  (await as<{ r: string }>("service_role", "", `select caregiver_role_for_child($1, $2) r`, [kid, co]))[0].r === "co_caregiver" &&
  (await as<{ r: string | null }>("service_role", "", `select caregiver_role_for_child($1, $2) r`, [kid, stranger]))[0].r === null);
const newHash = await hashPin("1357");
await as("service_role", "", `select reset_child_pin($1, $2, $3)`, [kid, primary, newHash]);
ok("the primary resets the PIN: new hash stored, session version bumped (old sessions end)",
  (await one<{ h: string }>(`select pin_hash h from children where id = $1`, [kid])).h === newHash && (await version(kid)) === 2);
ok("a co-caregiver or stranger can't reset it; a malformed hash is refused",
  (await err("service_role", "", `select reset_child_pin($1, $2, $3)`, [kid, co, newHash])).includes("not_primary_caregiver") &&
  (await err("service_role", "", `select reset_child_pin($1, $2, $3)`, [kid, stranger, newHash])).includes("not_found") &&
  (await err("service_role", "", `select reset_child_pin($1, $2, 'h')`, [kid, primary])).includes("invalid_input") &&
  (await version(kid)) === 2);
ok("clients can't call the PIN or alert server functions",
  (await err("authenticated", primary, `select reset_child_pin($1, $2, $3)`, [kid, primary, newHash])).includes("permission denied") &&
  (await err("authenticated", primary, `select caregiver_role_for_child($1, $2)`, [kid, primary])).includes("permission denied") &&
  (await err("authenticated", primary, `select session_version from children where id = $1`, [kid])).includes("permission denied"));

// ---------------------------------------------------------------------------
// Reminder heads-up
// ---------------------------------------------------------------------------
const rem = (await as<{ id: string; l: number }>("authenticated", co,
  `insert into reminders (child_id, kind, title, time_of_day, timezone, lead_minutes) values ($1, 'wellness', 'Breathe', '18:00', 'UTC', 15) returning id, lead_minutes l`, [kid]))[0];
ok("a caregiver sets a 15-minute heads-up on a reminder", rem.l === 15);
ok("heads-ups are 0 to 120 minutes",
  (await err("authenticated", co, `update reminders set lead_minutes = 121 where id = $1`, [rem.id])).includes("check") &&
  (await err("authenticated", co, `update reminders set lead_minutes = -1 where id = $1`, [rem.id])).includes("check") &&
  (await one<{ l: number }>(`insert into reminders (child_id, kind, title, time_of_day, timezone) values ($1, 'water', 'Water', '09:00', 'UTC') returning lead_minutes l`, [kid])).l === 0);
