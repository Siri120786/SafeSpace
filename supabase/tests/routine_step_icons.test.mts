// Routine step icons (migration 20261027300000, role-flow step 4c), under the
// hosted project's default privileges.
// Usage: npx tsx supabase/tests/routine_step_icons.test.mts
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hashPin } from "../functions/_shared/pin.ts";
import { ROUTINE_STEP_ICON_KEYS } from "../../packages/shared-types/src/index.ts";
import { shapeRoutinesForDate } from "../functions/_shared/routines.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
const MIGRATION = "20261027300000_routine_step_icons.sql";
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
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const before = files.filter((f) => f < MIGRATION);
for (const f of before) await db.exec(readFileSync(dir + f, "utf8"));

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

// A routine made before the migration keeps working, with no icon.
const primary = await mk("caregiver");
const co = await mk("caregiver");
const stranger = await mk("caregiver");
const year = new Date().getUTCFullYear();
const month = new Date().getUTCMonth() + 1;
const kid = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Kid', $2, $3, $4, '{}') id`,
  [primary, year - 9, month, await hashPin("4826")]))[0].id;
const oldRoutine = (await as<{ id: string }>("authenticated", primary,
  `select create_routine_with_steps($1, 'Old', null, '{}', '[{"label":"Old step"}]'::jsonb) id`, [kid]))[0].id;

for (const f of files.filter((f) => f >= MIGRATION)) await db.exec(readFileSync(dir + f, "utf8"));
ok("all migrations apply under hosted default privileges", true);

const oldStep = (await db.query<{ icon: string | null }>(`select icon from routine_steps where routine_id = $1`, [oldRoutine])).rows[0];
ok("steps made before the migration have no icon", oldStep.icon === null);

// The database list and the shared-types list are the same.
const sql = readFileSync(dir + MIGRATION, "utf8");
const sqlKeys = [...sql.slice(sql.indexOf("icon in ("), sql.indexOf(")", sql.indexOf("icon in ("))).matchAll(/'([a-z_]+)'/g)]
  .map((m) => m[1]);
ok("the icon list in SQL matches ROUTINE_STEP_ICONS", JSON.stringify([...sqlKeys].sort()) === JSON.stringify([...ROUTINE_STEP_ICON_KEYS].sort()));

// Creating with icons.
const r = (await as<{ id: string }>("authenticated", primary,
  `select create_routine_with_steps($1, 'Morning', null, '{1,2,3,4,5}', $2::jsonb) id`,
  [kid, JSON.stringify([
    { label: "Brush teeth", scheduled_time: "07:30", icon: "brush_teeth" },
    { label: "Breakfast", icon: "" },
    { label: "Shoes on" },
  ])]))[0].id;
const steps = await as<{ label: string; icon: string | null }>("authenticated", primary,
  `select label, icon from routine_steps where routine_id = $1 order by order_index`, [r]);
ok("create_routine_with_steps stores the icon", steps[0].icon === "brush_teeth");
ok("an empty or missing icon is stored as none", steps[1].icon === null && steps[2].icon === null);
ok("an unknown icon is refused",
  /routine_steps_icon_known/.test(await err("authenticated", primary,
    `select create_routine_with_steps($1, 'Bad', null, '{}', '[{"label":"x","icon":"rocket"}]'::jsonb)`, [kid])));

// Who can change an icon.
await as("authenticated", co, `select accept_caregiver_invite($1)`,
  [(await as<{ code: string }>("authenticated", primary, `select code from create_caregiver_invite($1)`, [kid]))[0].code]);
const updated = await as<{ id: string }>("authenticated", co,
  `update routine_steps set icon = 'water' where routine_id = $1 and order_index = 1 returning id`, [r]);
ok("a co-caregiver can set a step's icon", updated.length === 1);
const blocked = await as<{ id: string }>("authenticated", stranger,
  `update routine_steps set icon = 'play' where routine_id = $1 returning id`, [r]);
ok("another caregiver can't touch the steps", blocked.length === 0);
ok("a direct update to an unknown icon is refused",
  /routine_steps_icon_known/.test(await err("authenticated", primary,
    `update routine_steps set icon = 'rocket' where routine_id = $1`, [r])));

// Grants unchanged: anon can't create routines; the Edge Function (service_role) can read icons.
ok("anon still can't call create_routine_with_steps",
  /permission denied/.test(await err("anon", "", `select create_routine_with_steps(null, 'x', null, '{}', '[]'::jsonb)`)));
const svc = await as<{ icon: string | null }>("service_role", "",
  `select icon from routine_steps where routine_id = $1 order by order_index`, [r]);
ok("service_role reads icons for the child app", svc[0].icon === "brush_teeth" && svc[1].icon === "water");

// The routines Edge Function's shaping passes the icon through.
const shaped = shapeRoutinesForDate([{
  id: "r", profile_id: null, child_id: kid, module_key: null, title: "T", days_of_week: [], is_active: true,
  created_at: "", updated_at: "",
  routine_steps: [
    { id: "a", routine_id: "r", label: "A", scheduled_time: null, order_index: 0, icon: "bed" },
    { id: "b", routine_id: "r", label: "B", scheduled_time: null, order_index: 1 },
  ],
}], "2026-10-23");
ok("the child routines function returns each step's icon (null when none)",
  shaped[0].steps[0].icon === "bed" && shaped[0].steps[1].icon === null);
