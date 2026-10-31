// Safe Harbor's calm plan in the database (migration 20261030200000) under
// the hosted project's default privileges: adults keep theirs private, a
// child's caregivers read it under the age-15 sharing rule, and children save
// theirs only through the focus-tools function (service role).
// Usage: npx tsx supabase/tests/calm_plans.test.mts
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hashPin } from "../functions/_shared/pin.ts";
import { parseCalmPlan } from "../functions/_shared/calmPlan.ts";

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
const denied = async (role: string, uid: string, sql: string, params: unknown[] = []) => {
  const m = await err(role, uid, sql, params);
  return m.includes("permission denied") || m.includes("row-level security");
};
const mk = async (role: string) =>
  (await db.query<{ id: string }>(`insert into auth.users (raw_user_meta_data) values ($1::jsonb) returning id`,
    [JSON.stringify({ role })])).rows[0].id;
const rows = async (role: string, uid: string) =>
  (await as<{ n: number }>(role, uid, `select count(*)::int n from public.calm_plans`))[0].n;

const carer = await mk("caregiver");
const stranger = await mk("caregiver");
const adult = await mk("user");
const otherAdult = await mk("user");
const year = new Date().getUTCFullYear();
const month = new Date().getUTCMonth() + 1;
const kid = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Kid', $2, $3, $4, '{}') id`,
  [carer, year - 9, month, await hashPin("4826")]))[0].id;
const teen = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Teen', $2, $3, $4, '{}') id`,
  [carer, year - 16, month, await hashPin("5937")]))[0].id;
await as("service_role", "", `select set_child_sharing($1, false)`, [teen]);

const PLAN = JSON.stringify({ signs: ["My heart races"], helps: ["A warm drink"], people: ["A friend"], places: ["My room"] });

// Adults
await as("authenticated", adult, `insert into calm_plans (profile_id, plan) values ($1, $2::jsonb)`, [adult, PLAN]);
ok("an adult keeps their own calm plan", (await rows("authenticated", adult)) === 1);
ok("another adult, or a caregiver, can't see it", (await rows("authenticated", otherAdult)) === 0 && (await rows("authenticated", stranger)) === 0);
await as("authenticated", adult, `update calm_plans set plan = '{"signs":[]}'::jsonb where profile_id = $1`, [adult]);
ok("an adult can change their plan",
  (await as<{ plan: { signs: string[] } }>("authenticated", adult, `select plan from calm_plans`))[0].plan.signs.length === 0);
ok("an adult can't write someone else's or a child's plan",
  await denied("authenticated", otherAdult, `insert into calm_plans (profile_id, plan) values ($1, '{}')`, [adult]) &&
  await denied("authenticated", carer, `insert into calm_plans (child_id, plan) values ($1, '{}')`, [kid]));
ok("anon can't read calm plans", await denied("anon", "", `select 1 from public.calm_plans`));

// Children (through the function's service role) and their caregivers
await as("service_role", "", `insert into calm_plans (child_id, plan) values ($1, $2::jsonb), ($3, $2::jsonb)`, [kid, PLAN, teen]);
ok("a caregiver reads the plan of a child under 15",
  (await as("authenticated", carer, `select 1 from calm_plans where child_id = $1`, [kid])).length === 1);
ok("but not a 15+ child's who chose not to share",
  (await as("authenticated", carer, `select 1 from calm_plans where child_id = $1`, [teen])).length === 0);
ok("a caregiver can't change a child's plan",
  (await err("authenticated", carer, `update calm_plans set plan = '{}' where child_id = $1 returning id`, [kid])) === "no_error" &&
  (await as<{ plan: { signs: string[] } }>("service_role", "", `select plan from calm_plans where child_id = $1`, [kid]))[0].plan.signs[0] === "My heart races");
ok("a stranger sees no child's plan", (await rows("authenticated", stranger)) === 0);

// Shape
ok("the plan must be an object of at most 8 KB",
  (await err("authenticated", adult, `update calm_plans set plan = '[1]'::jsonb where profile_id = $1`, [adult])).includes("check") &&
  (await err("authenticated", adult, `update calm_plans set plan = jsonb_build_object('x', repeat('a', 9000)) where profile_id = $1`, [adult])).includes("check"));
ok("one plan per person",
  (await err("service_role", "", `insert into calm_plans (child_id, plan) values ($1, '{}')`, [kid])).includes("duplicate"));
ok("a row belongs to an adult or a child, never both",
  (await err("service_role", "", `insert into calm_plans (profile_id, child_id, plan) values ($1, $2, '{}')`, [otherAdult, kid])).length > 0);

// The function's request rules
ok("the plan's rules: four lists, up to 10 short items each",
  parseCalmPlan({ signs: ["  ok  "] })?.signs[0] === "ok" &&
  parseCalmPlan({ other: [] }) === null &&
  parseCalmPlan({ helps: Array.from({ length: 11 }, (_, i) => `x${i}`) }) === null &&
  parseCalmPlan({ people: ["x".repeat(121)] }) === null &&
  parseCalmPlan({ places: [""] }) === null &&
  parseCalmPlan([]) === null);

await as("authenticated", adult, `delete from calm_plans where profile_id = $1`, [adult]);
ok("an adult can delete their plan", (await rows("authenticated", adult)) === 0);
