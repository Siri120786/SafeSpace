// A child's own theme and the caregiver's lock (migration 20261030300000)
// under the hosted project's default privileges: the child picks through the
// child-settings function (service role) unless a caregiver has locked it;
// any caregiver of the child can lock or unlock; nobody else can.
// Usage: npx tsx supabase/tests/child_theme_lock.test.mts
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
const state = async (id: string) =>
  (await db.query<{ theme: string | null; theme_locked: boolean }>(`select theme, theme_locked from children where id = $1`, [id])).rows[0];

const carer = await mk("caregiver");
const stranger = await mk("caregiver");
const year = new Date().getUTCFullYear();
const month = new Date().getUTCMonth() + 1;
const kid = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Kid', $2, $3, $4, '{}') id`,
  [carer, year - 9, month, await hashPin("4826")]))[0].id;

ok("a new child's theme is unlocked", (await state(kid)).theme_locked === false);

// The child's own pick (service role, as the child-settings function).
await as("service_role", "", `select set_child_own_theme($1, 'space')`, [kid]);
ok("the child picks their own theme", (await state(kid)).theme === "space");
ok("only the seven themes are accepted",
  (await err("service_role", "", `select set_child_own_theme($1, 'pirates')`, [kid])).includes("invalid_input") &&
  (await err("service_role", "", `select set_child_own_theme($1, null)`, [kid])).includes("invalid_input"));
ok("an unknown child is not_found",
  (await err("service_role", "", `select set_child_own_theme('00000000-0000-4000-8000-000000000000', 'space')`)).includes("not_found"));
ok("signed-in users can't call the child's pick directly",
  (await err("authenticated", carer, `select set_child_own_theme($1, 'ocean')`, [kid])).includes("permission denied") &&
  (await err("anon", "", `select set_child_own_theme($1, 'ocean')`, [kid])).includes("permission denied"));

// The caregiver's lock.
await as("authenticated", carer, `select set_child_theme_lock($1, true)`, [kid]);
ok("a caregiver locks the theme", (await state(kid)).theme_locked === true);
ok("the child can't change a locked theme",
  (await err("service_role", "", `select set_child_own_theme($1, 'ocean')`, [kid])).includes("theme_locked") &&
  (await state(kid)).theme === "space");
await as("authenticated", carer, `select update_child($1, null, null, null, 'animals', null)`, [kid]);
ok("the caregiver can still set it while locked", (await state(kid)).theme === "animals");
ok("a stranger can't lock or unlock it",
  (await err("authenticated", stranger, `select set_child_theme_lock($1, false)`, [kid])).includes("not_found") &&
  (await state(kid)).theme_locked === true);
ok("anon can't lock it", (await err("anon", "", `select set_child_theme_lock($1, false)`, [kid])).includes("permission denied"));
ok("caregivers read the lock",
  (await as<{ theme_locked: boolean }>("authenticated", carer, `select theme_locked from children where id = $1`, [kid]))[0]?.theme_locked === true);
await as("authenticated", carer, `select set_child_theme_lock($1, false)`, [kid]);
await as("service_role", "", `select set_child_own_theme($1, 'nature')`, [kid]);
ok("once unlocked, the child picks again", (await state(kid)).theme === "nature" && (await state(kid)).theme_locked === false);
