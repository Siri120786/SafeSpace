// Several caregivers per child (migration 20261027000000, role-flow M1), under
// the hosted project's default privileges: backfill of existing children,
// invites (hashed, single use, 48 h, primary only, at most 5 open), joining,
// leaving and removal, what a co-caregiver can and can't do, that a removed
// caregiver loses access at once, and that clients can't touch the new tables.
// Usage: npx tsx supabase/tests/child_caregivers.test.mts
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hashPin } from "../functions/_shared/pin.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const M1 = "20261027000000_child_caregivers.sql";
const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

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
const run = async (list: string[]) => { for (const f of list) await db.exec(readFileSync(dir + f, "utf8")); };

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
// Backfill: a child created before M1 gets its caregiver as primary.
// ---------------------------------------------------------------------------
await run(files.filter((f) => f < M1));
const cgOld = await mk("caregiver");
const oldKid = (await one<{ id: string }>(
  `insert into children (caregiver_id, name, age, pin_hash) values ($1, 'Old kid', 9, 'h') returning id`, [cgOld])).id;
await run(files.filter((f) => f >= M1));
ok("all migrations apply under hosted default privileges", true);
ok("backfill: an existing child's caregiver becomes its primary",
  (await one<{ role: string }>(`select role from child_caregivers where child_id = $1 and caregiver_id = $2`, [oldKid, cgOld]))?.role === "primary");

// Fixtures
const primary = await mk("caregiver");
const coA = await mk("caregiver");
const coB = await mk("caregiver");
const stranger = await mk("caregiver");
const adult = await mk("user");
const hash = await hashPin("4826");
const kid = (await as<{ id: string }>("service_role", "",
  `select create_child($1, 'Asha', 10, $2, '{autism}') id`, [primary, hash]))[0].id;
await db.query(`insert into mood_checkins (child_id, mood) values ($1, 'happy')`, [kid]);
await db.query(`insert into journal_entries (child_id, content) values ($1, 'kid entry')`, [kid]);
await db.query(`insert into emergency_events (child_id, triggered_by) values ($1, 'aac_tap')`, [kid]);
const conv = (await one<{ id: string }>(`insert into ai_companion_conversations (child_id) values ($1) returning id`, [kid])).id;
await db.query(`insert into ai_companion_messages (conversation_id, sender, content) values ($1, 'user', 'hi')`, [conv]);

ok("a new child gets its creator as primary (trigger)",
  (await one<{ role: string }>(`select role from child_caregivers where child_id = $1 and caregiver_id = $2`, [kid, primary]))?.role === "primary");
ok("exactly one primary per child is enforced",
  (await err("postgres", "", `insert into child_caregivers (child_id, caregiver_id, role) values ($1, $2, 'primary')`, [kid, stranger]))
    .includes("duplicate key"));

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------
const invite = async (uid: string, child = kid) =>
  (await as<{ code: string; expires_at: string }>("authenticated", uid, `select * from create_caregiver_invite($1)`, [child]))[0];
const accept = (uid: string, code: string) => as<{ c: string }>("authenticated", uid, `select accept_caregiver_invite($1) c`, [code]);
const acceptErr = (uid: string, code: string) => err("authenticated", uid, `select accept_caregiver_invite($1)`, [code]);

const inv1 = await invite(primary);
const hours = (Date.parse(inv1.expires_at) - Date.now()) / 3_600_000;
ok("the primary creates an 8-character code from an unambiguous alphabet, valid 48 hours",
  /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(inv1.code) && hours > 47.9 && hours <= 48);
ok("only a hash of the code is stored",
  (await one<{ n: number }>(`select count(*)::int n from caregiver_invites where code_hash = $1`, [inv1.code])).n === 0 &&
  (await one<{ n: number }>(`select count(*)::int n from caregiver_invites where code_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex')`, [inv1.code])).n === 1);
