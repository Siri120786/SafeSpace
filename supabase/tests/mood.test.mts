// Sprint 2 mood check-in: RLS isolation, privacy tiers, contract sync, and the
// profile role-escalation fix. Usage: npx tsx supabase/tests/mood.test.mts
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MOOD_VALUES as SHARED_MOODS } from "../../packages/shared-types/src/index.ts";
import {
  MOOD_VALUES as FN_MOODS,
  validateMoodCheckin,
  clampLimit,
} from "../functions/_shared/moodCheckin.ts";

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
  grant usage on schema public, auth to authenticated;
  -- Hosted/local Supabase grants ALL on new public tables to authenticated by
  -- default; reproduce that so migrations' explicit revokes are what's tested.
  alter default privileges in schema public grant all on tables to authenticated;
`);

// Apply every migration in order, exactly as `supabase db reset` would.
const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(dir + f, "utf8"));
}
ok("all migrations including mood_checkins apply cleanly", true);

const asUser = async <T,>(userId: string, sql: string) => {
  await db.exec(`set role authenticated; set app.uid = '${userId}';`);
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec(`reset role;`);
  }
};
const isBlocked = async (userId: string, sql: string) => {
  try {
    await asUser(userId, sql);
    return false;
  } catch {
    return true;
  }
};
const fails = async (sql: string) => {
  try {
    await db.exec(sql);
    return false;
  } catch {
    return true;
  }
};
const mk = async (role: string, name: string) =>
  (await db.query<{ id: string }>(
    `insert into auth.users (raw_user_meta_data) values ($1::jsonb) returning id`,
    [JSON.stringify({ role, display_name: name })],
  )).rows[0].id;

const u1 = await mk("user", "User One");
const u2 = await mk("user", "User Two");
const cgA = await mk("caregiver", "Caregiver A");
const cgB = await mk("caregiver", "Caregiver B");

// Seed as superuser (service role equivalent).
await db.query(
  `insert into caregiver_user_links (caregiver_id, user_id, status) values ($1, $2, 'active')`,
  [cgA, u1],
);
const kid = async (age: number, tier: string, cg: string) =>
  (await db.query<{ id: string }>(
    `insert into children (caregiver_id, name, age, pin_hash, privacy_tier)
     values ($1, 'k', $2, 'h', $3) returning id`,
    [cg, age, tier],
  )).rows[0].id;
const young = await kid(6, "full", cgA);
const mid = await kid(10, "partial", cgA);
const otherKid = await kid(7, "full", cgB);

// ---- contract sync ----
ok("MOOD_VALUES match between shared-types and Edge Function",
  JSON.stringify(SHARED_MOODS) === JSON.stringify(FN_MOODS));
let allAccepted = true;
for (const m of SHARED_MOODS) {
  if (await fails(`insert into mood_checkins (profile_id, mood) values ('${u2}', '${m}')`)) allAccepted = false;
}
ok("every shared mood value is accepted by the DB constraint", allAccepted);
await db.exec(`delete from mood_checkins`);
ok("unknown mood rejected by DB",
  await fails(`insert into mood_checkins (profile_id, mood) values ('${u1}', 'angry')`));
ok("intensity outside 1-5 rejected by DB",
  await fails(`insert into mood_checkins (profile_id, mood, intensity) values ('${u1}', 'happy', 6)`));
ok("note over 500 chars rejected by DB",
  await fails(`insert into mood_checkins (profile_id, mood, note) values ('${u1}', 'happy', repeat('a', 501))`));
ok("blank note rejected by DB (store null instead)",
  await fails(`insert into mood_checkins (profile_id, mood, note) values ('${u1}', 'happy', '   ')`));
ok("row must have exactly one owner",
  await fails(`insert into mood_checkins (profile_id, child_id, mood) values ('${u1}', '${young}', 'happy')`) &&
  await fails(`insert into mood_checkins (mood) values ('happy')`));

// ---- adult user: own data ----
const created = await asUser<{ id: string }>(u1,
  `insert into mood_checkins (profile_id, mood, intensity, note)
   values ('${u1}', 'stressed', 3, 'busy day') returning id`);
ok("user can save their own mood check-in", created.length === 1);
await asUser(u2, `insert into mood_checkins (profile_id, mood) values ('${u2}', 'happy')`);

const mine = await asUser<{ mood: string; note: string }>(u1, `select mood, note from mood_checkins`);
ok("user reads back only their own check-in",
  mine.length === 1 && mine[0].mood === "stressed" && mine[0].note === "busy day");
ok("user cannot read another user's check-ins",
  (await asUser(u1, `select 1 from mood_checkins where profile_id = '${u2}'`)).length === 0);
ok("user cannot save a check-in as another user",
  await isBlocked(u1, `insert into mood_checkins (profile_id, mood) values ('${u2}', 'sad')`));
ok("user cannot write a child's check-in directly",
  await isBlocked(u1, `insert into mood_checkins (child_id, mood) values ('${young}', 'sad')`));
ok("user cannot mark an adult check-in as a private note",
  await isBlocked(u1, `insert into mood_checkins (profile_id, mood, is_private_note) values ('${u1}', 'sad', true)`));
ok("history is append-only: user cannot update their check-in",
  await isBlocked(u1, `update mood_checkins set mood = 'happy'`));
ok("history is append-only: user cannot delete their check-in",
  await isBlocked(u1, `delete from mood_checkins`));
ok("unauthenticated requests see no check-ins",
  (await asUser("", `select 1 from mood_checkins`)).length === 0);

// ---- linked caregiver: no access to adult mood data ----
ok("linked caregiver cannot read the linked user's mood check-ins",
  (await asUser(cgA, `select 1 from mood_checkins where profile_id = '${u1}'`)).length === 0);

// ---- children (written by the Edge Function with the service role) ----
await db.query(
  `insert into mood_checkins (child_id, mood, note, is_private_note) values
     ($1, 'happy', 'young note', false),
     ($2, 'sad', 'shared note', false),
     ($2, 'overwhelmed', 'PRIVATE note', true),
     ($3, 'neutral', 'other family', false)`,
  [young, mid, otherKid],
);
ok("private note rejected for a full-tier child (trigger)",
  await fails(`insert into mood_checkins (child_id, mood, is_private_note) values ('${young}', 'sad', true)`));
ok("private note allowed for a partial-tier child", true); // inserted above without error

const cgRows = await asUser<{ note: string }>(cgA, `select note from mood_checkins`);
const cgNotes = cgRows.map((r) => r.note);
ok("caregiver sees their children's shared check-ins",
  cgNotes.includes("young note") && cgNotes.includes("shared note"));
ok("caregiver cannot see a partial-tier child's private note",
  !cgNotes.includes("PRIVATE note"));
ok("caregiver cannot see another family's child check-ins",
  !cgNotes.includes("other family"));
ok("caregiver sees no adult users' check-ins", cgRows.length === 2);
ok("caregiver cannot write check-ins for their child",
  await isBlocked(cgA, `insert into mood_checkins (child_id, mood) values ('${young}', 'happy')`));
ok("other caregiver sees none of caregiver A's children",
  (await asUser(cgB, `select 1 from mood_checkins where child_id in ('${young}', '${mid}')`)).length === 0);

// ---- profile role escalation fix ----
ok("user cannot change their own role",
  await isBlocked(u1, `update profiles set role = 'caregiver' where id = '${u1}'`));
const role = await db.query<{ role: string }>(`select role from profiles where id = '${u1}'`);
ok("user's role is unchanged", role.rows[0].role === "user");
const renamed = await asUser(u1,
  `update profiles set display_name = 'Renamed', onboarding_state = 'completed' where id = '${u1}' returning id`);
ok("user can still update display_name and onboarding_state", renamed.length === 1);

// ---- Edge Function validator ----
const v = (b: Record<string, unknown>) => validateMoodCheckin(b);
ok("validator accepts mood only", v({ mood: "happy" }).ok);
ok("validator rejects unknown mood", !v({ mood: "angry" }).ok && !v({}).ok);
ok("validator rejects bad intensity",
  !v({ mood: "happy", intensity: 0 }).ok && !v({ mood: "happy", intensity: 2.5 }).ok && !v({ mood: "happy", intensity: "3" }).ok);
ok("validator rejects note over 500 chars", !v({ mood: "happy", note: "a".repeat(501) }).ok);
const blank = v({ mood: "happy", note: "   " });
ok("validator turns a blank note into null", blank.ok && blank.value.note === null);
ok("validator rejects non-boolean is_private_note", !v({ mood: "happy", is_private_note: "yes" }).ok);
const extra = v({ mood: "happy", child_id: "someone-else", profile_id: "x" });
ok("validator drops owner fields from the request body",
  extra.ok && !("child_id" in extra.value) && !("profile_id" in extra.value));
ok("list limit defaults to 30 and caps at 100",
  clampLimit(undefined) === 30 && clampLimit(-1) === 30 && clampLimit(500) === 100 && clampLimit(10) === 10);
