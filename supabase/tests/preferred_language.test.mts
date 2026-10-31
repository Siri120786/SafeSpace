// Language preference (migration 20261031200000) under the hosted project's
// default privileges.
// Usage: npx tsx supabase/tests/preferred_language.test.mts
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
const lang = async (table: string, id: string) =>
  (await db.query<{ l: string | null }>(`select preferred_language l from ${table} where id = $1`, [id])).rows[0].l;

const adult = await mk("user");
const other = await mk("user");
const cg = await mk("caregiver");
const year = new Date().getUTCFullYear();
const kid = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Kid', $2, $3, $4, '{}') id`,
  [cg, year - 9, 1, await hashPin("4826")]))[0].id;

ok("nobody has chosen yet: null", (await lang("profiles", adult)) === null && (await lang("children", kid)) === null);

await as("authenticated", adult, `update profiles set preferred_language = 'hi' where id = $1`, [adult]);
ok("an adult saves their own language", (await lang("profiles", adult)) === "hi");
await as("authenticated", adult, `update profiles set preferred_language = 'te' where id = $1`, [other]);
ok("an adult can't change someone else's", (await lang("profiles", other)) === null);
ok("only en, hi and te", /check constraint|violates/.test(await err("authenticated", adult, `update profiles set preferred_language = 'fr' where id = $1`, [adult])));
ok("the role column still can't be changed by the client",
  /permission denied/.test(await err("authenticated", adult, `update profiles set role = 'caregiver' where id = $1`, [adult])));

await as("service_role", "", `select set_child_language($1, 'te')`, [kid]);
ok("the child-settings function saves a child's language", (await lang("children", kid)) === "te");
ok("set_child_language refuses other languages", /invalid_input/.test(await err("service_role", "", `select set_child_language($1, 'fr')`, [kid])));
ok("set_child_language refuses an unknown child",
  /not_found/.test(await err("service_role", "", `select set_child_language('99999999-9999-4999-8999-999999999999', 'hi')`)));
ok("signed-in users can't call it directly", /permission denied/.test(await err("authenticated", cg, `select set_child_language($1, 'hi')`, [kid])));
ok("a caregiver can't write the child's language column directly",
  /permission denied/.test(await err("authenticated", cg, `update children set preferred_language = 'hi' where id = $1`, [kid])));
