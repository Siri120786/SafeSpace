// Sprint 3 journaling (migration 20261024100000): adult ownership, entry
// types, per-entry privacy enforced in the database, the unchanged caregiver
// privacy-tier policy, legacy rows, and anon / linked-caregiver isolation.
// Usage: npx tsx supabase/tests/journal.test.mts
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const JOURNAL_MIGRATION = "20261024100000_journal_entries.sql";
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
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);

const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
for (const f of files.filter((f) => f < JOURNAL_MIGRATION)) await db.exec(readFileSync(dir + f, "utf8"));

const mk = async (role: string) =>
  (await db.query<{ id: string }>(
    `insert into auth.users (raw_user_meta_data) values ($1::jsonb) returning id`, [JSON.stringify({ role })])).rows[0].id;
const adultA = await mk("user");
const adultB = await mk("user");
const cgA = await mk("caregiver");
const cgB = await mk("caregiver");
const kid = async (cg: string, tier: string) =>
  (await db.query<{ id: string }>(
    `insert into children (caregiver_id, name, age, pin_hash, privacy_tier) values ($1, 'k', 10, 'h', $2) returning id`,
    [cg, tier])).rows[0].id;
const fullKid = await kid(cgA, "full");
const partialKid = await kid(cgA, "partial");
const otherKid = await kid(cgB, "full");
await db.query(`insert into caregiver_user_links (caregiver_id, user_id, status) values ($1, $2, 'active')`, [cgA, adultA]);

// Legacy rows shaped like production before Sprint 3 (child-only), including
// a blank entry the new length rule would reject, and a private note from
// before private notes were removed (role flow M2). Seeded with triggers
// paused, the way old data already exists.
await db.exec(`set session_replication_role = replica`);
await db.query(
  `insert into journal_entries (child_id, module_key, content, is_private_note) values
     ($1, 'autism', 'full-tier entry', false),
     ($2, 'anxiety', 'partial shared entry', false),
     ($2, 'anxiety', 'partial PRIVATE note', true),
     ($3, 'adhd', 'other family entry', false),
     ($1, 'autism', '   ', false)`,
  [fullKid, partialKid, otherKid]);
await db.exec(`set session_replication_role = origin`);

for (const f of files.filter((f) => f >= JOURNAL_MIGRATION)) await db.exec(readFileSync(dir + f, "utf8"));
ok("all migrations including journaling apply cleanly over legacy data (even a blank legacy row)", true);

const as = async <T,>(role: string, uid: string, sql: string, params: unknown[] = []) => {
  await db.exec(`set role ${role}; select set_config('app.uid', '${uid}', false);`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec(`reset role;`);
  }
};
const fails = async (role: string, uid: string, sql: string, params: unknown[] = []) => {
  try {
    await as(role, uid, sql, params);
    return false;
  } catch {
    return true;
  }
};

// ---------------------------------------------------------------------------
// Legacy data and the unchanged caregiver privacy-tier policy
// ---------------------------------------------------------------------------
const legacyTypes = (await db.query<{ t: string; n: number }>(
  `select entry_type t, count(*)::int n from journal_entries group by 1`)).rows;
ok("legacy rows default to entry_type 'journal'", legacyTypes.length === 1 && legacyTypes[0].t === "journal" && legacyTypes[0].n === 5);
const cgSees = (await as<{ content: string }>("authenticated", cgA, `select content from journal_entries`)).map((r) => r.content);
ok("caregiver still sees full-tier and partial shared entries",
  cgSees.includes("full-tier entry") && cgSees.includes("partial shared entry"));
ok("caregiver still can't see the legacy private note", !cgSees.includes("partial PRIVATE note"));
ok("caregiver still can't see another family's entries", !cgSees.includes("other family entry"));

// ---------------------------------------------------------------------------
// Adults
// ---------------------------------------------------------------------------
const created = await as<{ id: string; entry_type: string; module_key: string | null }>("authenticated", adultA,
  `insert into journal_entries (profile_id, content, entry_type) values ($1, 'Grateful for tea', 'gratitude')
   returning id, entry_type, module_key`, [adultA]);
