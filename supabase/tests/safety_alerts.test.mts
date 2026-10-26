// Safety alerts (migration 20261031000000): raise_safety_alert under the
// hosted project's default privileges.
// Usage: npx tsx supabase/tests/safety_alerts.test.mts
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

const primary = await mk("caregiver");
const co = await mk("caregiver");
const stranger = await mk("caregiver");
const year = new Date().getUTCFullYear();
const month = new Date().getUTCMonth() + 1;
const teen = (await as<{ id: string }>("service_role", "", `select create_child($1, 'Teen', $2, $3, $4, '{}') id`,
  [primary, year - 16, month, await hashPin("5937")]))[0].id;
await as("authenticated", co, `select accept_caregiver_invite($1)`,
  [(await as<{ code: string }>("authenticated", primary, `select code from create_caregiver_invite($1)`, [teen]))[0].code]);
// The teen chose not to share activity: safety alerts must still reach caregivers.
await as("service_role", "", `select set_child_sharing($1, false)`, [teen]);

const raise = (source: string) => as<{ id: string }>("service_role", "", `select raise_safety_alert($1, $2) id`, [teen, source]);

const a1 = (await raise("journal_flag"))[0].id;
const row = (await db.query<{ triggered_by: string; ai_alert_summary: string | null; caregiver_notified_at: string | null }>(
  `select triggered_by, ai_alert_summary, caregiver_notified_at from emergency_events where id = $1`, [a1])).rows[0];
ok("a journal safety alert is written with its source", row.triggered_by === "journal_flag");
ok("it stores where, never the child's words (no summary)", row.ai_alert_summary === null);
ok("in-app delivery: marked notified when written", row.caregiver_notified_at !== null);

ok("a repeat within 30 minutes returns the same alert", (await raise("journal_flag"))[0].id === a1);
const a2 = (await raise("companion_flag"))[0].id;
const a3 = (await raise("check_in"))[0].id;
ok("each source gets its own alert", a2 !== a1 && a3 !== a1 && a2 !== a3);

for (const who of [primary, co]) {
  const seen = await as<{ id: string }>("authenticated", who, `select id from emergency_events where child_id = $1`, [teen]);
  ok(`every caregiver sees the alerts though the child doesn't share (${who === primary ? "primary" : "co-caregiver"})`,
    [a1, a2, a3].every((id) => seen.some((r) => r.id === id)));
}
ok("a stranger sees none", (await as("authenticated", stranger, `select id from emergency_events where child_id = $1`, [teen])).length === 0);

await as("authenticated", primary, `select mark_alert_reviewed($1)`, [a1]);
ok("after it's reviewed, a new match raises a fresh alert", (await raise("journal_flag"))[0].id !== a1);

ok("help sources can't be raised through it", /invalid_input/.test(await err("service_role", "", `select raise_safety_alert($1, 'aac_tap')`, [teen])));
ok("unknown sources are refused", /invalid_input/.test(await err("service_role", "", `select raise_safety_alert($1, 'anything')`, [teen])));
ok("an unknown child is refused",
  /not_found/.test(await err("service_role", "", `select raise_safety_alert('99999999-9999-4999-8999-999999999999', 'journal_flag')`)));
ok("signed-in users can't call it", /permission denied/.test(await err("authenticated", primary, `select raise_safety_alert($1, 'journal_flag')`, [teen])));
ok("anonymous users can't call it", /permission denied/.test(await err("anon", "", `select raise_safety_alert($1, 'journal_flag')`, [teen])));
ok("caregivers still can't write alerts directly",
  /permission denied|row-level security/.test(await err("authenticated", primary,
    `insert into emergency_events (child_id, triggered_by) values ($1, 'companion_flag')`, [teen])));
