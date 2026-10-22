// Hosted Data API grants (migrations 20261026000000 and 20261026100000).
//
// The hosted project's default privileges give anon, authenticated and
// service_role only REFERENCES, TRIGGER and TRUNCATE on new tables (no
// SELECT/INSERT/UPDATE/DELETE). This test builds the database with THOSE
// defaults and runs every migration, then checks:
//   - without the two new migrations, Edge Functions and caregivers really
//     are broken (the problem is real);
//   - the exact privilege matrix per role and table;
//   - every operation each Edge Function performs as service_role;
//   - caregiver, adult, linked-caregiver, child and anon boundaries under RLS;
//   - the atomic PIN attempt functions;
//   - local (permissive) defaults end with the same anon/authenticated access.
// Usage: npx tsx supabase/tests/hosted_grants.test.mts
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hashPin } from "../functions/_shared/pin.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const NEW_MIGRATIONS = ["20261026000000_hosted_data_api_grants.sql", "20261026100000_pin_attempt_slots.sql",
  "20261026200000_create_child_server_side.sql"];
const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
const allFiles = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

async function makeDb(mode: "hosted" | "local", opts: { withoutNew?: boolean } = {}) {
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
  `);
  if (mode === "hosted") {
    // What the hosted project's dump shows (MAINTAIN is PG17-only).
    await db.exec(`alter default privileges in schema public
      grant references, trigger, truncate on tables to anon, authenticated, service_role;`);
  } else {
    await db.exec(`
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
      alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    `);
  }
  for (const f of allFiles) {
    if (opts.withoutNew && NEW_MIGRATIONS.includes(f)) continue;
    await db.exec(readFileSync(dir + f, "utf8"));
  }
  return db;
}

function helpers(db: PGlite) {
  const as = async <T,>(role: string, uid: string, sql: string, params: unknown[] = []) => {
    await db.exec(`set role ${role}; select set_config('app.uid', '${uid}', false);`);
    try {
      return (await db.query<T>(sql, params)).rows;
    } finally {
      await db.exec(`reset role;`);
    }
  };
  const err = async (role: string, uid: string, sql: string, params: unknown[] = []) => {
    try {
      await as(role, uid, sql, params);
      return "no_error";
    } catch (e) {
      return (e as Error).message;
    }
  };
  const denied = async (role: string, uid: string, sql: string, params: unknown[] = []) =>
    (await err(role, uid, sql, params)).includes("permission denied");
  const mk = async (role: string) =>
    (await db.query<{ id: string }>(`insert into auth.users (raw_user_meta_data) values ($1::jsonb) returning id`,
      [JSON.stringify({ role })])).rows[0].id;
  const one = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
  return { as, err, denied, mk, one };
}

// ---------------------------------------------------------------------------
// 1. The problem is real: hosted defaults without the new migrations
// ---------------------------------------------------------------------------
{
  const db = await makeDb("hosted", { withoutNew: true });
  const { as, denied, mk, one } = helpers(db);
  const adult = await mk("user");
  const cg = await mk("caregiver");
  await db.query(`insert into mood_checkins (profile_id, mood) values ($1, 'happy')`, [adult]);
  ok("[before] Edge Functions (service_role) can't read children", await denied("service_role", "", `select id from children`));
  ok("[before] Edge Functions can't write mood check-ins",
    await denied("service_role", "", `insert into mood_checkins (child_id, mood) values (gen_random_uuid(), 'happy')`));
  ok("[before] Edge Functions can't read PIN attempts", await denied("service_role", "", `select id from pin_attempts`));
  ok("[before] caregivers can't read their own family code", await denied("authenticated", cg, `select family_code from caregivers`));
  ok("[before] an adult can't even read their OWN mood history (caregiver policy subquery on children)",
    await denied("authenticated", adult, `select id from mood_checkins`));
  void as; void one;
}

// ---------------------------------------------------------------------------
// 2. Hosted defaults with every migration
// ---------------------------------------------------------------------------
const db = await makeDb("hosted");
const { as, err, denied, mk, one } = helpers(db);
ok("all migrations apply under hosted default privileges", true);

type Privs = string; // subset of "SIUD"
const P = ["SELECT", "INSERT", "UPDATE", "DELETE"] as const;
async function privs(d: PGlite, role: string, table: string): Promise<Privs> {
  let s = "";
  for (const p of P) {
    const r = await d.query<{ h: boolean }>(`select has_table_privilege($1, $2, $3) h`, [role, `public.${table}`, p]);
    if (r.rows[0].h) s += p[0];
  }
  return s;
}
// Exact expected access. anon gets nothing anywhere.
const EXPECTED: Record<string, { authenticated: Privs; service_role: Privs }> = {
  caregivers: { authenticated: "S", service_role: "S" },
  // authenticated reads children through column grants (no pin_hash), checked below.
  children: { authenticated: "", service_role: "S" },
  child_modules: { authenticated: "S", service_role: "S" },
  pin_attempts: { authenticated: "", service_role: "" },
  condition_modules: { authenticated: "S", service_role: "" },
  caregiver_user_links: { authenticated: "S", service_role: "" },
  mood_checkins: { authenticated: "SI", service_role: "SI" },
  ai_companion_conversations: { authenticated: "S", service_role: "SIU" },
  ai_companion_messages: { authenticated: "S", service_role: "SI" },
  ai_companion_attempts: { authenticated: "", service_role: "" },
  routines: { authenticated: "SIUD", service_role: "S" },
  routine_steps: { authenticated: "SIUD", service_role: "S" },
  routine_step_completions: { authenticated: "SID", service_role: "SID" },
  journal_entries: { authenticated: "SID", service_role: "SI" },
  reminders: { authenticated: "SIUD", service_role: "S" },
  reminder_acknowledgements: { authenticated: "SID", service_role: "SI" },
  profiles: { authenticated: "SID", service_role: "" },
  profile_support_preferences: { authenticated: "SIUD", service_role: "" },
  profile_accessibility_preferences: { authenticated: "SIUD", service_role: "" },
  // Not covered yet: no code uses them (see the migration header).
  emergency_events: { authenticated: "", service_role: "" },
  generated_stories: { authenticated: "", service_role: "" },
};
{
  const mismatches: string[] = [];
  for (const [table, exp] of Object.entries(EXPECTED)) {
    for (const role of ["anon", "authenticated", "service_role"] as const) {
      const want = role === "anon" ? "" : exp[role];
      const got = await privs(db, role, table);
      if (got !== want) mismatches.push(`${role}.${table}: got "${got}" want "${want}"`);
    }
  }
  ok(`exact table privilege matrix on hosted (${Object.keys(EXPECTED).length} tables x 3 roles)${mismatches.length ? ": " + mismatches.join("; ") : ""}`,
    mismatches.length === 0);
  const colUpdate = async (col: string) =>
    (await db.query<{ h: boolean }>(`select has_column_privilege('authenticated', 'public.profiles', $1, 'UPDATE') h`, [col])).rows[0].h;
  ok("profiles: users may update display_name and onboarding_state only, never role",
    (await colUpdate("display_name")) && (await colUpdate("onboarding_state")) && !(await colUpdate("role")));
  const childCol = async (col: string, p: string) =>
    (await db.query<{ h: boolean }>(`select has_column_privilege('authenticated', 'public.children', $1, $2) h`, [col, p])).rows[0].h;
  let readable = true;
  for (const c of ["id", "caregiver_id", "name", "age", "privacy_tier", "created_at"]) readable &&= await childCol(c, "SELECT");
  ok("children: signed-in users may read every column except pin_hash, and insert none",
    readable && !(await childCol("pin_hash", "SELECT")) && !(await childCol("name", "INSERT")) &&
    !(await childCol("privacy_tier", "INSERT")) && !(await childCol("pin_hash", "INSERT")));
}
{
  const fn = async (role: string, sig: string) =>
    (await db.query<{ h: boolean }>(`select has_function_privilege($1, $2, 'EXECUTE') h`, [role, sig])).rows[0].h;
  const serverOnly = ["public.pin_attempt_begin(text)", "public.pin_attempt_succeeded(bigint)",
    "public.ai_companion_take_slot(uuid, uuid, integer, integer)",
    "public.create_child(uuid, text, integer, text, text[])"];
  const userFns = ["public.wellness_summary(uuid, uuid, date, integer, text)",
    "public.create_routine_with_steps(uuid, text, text, smallint[], jsonb)", "public.reorder_routine_steps(uuid, uuid[])"];
  let good = true;
  for (const f of serverOnly) good &&= (await fn("service_role", f)) && !(await fn("authenticated", f)) && !(await fn("anon", f));
  ok("PIN-attempt, AI rate-limit and create_child functions: service_role only", good);
  good = true;
  for (const f of userFns) good &&= (await fn("authenticated", f)) && (await fn("service_role", f)) && !(await fn("anon", f));
  ok("wellness and routine functions: authenticated and service_role, never anon", good);
}

// Fixtures (as the table owner, like seed data).
const cgA = await mk("caregiver");
const cgB = await mk("caregiver");
const adult = await mk("user");
const adultB = await mk("user");
const famA = (await one<{ family_code: string }>(`select family_code from caregivers where id = $1`, [cgA])).family_code;
await db.query(`insert into caregiver_user_links (caregiver_id, user_id, status) values ($1, $2, 'active')`, [cgA, adult]);
const kidB = (await one<{ id: string }>(
  `insert into children (caregiver_id, name, age, pin_hash, privacy_tier) values ($1, 'B kid', 10, 'h', 'partial') returning id`, [cgB])).id;
await db.query(`insert into mood_checkins (profile_id, mood) values ($1, 'happy'), ($2, 'sad')`, [adult, adultB]);
await db.query(`insert into journal_entries (profile_id, content) values ($1, 'adult note')`, [adult]);
await db.query(`insert into routines (profile_id, title) values ($1, 'adult routine')`, [adult]);
await db.query(`insert into reminders (profile_id, kind, title, time_of_day, timezone) values ($1, 'water', 'adult water', '09:00', 'UTC')`, [adult]);
await db.query(`insert into ai_companion_conversations (profile_id) values ($1)`, [adult]);

// ---------------------------------------------------------------------------
// 3. Caregivers (authenticated) under RLS
// ---------------------------------------------------------------------------
ok("caregiver reads their own family code", (await as<{ family_code: string }>("authenticated", cgA, `select family_code from caregivers`))
  .map((r) => r.family_code).join() === famA);
// The approved path: create-child verifies the caller's JWT, then calls
// create_child() as service_role with the caregiver id from that JWT.
const goodHash = await hashPin("4826");
const createChild = (caregiver: string, name: string, age: number, hash: string, mods: string[]) =>
  as<{ id: string }>("service_role", "", `select create_child($1, $2, $3, $4, $5::text[]) id`, [caregiver, name, age, hash, mods]);
const childCount = async () => (await one<{ n: number }>(`select count(*)::int n from children`)).n;

const kidA = (await createChild(cgA, "  A kid ", 10, goodHash, ["autism", "adhd", "autism"]))[0].id;
const created = await one<{ name: string; privacy_tier: string; caregiver_id: string }>(
  `select name, privacy_tier, caregiver_id from children where id = $1`, [kidA]);
ok("the approved flow creates a child with modules for the authorised caregiver (name trimmed, modules de-duplicated)",
  !!kidA && created.caregiver_id === cgA && created.name === "A kid" &&
  (await one<{ n: number }>(`select count(*)::int n from child_modules where child_id = $1`, [kidA])).n === 2);
ok("privacy tier is derived from age, never chosen by the caller",
  created.privacy_tier === "partial" &&
  (await one<{ t: string }>(`select privacy_tier t from children where id = $1`,
    [(await createChild(cgA, "Small", 6, await hashPin("1357"), []))[0].id])).t === "full" &&
  (await one<{ t: string }>(`select privacy_tier t from children where id = $1`,
    [(await createChild(cgA, "Teen", 15, await hashPin("2468"), []))[0].id])).t === "private");
await db.query(`delete from children where name in ('Small', 'Teen')`);

const before = await childCount();
ok("a caregiver can't insert a child directly (bypassing create-child), even for their own family",
  (await denied("authenticated", cgA,
    `insert into children (caregiver_id, name, age, pin_hash, privacy_tier) values ($1, 'x', 15, 'h', 'full')`, [cgA])));
ok("...or for another family", await denied("authenticated", cgA,
  `insert into children (caregiver_id, name, age, pin_hash) values ($1, 'x', 6, 'h')`, [cgB]));
ok("a caregiver can't assign modules directly, to their own or another family's child",
  (await denied("authenticated", cgA, `insert into child_modules (child_id, module_key) values ($1, 'anxiety')`, [kidA])) &&
  (await denied("authenticated", cgA, `insert into child_modules (child_id, module_key) values ($1, 'autism')`, [kidB])));
ok("a caregiver can't call create_child() themselves (it's server-only)",
  (await denied("authenticated", cgA, `select create_child($1, 'x', 10, $2, '{}')`, [cgA, goodHash])) &&
  (await denied("anon", "", `select create_child($1, 'x', 10, $2, '{}')`, [cgA, goodHash])));
ok("create_child() refuses a non-caregiver or unknown owner",
  (await err("service_role", "", `select create_child($1, 'x', 10, $2, '{}')`, [adult, goodHash])).includes("not_a_caregiver") &&
  (await err("service_role", "", `select create_child(gen_random_uuid(), 'x', 10, $1, '{}')`, [goodHash])).includes("not_a_caregiver"));
const rejects = async (name: string, age: number, hash: string, mods: string[]) =>
  (await err("service_role", "", `select create_child($1, $2, $3, $4, $5::text[])`, [cgA, name, age, hash, mods])).includes("invalid_input");
ok("create_child() validates every field (name, age band, hash format and cost, modules)",
  (await rejects("  ", 10, goodHash, [])) && (await rejects("x".repeat(81), 10, goodHash, [])) &&
  (await rejects("x", 3, goodHash, [])) && (await rejects("x", 18, goodHash, [])) &&
  (await rejects("x", 10, "h", [])) &&
  (await rejects("x", 10, goodHash.replace("pbkdf2$100000$", "pbkdf2$999999999$"), [])) &&
  (await rejects("x", 10, goodHash, ["autism", "not_a_module"])));
ok("rejected and refused attempts created nothing (the child and modules insert together or not at all)",
  (await childCount()) === before);

const listed = await as<{ id: string; mods: string[] }>("authenticated", cgA,
  `select c.id, array_agg(m.module_key order by m.module_key) mods from children c
   left join child_modules m on m.child_id = c.id group by c.id`);
ok("caregiver lists only their own children with modules", listed.length === 1 && listed[0].id === kidA && listed[0].mods.join() === "adhd,autism");
ok("caregiver reads the child columns the app uses, but not PIN hashes",
  (await as("authenticated", cgA, `select id, caregiver_id, name, age, privacy_tier, created_at from children`)).length === 1 &&
  (await denied("authenticated", cgA, `select pin_hash from children`)) &&
  (await denied("authenticated", cgA, `select * from children`)));
ok("no client UPDATE or DELETE on children (the app never does either)",
  (await denied("authenticated", cgA, `update children set name = 'x' where id = $1`, [kidA])) &&
  (await denied("authenticated", cgA, `update children set privacy_tier = 'full' where id = $1`, [kidA])) &&
  (await denied("authenticated", cgA, `delete from children where id = $1`, [kidA])));
ok("PIN hashes and attempts stay unreadable to signed-in users",
  (await denied("authenticated", cgA, `select * from pin_attempts`)) &&
  (await denied("authenticated", cgA, `select pin_attempt_begin($1)`, [famA])));

// Child data written by Edge Functions (service_role), read back by caregivers.
await as("service_role", "", `insert into mood_checkins (child_id, mood, note, is_private_note) values
  ($1, 'happy', 'shared', false), ($1, 'sad', 'secret', true)`, [kidA]);
await as("service_role", "", `insert into mood_checkins (child_id, mood) values ($1, 'neutral')`, [kidB]);
const seen = await as<{ note: string | null }>("authenticated", cgA, `select note from mood_checkins`);
ok("caregiver sees their partial-tier child's shared check-in, not the private one",
  seen.length === 1 && seen[0].note === "shared");
ok("caregiver B sees none of caregiver A's family",
  (await as("authenticated", cgB, `select id from children where id = $1`, [kidA])).length === 0 &&
  (await as("authenticated", cgB, `select id from mood_checkins where child_id = $1`, [kidA])).length === 0 &&
  (await as("authenticated", cgB, `select id from caregivers where id = $1`, [cgA])).length === 0);
const sumCg = await as<{ s: any }>("authenticated", cgA,
  `select wellness_summary(null, $1, current_date, 7, 'UTC') s`, [kidA]);
ok("caregiver's wellness summary for their child counts only the visible check-in", sumCg[0].s.mood.checkins === 1);

// ---------------------------------------------------------------------------
// 4. Adults and linked caregivers
// ---------------------------------------------------------------------------
ok("an adult reads their own mood history (works now that the policy subquery is allowed)",
  (await as<{ mood: string }>("authenticated", adult, `select mood from mood_checkins`)).map((r) => r.mood).join() === "happy");
ok("another adult sees none of it",
  (await as("authenticated", adultB, `select id from mood_checkins where profile_id = $1`, [adult])).length === 0);
ok("a linked caregiver gets NO mood, journal, routines, reminders or AI chats of the adult",
  (await as("authenticated", cgA, `select id from mood_checkins where profile_id = $1`, [adult])).length === 0 &&
  (await as("authenticated", cgA, `select id from journal_entries where profile_id = $1`, [adult])).length === 0 &&
  (await as("authenticated", cgA, `select id from routines where profile_id = $1`, [adult])).length === 0 &&
  (await as("authenticated", cgA, `select id from reminders where profile_id = $1`, [adult])).length === 0 &&
  (await as("authenticated", cgA, `select id from ai_companion_conversations where profile_id = $1`, [adult])).length === 0);
ok("a user can't change their own role", await denied("authenticated", adult, `update profiles set role = 'caregiver' where id = $1`, [adult]));

// ---------------------------------------------------------------------------
// 5. Every Edge Function operation as service_role
// ---------------------------------------------------------------------------
const sr = <T,>(sql: string, params: unknown[] = []) => as<T>("service_role", "", sql, params);
{
  // verify-child-pin / get-child-profile
  const cg = await sr<{ id: string }>(`select id from caregivers where family_code = $1`, [famA]);
  const kids = await sr<{ id: string; pin_hash: string }>(`select id, pin_hash from children where caregiver_id = $1`, [cgA]);
  const prof = await sr<{ n: number }>(`select count(*)::int n from child_modules where child_id = $1`, [kidA]);
  ok("verify-child-pin / get-child-profile reads (caregiver by code, PIN hashes, modules)",
    cg.length === 1 && kids.length === 1 && prof[0].n === 2);
  // mood-checkin and journal
  const tier = await sr<{ privacy_tier: string }>(`select privacy_tier from children where id = $1`, [kidA]);
  await sr(`insert into journal_entries (child_id, content) values ($1, 'kid journal')`, [kidA]);
  ok("mood-checkin / journal reads and writes",
    tier[0].privacy_tier === "partial" &&
    (await sr(`select id from mood_checkins where child_id = $1`, [kidA])).length === 2 &&
    (await sr(`select id from journal_entries where child_id = $1`, [kidA])).length === 1);
  // ai-companion
  const conv = (await sr<{ id: string }>(`insert into ai_companion_conversations (child_id) values ($1) returning id`, [kidA]))[0].id;
  await sr(`insert into ai_companion_messages (conversation_id, sender, content) values ($1, 'user', 'hi'), ($1, 'assistant', 'hello')`, [conv]);
  await sr(`update ai_companion_conversations set language = 'hi' where id = $1`, [conv]);
  const slot = await sr<{ s: boolean }>(`select ai_companion_take_slot(null, $1, 10, 60) s`, [kidA]);
  ok("ai-companion: conversations, messages, language update, rate-limit slot",
    (await sr(`select id from ai_companion_messages where conversation_id = $1`, [conv])).length === 2 && slot[0].s === true);
  // routines (the child's routine is created by the caregiver under RLS)
  const rid = (await as<{ id: string }>("authenticated", cgA,
    `select create_routine_with_steps($1, 'Morning', null, '{}', '[{"label":"Brush teeth"}]'::jsonb) id`, [kidA]))[0].id;
  const step = (await sr<{ id: string }>(`select s.id from routine_steps s join routines r on r.id = s.routine_id where r.child_id = $1`, [kidA]))[0].id;
  await sr(`insert into routine_step_completions (step_id, completed_on) values ($1, current_date) on conflict do nothing`, [step]);
  await sr(`insert into routine_step_completions (step_id, completed_on) values ($1, current_date) on conflict do nothing`, [step]);
  const done = await sr(`select step_id from routine_step_completions where step_id = $1`, [step]);
  await sr(`delete from routine_step_completions where step_id = $1 and completed_on = current_date`, [step]);
  ok("routines: list, complete (idempotent) and un-complete a step", !!rid && done.length === 1 &&
    (await sr(`select step_id from routine_step_completions where step_id = $1`, [step])).length === 0);
  // reminders
  const rem = (await as<{ id: string }>("authenticated", cgA,
    `insert into reminders (child_id, kind, title, time_of_day, timezone) values ($1, 'water', 'Water', '00:00', 'UTC') returning id`, [kidA]))[0].id;
  await sr(`insert into reminder_acknowledgements (reminder_id, occurs_on) values ($1, current_date) on conflict do nothing`, [rem]);
  await sr(`insert into reminder_acknowledgements (reminder_id, occurs_on) values ($1, current_date) on conflict do nothing`, [rem]);
  ok("reminders: list and acknowledge (idempotent)",
    (await sr(`select id from reminders where child_id = $1`, [kidA])).length === 1 &&
    (await sr(`select reminder_id from reminder_acknowledgements where reminder_id = $1`, [rem])).length === 1);
  // wellness-summary
  const sum = await sr<{ s: any }>(`select wellness_summary(null, $1, current_date, 7, 'UTC') s`, [kidA]);
  ok("wellness-summary as service_role sees the child's own data, private notes included",
    sum[0].s.mood.checkins === 2 && sum[0].s.journal.entries === 1);
  ok("service_role gets only what the functions use (no child updates or deletes, no profile access)",
    (await denied("service_role", "", `update children set name = 'x'`)) &&
    (await denied("service_role", "", `delete from mood_checkins`)) &&
    (await denied("service_role", "", `select id from profiles`)));
}

// ---------------------------------------------------------------------------
// 6. Anonymous role
// ---------------------------------------------------------------------------
{
  let all = true;
  for (const t of Object.keys(EXPECTED)) all &&= await denied("anon", "", `select 1 from public.${t} limit 1`);
  ok("anon is denied SELECT on every app table", all);
  ok("anon can't call PIN, AI or wellness functions",
    (await denied("anon", "", `select pin_attempt_begin('X')`)) &&
    (await denied("anon", "", `select ai_companion_take_slot(gen_random_uuid(), null, 10, 60)`)) &&
    (await denied("anon", "", `select wellness_summary(gen_random_uuid(), null, current_date, 7, 'UTC')`)));
}

// ---------------------------------------------------------------------------
// 7. PIN attempt functions
// ---------------------------------------------------------------------------
{
  const begin = async (code: string) => (await sr<{ id: string | null }>(`select pin_attempt_begin($1) id`, [code]))[0].id;
  const failed = async (code: string) =>
    (await one<{ n: number }>(`select count(*)::int n from pin_attempts where family_code = $1 and not succeeded`, [code])).n;
  const ids: (string | null)[] = [];
  for (let i = 0; i < 5; i++) ids.push(await begin("FAM111"));
  ok("five attempts are reserved, each recorded as failed until proven otherwise",
    ids.every((x) => x !== null) && (await failed("FAM111")) === 5);
  ok("the sixth is refused (null) and records nothing", (await begin("FAM111")) === null && (await failed("FAM111")) === 5);
  ok("codes are trimmed and upper-cased, so ' fam111 ' is the same family", (await begin(" fam111 ")) === null);
  ok("other families are unaffected", (await begin("FAM222")) !== null);

  const okId = await begin("FAM333");
  const marked = await sr<{ m: boolean }>(`select pin_attempt_succeeded($1) m`, [okId]);
  const again = await sr<{ m: boolean }>(`select pin_attempt_succeeded($1) m`, [okId]);
  ok("a matched attempt is marked succeeded once, and then no longer counts", marked[0].m === true && again[0].m === false &&
    (await failed("FAM333")) === 0);
  for (let i = 0; i < 4; i++) await begin("FAM333");
  ok("successes don't hide failures: 4 failures + 1 success still allows a 5th failure, then stops",
    (await begin("FAM333")) !== null && (await begin("FAM333")) === null);

  await db.query(`update pin_attempts set attempted_at = now() - interval '16 minutes' where family_code = 'FAM111'`);
  ok("failures older than 15 minutes no longer count", (await begin("FAM111")) !== null);
  const oldId = (await one<{ id: string }>(`select min(id)::text id from pin_attempts where family_code = 'FAM111'`)).id;
  ok("an attempt older than the window can't be marked succeeded",
    (await sr<{ m: boolean }>(`select pin_attempt_succeeded($1) m`, [oldId]))[0].m === false);
  ok("an empty family code is rejected", (await err("service_role", "", `select pin_attempt_begin('  ')`)).includes("invalid_input"));
}

// ---------------------------------------------------------------------------
// 8. Local (permissive) defaults reach the same anon/authenticated access
// ---------------------------------------------------------------------------
{
  const local = await makeDb("local");
  const covered = ["caregivers", "children", "child_modules", "pin_attempts", "condition_modules", "mood_checkins",
    "ai_companion_conversations", "ai_companion_messages", "ai_companion_attempts", "routines", "routine_steps",
    "routine_step_completions", "journal_entries", "reminders", "reminder_acknowledgements"];
  const diffs: string[] = [];
  for (const t of covered) {
    for (const role of ["anon", "authenticated"]) {
      const h = await privs(db, role, t);
      const l = await privs(local, role, t);
      if (h !== l) diffs.push(`${role}.${t}: hosted "${h}" local "${l}"`);
    }
    const need = EXPECTED[t].service_role;
    const l = await privs(local, "service_role", t);
    if (![...need].every((c) => l.includes(c))) diffs.push(`service_role.${t}: local "${l}" lacks "${need}"`);
  }
  ok(`local and hosted end with the same anon/authenticated access${diffs.length ? ": " + diffs.join("; ") : ""}`, diffs.length === 0);
}
