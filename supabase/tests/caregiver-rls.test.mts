import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
import { fileURLToPath } from "node:url";

const db = new PGlite();
const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

await db.exec(`
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    raw_user_meta_data jsonb
  );
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  create role authenticated;
  grant usage on schema public, auth to authenticated;
`);

const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
for (const f of [
  "0001_init_schema.sql",
  "0002_pin_attempts.sql",
  "0003_profiles_and_roles.sql",
  "20261005152905_profile_onboarding.sql",
  "20261009170000_caregiver_user_links.sql",
]) {
  await db.exec(readFileSync(dir + f, "utf8"));
}
// NOTE: no blanket grant here, so this test also verifies the real grants.

const asUser = async <T,>(userId: string, sql: string) => {
  await db.exec(`set role authenticated; set app.uid = '${userId}';`);
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec(`reset role;`);
  }
};
const isBlocked = async (userId: string, sql: string) => {
  try {
    await asUser(userId, sql);
    return false;
  } catch {
    return true;
  }
};
const mk = async (role: string, name: string) =>
  (
    await db.query<{ id: string }>(
      `insert into auth.users (raw_user_meta_data) values ($1::jsonb) returning id`,
      [JSON.stringify({ role, display_name: name })],
    )
  ).rows[0].id;

const cgA = await mk("caregiver", "Caregiver A");
const cgB = await mk("caregiver", "Caregiver B");
const u1 = await mk("user", "Linked User");
const u2 = await mk("user", "Unrelated User");
const u3 = await mk("user", "Revoked User");

// Seed as superuser (service role equivalent).
await db.query(
  `insert into caregiver_user_links (caregiver_id, user_id, status)
   values ($1, $2, 'active'), ($1, $3, 'revoked')`,
  [cgA, u1, u3],
);
await db.query(
  `insert into profile_support_preferences (profile_id, support_areas)
   values ($1, ARRAY['autism','anxiety']), ($2, ARRAY['adhd']), ($3, ARRAY['ptsd'])`,
  [u1, u2, u3],
);
await db.query(
  `insert into profile_accessibility_preferences (profile_id, larger_text)
   values ($1, true), ($2, true), ($3, true)`,
  [u1, u2, u3],
);

// ---- caregiver can see linked user ----
const linkedProfile = await asUser<{ display_name: string }>(
  cgA, `select display_name from profiles where id = '${u1}'`);
ok("caregiver can see linked user's profile",
  linkedProfile.length === 1 && linkedProfile[0].display_name === "Linked User");

const linkedSupport = await asUser<{ support_areas: string[] }>(
  cgA, `select support_areas from profile_support_preferences where profile_id = '${u1}'`);
ok("caregiver can see linked user's support preferences",
  linkedSupport.length === 1 && linkedSupport[0].support_areas.includes("autism"));

const linkedAccess = await asUser(
  cgA, `select * from profile_accessibility_preferences where profile_id = '${u1}'`);
ok("caregiver can see linked user's accessibility preferences", linkedAccess.length === 1);

const links = await asUser(cgA, `select * from caregiver_user_links`);
ok("caregiver can read their own links", links.length === 2);

// ---- caregiver cannot see unrelated user ----
ok("caregiver cannot see unrelated user's profile",
  (await asUser(cgA, `select id from profiles where id = '${u2}'`)).length === 0);
ok("caregiver cannot see unrelated user's support preferences",
  (await asUser(cgA, `select 1 from profile_support_preferences where profile_id = '${u2}'`)).length === 0);
ok("caregiver cannot see unrelated user's accessibility preferences",
  (await asUser(cgA, `select 1 from profile_accessibility_preferences where profile_id = '${u2}'`)).length === 0);

// ---- revoked link grants nothing ----
ok("revoked link grants no access",
  (await asUser(cgA, `select id from profiles where id = '${u3}'`)).length === 0);

// ---- unlinked caregiver cannot access profile ----
ok("unlinked caregiver cannot read any linked/unrelated profile",
  (await asUser(cgB, `select id from profiles where id in ('${u1}','${u2}','${u3}')`)).length === 0);
ok("unlinked caregiver cannot read others' preferences",
  (await asUser(cgB, `select 1 from profile_support_preferences`)).length === 0 &&
  (await asUser(cgB, `select 1 from profile_accessibility_preferences`)).length === 0);
ok("unlinked caregiver sees no links",
  (await asUser(cgB, `select 1 from caregiver_user_links`)).length === 0);

// ---- caregiver cannot modify linked user ----
const upd = await asUser(cgA, `update profiles set display_name = 'Hacked' where id = '${u1}' returning id`);
ok("caregiver cannot modify linked user's profile", upd.length === 0);
const stored = await db.query<{ display_name: string }>(`select display_name from profiles where id = '${u1}'`);
ok("linked user's profile is unchanged", stored.rows[0].display_name === "Linked User");
ok("caregiver cannot modify linked user's support preferences",
  (await asUser(cgA, `update profile_support_preferences set support_areas = ARRAY['ptsd'] where profile_id = '${u1}' returning profile_id`)).length === 0);
ok("caregiver cannot modify linked user's accessibility preferences",
  (await asUser(cgA, `update profile_accessibility_preferences set larger_text = false where profile_id = '${u1}' returning profile_id`)).length === 0);

// ---- caregiver cannot create / alter / delete links ----
ok("caregiver cannot create a link",
  await isBlocked(cgA, `insert into caregiver_user_links (caregiver_id, user_id) values ('${cgA}', '${u2}')`));
ok("caregiver cannot delete a link",
  await isBlocked(cgA, `delete from caregiver_user_links where caregiver_id = '${cgA}'`));

// ---- linked user and unauthenticated ----
ok("linked user cannot read the caregiver's links",
  (await asUser(u1, `select 1 from caregiver_user_links`)).length === 0);
ok("unauthenticated access to profiles is denied",
  (await asUser("", `select 1 from profiles`)).length === 0);

// ---- existing behaviour still works ----
const own = await asUser<{ display_name: string }>(cgA, `select display_name from profiles where id = '${cgA}'`);
ok("caregiver can still read their own profile", own.length === 1 && own[0].display_name === "Caregiver A");
