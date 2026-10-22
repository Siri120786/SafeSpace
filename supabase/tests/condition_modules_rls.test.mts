// condition_modules lockdown (migration 20261025000000): RLS on, anon has no
// access, authenticated is read-only, and foreign-key and service-role paths
// keep working. Usage: npx tsx supabase/tests/condition_modules_rls.test.mts
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hashPin } from "../functions/_shared/pin.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const db = new PGlite();
await db.exec(`
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    raw_user_meta_data jsonb
  );
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  create role authenticated;
  create role anon;
  create role service_role bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  -- Mirror Supabase's default privileges, so the migration's revokes are what
  -- is being tested (without them anon/authenticated would hold ALL).
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);

// Apply every migration in order, exactly as `supabase db reset` would.
const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(dir + f, "utf8"));
}
ok("all migrations including condition_modules lockdown apply cleanly", true);

const as = async <T,>(role: string, uid: string, sql: string) => {
  await db.exec(`set role ${role}; set app.uid = '${uid}';`);
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec(`reset role;`);
  }
};
const denied = async (role: string, uid: string, sql: string) => {
  try {
    await as(role, uid, sql);
    return false;
  } catch (e) {
    return /permission denied/i.test((e as Error).message);
  }
};
const priv = async (role: string, p: string) =>
  (await db.query<{ ok: boolean }>(
    `select has_table_privilege($1, 'public.condition_modules', $2) as ok`, [role, p])).rows[0].ok;
const ALL_PRIVS = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];

// Seed actors (superuser = service role equivalent for setup).
const cg = (await db.query<{ id: string }>(
  `insert into auth.users (raw_user_meta_data) values ('{"role":"caregiver"}') returning id`)).rows[0].id;
const cgOther = (await db.query<{ id: string }>(
  `insert into auth.users (raw_user_meta_data) values ('{"role":"caregiver"}') returning id`)).rows[0].id;
const kid = (await db.query<{ id: string }>(
  `insert into children (caregiver_id, name, age, pin_hash) values ($1, 'k', 6, 'h') returning id`, [cg])).rows[0].id;

// ---- 1. RLS and policy shape ----
const rls = (await db.query<{ on: boolean }>(
  `select relrowsecurity as on from pg_class where oid = 'public.condition_modules'::regclass`)).rows[0].on;
ok("RLS is enabled on condition_modules", rls);
const pols = (await db.query<{ cmd: string; roles: string }>(
  `select cmd, array_to_string(roles, ',') as roles from pg_policies where tablename = 'condition_modules'`)).rows;
ok("exactly one policy: SELECT for authenticated",
  pols.length === 1 && pols[0].cmd === "SELECT" && pols[0].roles === "authenticated");

// ---- 2. anon: no access at all ----
let anonAny = false;
for (const p of ALL_PRIVS) anonAny ||= await priv("anon", p);
ok("anon holds no privileges on condition_modules", !anonAny);
ok("anon SELECT is permission denied (not just zero rows)",
  await denied("anon", "", `select * from condition_modules`));
ok("anon INSERT is permission denied",
  await denied("anon", "", `insert into condition_modules values ('fake', 'Fake', true)`));
ok("anon UPDATE is permission denied",
  await denied("anon", "", `update condition_modules set display_name = 'x' where key = 'adhd'`));
ok("anon DELETE is permission denied",
  await denied("anon", "", `delete from condition_modules where key = 'pcos_pcod'`));
ok("anon TRUNCATE is permission denied",
  await denied("anon", "", `truncate condition_modules cascade`));

// ---- 3. authenticated: read-only ----
const rows = await as<{ key: string }>("authenticated", cg, `select key from condition_modules order by key`);
ok("authenticated can read all 6 modules",
  rows.map((r) => r.key).join(",") === "adhd,anxiety,autism,depression,pcos_pcod,ptsd");
ok("authenticated holds SELECT only",
  (await priv("authenticated", "SELECT")) &&
  !(await Promise.all(ALL_PRIVS.filter((p) => p !== "SELECT").map((p) => priv("authenticated", p)))).some(Boolean));
ok("authenticated INSERT is permission denied",
  await denied("authenticated", cg, `insert into condition_modules values ('fake', 'Fake', true)`));
ok("authenticated UPDATE is_built is permission denied",
  await denied("authenticated", cg, `update condition_modules set is_built = true where key = 'ptsd'`));
ok("authenticated DELETE is permission denied",
  await denied("authenticated", cg, `delete from condition_modules where key = 'pcos_pcod'`));
ok("authenticated TRUNCATE is permission denied",
  await denied("authenticated", cg, `truncate condition_modules cascade`));

// ---- 4. foreign-key-dependent paths still work ----
// Modules are assigned through create_child() (service role, called by the
// create-child Edge Function; migration 20261026200000), not by clients.
const hash = await hashPin("2741");
const kid2 = (await as<{ id: string }>("service_role", "",
  `select create_child('${cg}', 'k2', 7, '${hash}', '{anxiety}') id`))[0].id;
const linked = await as<{ module_key: string }>("service_role", "",
  `select module_key from child_modules where child_id = '${kid2}'`);
ok("a module can still be assigned to a caregiver's child through create_child (FK check passes)",
  linked.length === 1 && linked[0].module_key === "anxiety");
let badKeyRejected = false;
try {
  await db.query(`insert into child_modules (child_id, module_key) values ('${kid}', 'nope')`);
} catch (e) {
  badKeyRejected = /foreign key/i.test((e as Error).message);
}
ok("an unknown module key is still rejected by the foreign key", badKeyRejected);
ok("caregivers can't assign modules directly, to their own or someone else's child",
  (await denied("authenticated", cg, `insert into child_modules (child_id, module_key) values ('${kid}', 'adhd')`)) &&
  (await denied("authenticated", cgOther, `insert into child_modules (child_id, module_key) values ('${kid}', 'adhd')`)));

// ---- 5. trusted backend (service role) still works ----
const journal = await as("service_role", "",
  `insert into journal_entries (child_id, module_key, content) values ('${kid}', 'autism', 'x') returning id`);
const routine = await as("service_role", "",
  `with r as (insert into routines (child_id, module_key, title) values ('${kid}', 'autism', 'Morning') returning id)
   insert into routine_steps (routine_id, child_id, module_key, label)
   select r.id, '${kid}', 'autism', 'Brush teeth' from r returning id`);
ok("service role can still write journal entries, routines and routine steps (FK checks pass)",
  journal.length === 1 && routine.length === 1);
const svcUpdate = await as("service_role", "",
  `update condition_modules set display_name = display_name where key = 'adhd' returning key`);
ok("service role can still manage condition_modules", svcUpdate.length === 1);

// ---- 6. seed data intact ----
const seed = (await db.query<{ key: string; display_name: string; is_built: boolean }>(
  `select key, display_name, is_built from condition_modules order by key`)).rows;
const expected: Record<string, [string, boolean]> = {
  adhd: ["Focus Zone", false], anxiety: ["Calm Space", false], autism: ["My Space", true],
  depression: ["Bright Days", false], pcos_pcod: ["Cycle Care", false], ptsd: ["Safe Harbor", false],
};
ok("all 6 seed rows are intact, and only autism is built",
  seed.length === 6 && seed.every((r) => expected[r.key]?.[0] === r.display_name && expected[r.key]?.[1] === r.is_built));