ok("adult creates a gratitude entry with no module (shared journal)",
  created.length === 1 && created[0].entry_type === "gratitude" && created[0].module_key === null);
await as("authenticated", adultB, `insert into journal_entries (profile_id, content) values ($1, 'B private thoughts')`, [adultB]);
const aSees = (await as<{ content: string }>("authenticated", adultA, `select content from journal_entries`)).map((r) => r.content);
ok("adult reads only their own entries", aSees.length === 1 && aSees[0] === "Grateful for tea");
ok("adult can't write an entry as someone else or as a child",
  await fails("authenticated", adultA, `insert into journal_entries (profile_id, content) values ($1, 'x')`, [adultB]) &&
  await fails("authenticated", adultA, `insert into journal_entries (child_id, content) values ($1, 'x')`, [fullKid]));
ok("adult can't mark an entry as a private note (child-tier feature)",
  await fails("authenticated", adultA, `insert into journal_entries (profile_id, content, is_private_note) values ($1, 'x', true)`, [adultA]));
ok("entries can't be edited by clients (no update privilege)",
  await fails("authenticated", adultA, `update journal_entries set content = 'edited' where id = $1`, [created[0].id]));
ok("another adult's delete affects nothing",
  (await as("authenticated", adultB, `delete from journal_entries where id = $1 returning 1`, [created[0].id])).length === 0);
ok("a linked caregiver can't read the linked adult's journal",
  (await as("authenticated", cgA, `select 1 from journal_entries where profile_id = $1`, [adultA])).length === 0);
ok("adult deletes their own entry",
  (await as("authenticated", adultA, `delete from journal_entries where id = $1 returning 1`, [created[0].id])).length === 1);

// ---------------------------------------------------------------------------
// Children (written by the Edge Function = service role) and caregivers
// ---------------------------------------------------------------------------
ok("new private notes are refused for every child (private notes were removed)",
  (await fails("service_role", "", `insert into journal_entries (child_id, content, is_private_note) values ($1, 'secret', true)`, [partialKid])) &&
  (await fails("service_role", "", `insert into journal_entries (child_id, content, is_private_note) values ($1, 'secret', true)`, [fullKid])));
ok("caregiver can't write, edit or delete their child's entries",
  await fails("authenticated", cgA, `insert into journal_entries (child_id, content) values ($1, 'x')`, [fullKid]) &&
  await fails("authenticated", cgA, `update journal_entries set content = 'x' where child_id = $1`, [fullKid]) &&
  (await as("authenticated", cgA, `delete from journal_entries where child_id = $1 returning 1`, [fullKid])).length === 0);

// ---------------------------------------------------------------------------
// Constraints, trigger, anon
// ---------------------------------------------------------------------------
ok("entry must have exactly one owner",
  await fails("service_role", "", `insert into journal_entries (content) values ('orphan')`) &&
  await fails("service_role", "", `insert into journal_entries (profile_id, child_id, content) values ($1, $2, 'both')`, [adultA, fullKid]));
ok("unknown entry type, blank content and over-long content are rejected for new rows",
  await fails("service_role", "", `insert into journal_entries (profile_id, content, entry_type) values ($1, 'x', 'diary')`, [adultA]) &&
  await fails("service_role", "", `insert into journal_entries (profile_id, content) values ($1, '   ')`, [adultA]) &&
  await fails("service_role", "", `insert into journal_entries (profile_id, content) values ($1, repeat('a', 5001))`, [adultA]));
const before = (await db.query<{ u: string }>(`select updated_at::text u from journal_entries where content = 'partial shared entry'`)).rows[0].u;
await new Promise((r) => setTimeout(r, 5));
await db.exec(`update journal_entries set module_key = 'adhd' where content = 'partial shared entry'`);
const after = (await db.query<{ u: string }>(`select updated_at::text u from journal_entries where content = 'partial shared entry'`)).rows[0].u;
ok("updated_at trigger bumps on update", after !== before);
ok("anon has no access to journal entries",
  await fails("anon", "", `select 1 from journal_entries`) &&
  await fails("anon", "", `insert into journal_entries (profile_id, content) values ($1, 'x')`, [adultA]));