ok("a stranger can't create an invite for the child (not_found)", (await err("authenticated", stranger, `select * from create_caregiver_invite($1)`, [kid])).includes("not_found"));

ok("an Individual (not a caregiver) can't accept", (await acceptErr(adult, inv1.code)).includes("not_a_caregiver"));
ok("a wrong code is refused", (await acceptErr(coA, "ZZZZZZZZ")).includes("invite_invalid"));
const joined = await accept(coA, inv1.code.toLowerCase().replace(/(.{4})/, "$1-"));
ok("a caregiver joins with the code (case and dashes ignored), returning the child id", joined[0].c === kid);
ok("they are now a co-caregiver",
  (await one<{ role: string }>(`select role from child_caregivers where child_id = $1 and caregiver_id = $2`, [kid, coA]))?.role === "co_caregiver");
ok("a used code can't be used again", (await acceptErr(coB, inv1.code)).includes("invite_invalid"));
ok("a co-caregiver can't create invites", (await err("authenticated", coA, `select * from create_caregiver_invite($1)`, [kid])).includes("not_primary_caregiver"));

const inv2 = await invite(primary);
ok("accepting again for a child you already care for is refused, and the code stays usable",
  (await acceptErr(coA, inv2.code)).includes("already_caregiver") &&
  (await one<{ u: string | null }>(`select used_at u from caregiver_invites where code_hash = caregiver_invite_hash($1)`, [inv2.code])).u === null);
await db.query(`update caregiver_invites set expires_at = now() - interval '1 second' where code_hash = caregiver_invite_hash($1)`, [inv2.code]);
ok("an expired code is refused", (await acceptErr(coB, inv2.code)).includes("invite_invalid"));
for (let i = 0; i < 5; i++) await invite(primary);
ok("at most 5 open invites per child", (await err("authenticated", primary, `select * from create_caregiver_invite($1)`, [kid])).includes("rate_limited"));
await db.query(`delete from caregiver_invites where child_id = $1 and used_at is null`, [kid]);
await accept(coB, (await invite(primary)).code);

// ---------------------------------------------------------------------------
// What co-caregivers can do (same as the primary, through RLS)
// ---------------------------------------------------------------------------
const sees = async (uid: string, sql: string, params: unknown[] = []) => (await as(uid === "" ? "anon" : "authenticated", uid, sql, params)).length;
ok("a co-caregiver sees the child and its modules",
  (await sees(coA, `select id from children where id = $1`, [kid])) === 1 &&
  (await sees(coA, `select module_key from child_modules where child_id = $1`, [kid])) === 1);
ok("...the child's activity (mood, journal, AI chats) under the current rules",
  (await sees(coA, `select id from mood_checkins where child_id = $1`, [kid])) === 1 &&
  (await sees(coA, `select id from journal_entries where child_id = $1`, [kid])) === 1 &&
  (await sees(coA, `select id from ai_companion_conversations where child_id = $1`, [kid])) === 1 &&
  (await sees(coA, `select m.id from ai_companion_messages m where m.conversation_id = $1`, [conv])) === 1);
// Alerts (emergency_events) get their client grant in M3; covered by its tests.
const routine = (await as<{ id: string }>("authenticated", coA,
  `select create_routine_with_steps($1, 'Morning', null, '{}', '[{"label":"Brush teeth"}]'::jsonb) id`, [kid]))[0].id;
const reminder = (await as<{ id: string }>("authenticated", coA,
  `insert into reminders (child_id, kind, title, time_of_day, timezone) values ($1, 'water', 'Water', '09:00', 'UTC') returning id`, [kid]))[0].id;
ok("a co-caregiver sets up routines and reminders for the child", !!routine && !!reminder &&
  (await sees(primary, `select id from routines where child_id = $1`, [kid])) === 1);
ok("both caregivers see the family code the child signs in with (the primary's)",
  (await as<{ c: string }>("authenticated", coA, `select child_family_code($1) c`, [kid]))[0].c ===
  (await one<{ c: string }>(`select family_code c from caregivers where id = $1`, [primary])).c);
