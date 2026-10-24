// Games Corner creations in the account (migration 20261029400000): private
// to the player, newest 12 kept, content checked, under the hosted project's
// default privileges.
// Usage: npx tsx supabase/tests/game_creations.test.mts
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
const ids = async (role: string, uid: string, where = "true") =>
  (await as<{ id: string }>(role, uid, `select id from game_creations where ${where} order by created_at, id`)).map((r) => r.id);

const adult = await mk("user");
const other = await mk("user");
const carer = await mk("caregiver");
const year = new Date().getUTCFullYear();
const kid = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Kid', $2, 1, $3, '{}') id`,
  [carer, year - 8, await hashPin("4826")]))[0].id;

const STORY = (text: string) => JSON.stringify({ story: { starterId: "s1", nextKey: "ic.story.s1.n1", endKey: "ic.story.s1.e1", ownText: text } });
const CHARACTER = (name: string) => JSON.stringify({ character: { body: "🦊", colorId: "mint", accessory: "👑", powerKey: "ic.power.kind", name } });

await as("authenticated", adult, `insert into game_creations (profile_id, id, kind, content) values ($1, 'story-1', 'story', $2::jsonb)`, [adult, STORY("The fox found a friend.")]);
ok("an adult keeps a creation and sees it", (await ids("authenticated", adult)).join() === "story-1");
ok("another adult doesn't see it", (await ids("authenticated", other)).length === 0);
ok("nobody can keep one for someone else",
  (await err("authenticated", other, `insert into game_creations (profile_id, id, kind, content) values ($1, 'story-2', 'story', $2::jsonb)`, [adult, STORY("x")])).includes("row-level security"));
await as("authenticated", other, `delete from game_creations where profile_id = $1`, [adult]);
ok("or remove someone else's", (await ids("authenticated", adult)).length === 1);

await as("service_role", "", `insert into game_creations (child_id, id, kind, content) values ($1, 'character-1', 'character', $2::jsonb)`, [kid, CHARACTER("Pip")]);
ok("a child's creations are kept (through the games function)", (await ids("service_role", "", `child_id = '${kid}'`)).join() === "character-1");
ok("their caregiver can't see them", (await ids("authenticated", carer)).length === 0);
ok("a caregiver can't add one for the child",
  (await err("authenticated", carer, `insert into game_creations (child_id, id, kind, content) values ($1, 'story-3', 'story', $2::jsonb)`, [kid, STORY("x")])).includes("row-level security"));
ok("anon can't read creations", (await err("anon", "", `select * from game_creations`)).includes("permission denied"));
ok("creations can't be changed in place (keep a new one instead)",
  (await err("authenticated", adult, `update game_creations set content = $1::jsonb`, [STORY("changed")])).includes("permission denied"));

ok("a name is at most 24 characters",
  (await err("authenticated", adult, `insert into game_creations (profile_id, id, kind, content) values ($1, 'character-2', 'character', $2::jsonb)`, [adult, CHARACTER("x".repeat(25))])).includes("check"));
ok("own story text is at most 240 characters",
  (await err("authenticated", adult, `insert into game_creations (profile_id, id, kind, content) values ($1, 'story-4', 'story', $2::jsonb)`, [adult, STORY("x".repeat(241))])).includes("check"));
ok("the content must match its kind",
  (await err("authenticated", adult, `insert into game_creations (profile_id, id, kind, content) values ($1, 'scene-1', 'scene', $2::jsonb)`, [adult, STORY("x")])).includes("check"));
ok("ids look like the game's own",
  (await err("authenticated", adult, `insert into game_creations (profile_id, id, kind, content) values ($1, 'DROP TABLE', 'story', $2::jsonb)`, [adult, STORY("x")])).includes("check"));
ok("the same creation can't be kept twice",
  (await err("authenticated", adult, `insert into game_creations (profile_id, id, kind, content) values ($1, 'story-1', 'story', $2::jsonb)`, [adult, STORY("again")])).includes("duplicate"));

for (let i = 2; i <= 13; i++) {
  await as("service_role", "", `insert into game_creations (child_id, id, kind, content, created_at) values ($1, $2, 'character', $3::jsonb, now() + ($4 || ' seconds')::interval)`,
    [kid, `character-${i}`, CHARACTER(`C${i}`), String(i)]);
}
const kept = await ids("service_role", "", `child_id = '${kid}'`);
ok("the newest 12 are kept; the oldest lets go", kept.length === 12 && !kept.includes("character-1") && kept.includes("character-13"));
ok("one player's limit doesn't touch another's", (await ids("authenticated", adult)).join() === "story-1");

await as("authenticated", adult, `delete from game_creations where id = 'story-1'`);
ok("an adult can remove their own", (await ids("authenticated", adult)).length === 0);
