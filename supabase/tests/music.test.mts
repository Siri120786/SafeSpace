// Music in the database (migration 20261029000000, role-flow 9b/9c): hearted
// tracks and a child's music controls, under the hosted project's default
// privileges.
// Usage: npx tsx supabase/tests/music.test.mts
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
ok("all migrations apply (the music bucket is skipped where there is no Storage)", true);

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
const favs = async (role: string, uid: string) =>
  (await as<{ track_id: string }>(role, uid, `select track_id from music_favorites order by track_id`)).map((r) => r.track_id);

const caregiver = await mk("caregiver");
const stranger = await mk("caregiver");
const adult = await mk("user");
const otherAdult = await mk("user");
const year = new Date().getUTCFullYear();
const kid = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Kid', $2, 1, $3, '{}') id`,
  [caregiver, year - 8, await hashPin("4826")]))[0].id;

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------
await as("authenticated", adult, `insert into music_favorites (profile_id, track_id) values ($1, 'gentle-waves'), ($1, 'rhyme-twinkle-twinkle')`, [adult]);
ok("an adult hearts tracks and sees them", JSON.stringify(await favs("authenticated", adult)) === JSON.stringify(["gentle-waves", "rhyme-twinkle-twinkle"]));
ok("another adult doesn't see them", (await favs("authenticated", otherAdult)).length === 0);
ok("an adult can't heart for someone else",
  (await err("authenticated", otherAdult, `insert into music_favorites (profile_id, track_id) values ($1, 'deep-sea')`, [adult])).includes("row-level security"));
ok("an adult can't heart for a child",
  (await err("authenticated", caregiver, `insert into music_favorites (child_id, track_id) values ($1, 'deep-sea')`, [kid])).includes("row-level security"));
ok("the same track can't be hearted twice",
  (await err("authenticated", adult, `insert into music_favorites (profile_id, track_id) values ($1, 'gentle-waves')`, [adult])).includes("duplicate"));
ok("track ids are catalog ids only",
  (await err("authenticated", adult, `insert into music_favorites (profile_id, track_id) values ($1, 'Not An Id!')`, [adult])).includes("check"));
await as("authenticated", otherAdult, `delete from music_favorites where track_id = 'gentle-waves'`);
ok("another adult can't un-heart them", (await favs("authenticated", adult)).length === 2);
await as("authenticated", adult, `delete from music_favorites where track_id = 'gentle-waves'`);
ok("an adult un-hearts their own", JSON.stringify(await favs("authenticated", adult)) === JSON.stringify(["rhyme-twinkle-twinkle"]));

// A child's favorites go in through the function (service role).
await as("service_role", "", `insert into music_favorites (child_id, track_id) values ($1, 'sunny-marimba')`, [kid]);
ok("a child's favorites are kept", (await favs("service_role", "")).includes("sunny-marimba"));
ok("their caregiver can't see them (nothing about listening is shared)", (await favs("authenticated", caregiver)).length === 0);
ok("anon can't read favorites", (await err("anon", "", `select * from music_favorites`)).includes("permission denied"));
ok("anon can't add favorites",
  (await err("anon", "", `insert into music_favorites (profile_id, track_id) values ($1, 'deep-sea')`, [adult])).includes("permission denied"));
ok("adults can't change a favorite in place (only add or remove)",
  (await err("authenticated", adult, `update music_favorites set track_id = 'deep-sea'`)).includes("permission denied"));

for (let i = 0; i < 99; i++) {
  await as("service_role", "", `insert into music_favorites (child_id, track_id) values ($1, $2)`, [kid, `t-${i}`]);
}
ok("100 favorites per person, no more",
  (await err("service_role", "", `insert into music_favorites (child_id, track_id) values ($1, 'one-more')`, [kid])).includes("limit_reached"));

// ---------------------------------------------------------------------------
// A child's music controls
// ---------------------------------------------------------------------------
await as("authenticated", caregiver, `insert into tool_settings (child_id) values ($1)`, [kid]);
const defaults = (await as<{ music_enabled: boolean; music_volume_max: number | null; music_sleep_minutes: number | null }>(
  "authenticated", caregiver, `select music_enabled, music_volume_max, music_sleep_minutes from tool_settings where child_id = $1`, [kid]))[0];
ok("music starts on, with the default ceiling and no sleep timer",
  defaults.music_enabled === true && defaults.music_volume_max === null && defaults.music_sleep_minutes === null);
await as("authenticated", caregiver, `update tool_settings set music_enabled = false, music_volume_max = 40, music_sleep_minutes = 20 where child_id = $1`, [kid]);
const set = (await as<{ music_enabled: boolean; music_volume_max: number; music_sleep_minutes: number }>(
  "service_role", "", `select music_enabled, music_volume_max, music_sleep_minutes from tool_settings where child_id = $1`, [kid]))[0];
ok("a caregiver sets the child's music controls", set.music_enabled === false && set.music_volume_max === 40 && set.music_sleep_minutes === 20);
ok("the ceiling can't go above 60%",
  (await err("authenticated", caregiver, `update tool_settings set music_volume_max = 70 where child_id = $1`, [kid])).includes("check"));
ok("the sleep timer is 10, 20 or 30 minutes",
  (await err("authenticated", caregiver, `update tool_settings set music_sleep_minutes = 15 where child_id = $1`, [kid])).includes("check"));
await as("authenticated", stranger, `update tool_settings set music_enabled = true where child_id = $1`, [kid]);
ok("someone who isn't their caregiver can't change them",
  (await as<{ music_enabled: boolean }>("service_role", "", `select music_enabled from tool_settings where child_id = $1`, [kid]))[0].music_enabled === false);
