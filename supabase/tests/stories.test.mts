// Caregiver-made stories (migration 20261028000000, role-flow 6b) under the
// hosted project's default privileges.
// Usage: npx tsx supabase/tests/stories.test.mts
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
const denied = async (role: string, uid: string, sql: string, params: unknown[] = []) =>
  (await err(role, uid, sql, params)).includes("permission denied");
const mk = async (role: string) =>
  (await db.query<{ id: string }>(`insert into auth.users (raw_user_meta_data) values ($1::jsonb) returning id`,
    [JSON.stringify({ role })])).rows[0].id;

const primary = await mk("caregiver");
const co = await mk("caregiver");
const stranger = await mk("caregiver");
const adult = await mk("user");
const year = new Date().getUTCFullYear();
const kid = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Kid', $2, 1, $3, '{}') id`,
  [primary, year - 8, await hashPin("4826")]))[0].id;
const code = (await as<{ code: string }>("authenticated", primary, `select code from create_caregiver_invite($1)`, [kid]))[0].code;
await as("authenticated", co, `select accept_caregiver_invite($1)`, [code]);

const script = JSON.stringify({ id: "s", title: { en: "A", te: "A" }, summary: { en: "", te: "" }, scenes: [] });
const insertStory = (author: string, title: string) =>
  as<{ id: string }>("service_role", "", `insert into stories (author_id, title, script, source) values ($1, $2, $3::jsonb, 'template') returning id`,
    [author, title, script]);
const published = (await insertStory(primary, "Published"))[0].id;
const draft = (await insertStory(primary, "Draft"))[0].id;
const adultOwn = (await insertStory(adult, "Mine"))[0].id;
await as("service_role", "", `insert into story_children (story_id, child_id) values ($1, $2)`, [published, kid]);
ok("the stories function (service role) writes stories and publishes them", true);

const titles = async (uid: string) =>
  (await as<{ title: string }>("authenticated", uid, `select title from stories order by title`)).map((r) => r.title).join(",");
ok("the author reads their drafts and published stories", (await titles(primary)) === "Draft,Published");
ok("a co-caregiver reads only what's published to their child", (await titles(co)) === "Published");
ok("a stranger reads nothing", (await titles(stranger)) === "");
ok("an Individual reads their own stories", (await titles(adult)) === "Mine");
ok("anon can't read stories", await denied("anon", "", `select * from stories`));
ok("who a story is published to: the child's caregivers and the author see it; a stranger doesn't",
  (await as("authenticated", co, `select * from story_children`)).length === 1 &&
  (await as("authenticated", primary, `select * from story_children`)).length === 1 &&
  (await as("authenticated", stranger, `select * from story_children`)).length === 0);

ok("clients can't write stories or publish them",
  await denied("authenticated", primary, `insert into stories (author_id, title, script, source) values ($1, 'x', '{}', 'manual')`, [primary]) &&
  await denied("authenticated", primary, `update stories set title = 'x' where id = $1`, [draft]) &&
  await denied("authenticated", primary, `delete from stories where id = $1`, [draft]) &&
  await denied("authenticated", primary, `insert into story_children (story_id, child_id) values ($1, $2)`, [draft, kid]) &&
  await denied("authenticated", co, `delete from story_children where story_id = $1`, [published]));

const bad = async (sql: string, params: unknown[]) => (await err("service_role", "", sql, params)) !== "no_error";
ok("a story needs a title, a JSON object script and a known source",
  await bad(`insert into stories (author_id, title, script, source) values ($1, ' ', '{}', 'manual')`, [primary]) &&
  await bad(`insert into stories (author_id, title, script, source) values ($1, 'x', '[]', 'manual')`, [primary]) &&
  await bad(`insert into stories (author_id, title, script, source) values ($1, 'x', '{}', 'magic')`, [primary]) &&
  await bad(`insert into stories (author_id, title, script, source, template_key) values ($1, 'x', '{}', 'template', 'Bad Key!')`, [primary]));

await db.query(`delete from children where id = $1`, [kid]);
ok("deleting a child removes what was published to them, not the story",
  (await db.query(`select 1 from story_children where story_id = $1`, [published])).rows.length === 0 &&
  (await db.query(`select 1 from stories where id = $1`, [published])).rows.length === 1);

// ---------------------------------------------------------------------------
// Daily cap on Gemini drafts
// ---------------------------------------------------------------------------
const take = async (uid: string, limit = 3) =>
  (await as<{ ok: boolean }>("service_role", "", `select story_writer_take_slot($1, $2) ok`, [uid, limit]))[0].ok;
const run = [await take(primary), await take(primary), await take(primary), await take(primary)];
ok("the draft cap allows up to the limit, then refuses", run.join() === "true,true,true,false");
ok("each adult has their own cap", await take(co));
await db.query(`update story_writer_attempts set attempted_at = now() - interval '25 hours' where profile_id = $1`, [primary]);
ok("after 24 hours the cap frees up again", await take(primary));
ok("clients can't take a slot or read the attempt log",
  (await denied("authenticated", primary, `select story_writer_take_slot($1, 10)`, [primary])) &&
  (await denied("authenticated", primary, `select * from story_writer_attempts`)) &&
  (await denied("anon", "", `select story_writer_take_slot($1, 10)`, [primary])));
ok("the cap refuses nonsense limits",
  (await err("service_role", "", `select story_writer_take_slot($1, 0)`, [primary])).includes("invalid input") &&
  (await err("service_role", "", `select story_writer_take_slot(null, 5)`)).includes("invalid input"));