const list = await as<{ caregiver_id: string; role: string }>("authenticated", coB, `select * from list_child_caregivers($1)`, [kid]);
ok("any caregiver lists who cares for the child, primary first",
  list.length === 3 && list[0].caregiver_id === primary && list[0].role === "primary" &&
  list.filter((r) => r.role === "co_caregiver").length === 2);

// ---------------------------------------------------------------------------
// Strangers and clients
// ---------------------------------------------------------------------------
ok("a stranger sees none of it",
  (await sees(stranger, `select id from children where id = $1`, [kid])) === 0 &&
  (await sees(stranger, `select id from mood_checkins where child_id = $1`, [kid])) === 0 &&
  (await sees(stranger, `select id from routines where child_id = $1`, [kid])) === 0 &&
  (await as<{ c: string | null }>("authenticated", stranger, `select child_family_code($1) c`, [kid]))[0].c === null &&
  (await err("authenticated", stranger, `select * from list_child_caregivers($1)`, [kid])).includes("not_found"));
ok("a stranger can't add routines for the child",
  (await err("authenticated", stranger, `insert into routines (child_id, title) values ($1, 'x')`, [kid])).includes("row-level security"));
ok("no client can read or write child_caregivers or caregiver_invites directly",
  (await err("authenticated", primary, `select * from child_caregivers`)).includes("permission denied") &&
  (await err("authenticated", primary, `select * from caregiver_invites`)).includes("permission denied") &&
  (await err("authenticated", primary, `insert into child_caregivers (child_id, caregiver_id, role) values ($1, $2, 'co_caregiver')`, [kid, stranger]))
    .includes("permission denied") &&
  (await err("anon", "", `select * from child_caregivers`)).includes("permission denied"));
ok("anon can't call any of the new functions",
  (await err("anon", "", `select is_caregiver_of($1)`, [kid])).includes("permission denied") &&
  (await err("anon", "", `select accept_caregiver_invite('ABCDEFGH')`)).includes("permission denied") &&
  (await err("anon", "", `select * from list_child_caregivers($1)`, [kid])).includes("permission denied"));

// ---------------------------------------------------------------------------
// Leaving and removal
// ---------------------------------------------------------------------------
ok("a co-caregiver can't remove the primary or another co-caregiver",
  (await err("authenticated", coA, `select remove_child_caregiver($1, $2)`, [kid, primary])).includes("invalid_input") &&
  (await err("authenticated", coA, `select remove_child_caregiver($1, $2)`, [kid, coB])).includes("not_primary_caregiver"));
ok("the primary can't remove themselves",
  (await err("authenticated", primary, `select remove_child_caregiver($1, $2)`, [kid, primary])).includes("invalid_input"));
await as("authenticated", coA, `select remove_child_caregiver($1, $2)`, [kid, coA]);
ok("a co-caregiver can leave, and loses access at once",
  (await sees(coA, `select id from children where id = $1`, [kid])) === 0 &&
  (await sees(coA, `select id from mood_checkins where child_id = $1`, [kid])) === 0 &&
  (await sees(coA, `select id from routines where child_id = $1`, [kid])) === 0);
await as("authenticated", primary, `select remove_child_caregiver($1, $2)`, [kid, coB]);
ok("the primary removes a co-caregiver, who loses access at once",
  (await sees(coB, `select id from children where id = $1`, [kid])) === 0 &&
  (await sees(coB, `select id from routines where child_id = $1`, [kid])) === 0);
ok("routines a removed co-caregiver set up stay with the child",
  (await sees(primary, `select id from routines where id = $1`, [routine])) === 1);
ok("removing someone who isn't a caregiver of the child is not_found",
  (await err("authenticated", primary, `select remove_child_caregiver($1, $2)`, [kid, stranger])).includes("not_found"));
