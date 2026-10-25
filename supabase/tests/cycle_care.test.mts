// Cycle Care in the account (migrations 20261029300000 and 20261030100000,
// the tracker): only the person can
// read or change their own row, under the hosted project's default privileges.
// Usage: npx tsx supabase/tests/cycle_care.test.mts
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
const rows = async (role: string, uid: string) =>
  (await as<{ profile_id: string }>(role, uid, `select profile_id from cycle_care_data`)).length;

const me = await mk("user");
const other = await mk("user");
const caregiver = await mk("caregiver");
const year = new Date().getUTCFullYear();
await as("service_role", "", `select create_child($1, 'Kid', $2, 1, $3, '{}')`, [caregiver, year - 8, await hashPin("4826")]);

const DIET = JSON.stringify({ plan: { breakfast: ["Oats"] }, rewards: { stars: 2 } });
await as("authenticated", me, `insert into cycle_care_data (profile_id, condition, diet) values ($1, 'pcod', $2::jsonb)`, [me, DIET]);
await as("authenticated", me, `update cycle_care_data set exercise = '{"log":[]}'::jsonb, profile = '{"sleep":"ok"}'::jsonb where profile_id = $1`, [me]);
const mine = (await as<{ condition: string; diet: { plan: { breakfast: string[] } }; exercise: object }>(
  "authenticated", me, `select condition, diet, exercise from cycle_care_data`))[0];
ok("a person saves and reads back their own Cycle Care", mine.condition === "pcod" && mine.diet.plan.breakfast[0] === "Oats" && !!mine.exercise);

ok("another adult sees nothing", (await rows("authenticated", other)) === 0);
ok("a caregiver sees nothing", (await rows("authenticated", caregiver)) === 0);
ok("nobody can save for someone else",
  (await err("authenticated", other, `insert into cycle_care_data (profile_id, condition) values ($1, 'pcos')`, [me])).includes("row-level security"));
await as("authenticated", other, `update cycle_care_data set condition = 'pcos' where profile_id = $1`, [me]);
await as("authenticated", other, `delete from cycle_care_data where profile_id = $1`, [me]);
ok("or change or delete it", (await as<{ condition: string }>("authenticated", me, `select condition from cycle_care_data`))[0]?.condition === "pcod");
ok("anon can't read it", (await err("anon", "", `select * from cycle_care_data`)).includes("permission denied"));
ok("functions (service role) can't read it either", (await err("service_role", "", `select * from cycle_care_data`)).includes("permission denied"));

ok("the label is PCOS, PCOD or not sure",
  (await err("authenticated", me, `update cycle_care_data set condition = 'other' where profile_id = $1`, [me])).includes("check"));
ok("each part is an object",
  (await err("authenticated", me, `update cycle_care_data set diet = '[1,2]'::jsonb where profile_id = $1`, [me])).includes("check"));
ok("and at most 64 KB",
  (await err("authenticated", me, `update cycle_care_data set exercise = jsonb_build_object('x', repeat('a', 70000)) where profile_id = $1`, [me])).includes("check"));

await as("authenticated", me, `update cycle_care_data set tracker = '{"periods":[{"start":"2026-10-01","end":"2026-10-05"}],"days":[],"questions":[]}'::jsonb where profile_id = $1`, [me]);
ok("the tracker saves and reads back for its owner",
  (await as<{ tracker: { periods: { start: string }[] } }>("authenticated", me, `select tracker from cycle_care_data`))[0]?.tracker.periods[0].start === "2026-10-01");
ok("nobody else can read the tracker",
  (await as("authenticated", other, `select tracker from cycle_care_data where profile_id = $1`, [me])).length === 0);
ok("the tracker is an object of at most 64 KB too",
  (await err("authenticated", me, `update cycle_care_data set tracker = '"x"'::jsonb where profile_id = $1`, [me])).includes("check") &&
  (await err("authenticated", me, `update cycle_care_data set tracker = jsonb_build_object('x', repeat('a', 70000)) where profile_id = $1`, [me])).includes("check"));

await as("authenticated", me, `delete from cycle_care_data where profile_id = $1`, [me]);
ok("a person can delete all of it", (await rows("authenticated", me)) === 0);
