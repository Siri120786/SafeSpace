// Sprint 3 wellness summary (migration 20261024200000): exact counts for 7
// and 30 days, local-timezone day boundaries, routine scheduling, caregiver
// privacy (partial-tier private notes excluded), isolation (others get
// zeros), input validation and function privileges.
// Usage: npx tsx supabase/tests/wellness_summary.test.mts
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);
const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(dir + f, "utf8"));
ok("all migrations including the wellness summary apply cleanly", true);

const TZ = "Asia/Kolkata";
const mk = async (role: string) =>
  (await db.query<{ id: string }>(`insert into auth.users (raw_user_meta_data) values ($1::jsonb) returning id`,
    [JSON.stringify({ role })])).rows[0].id;
const adultA = await mk("user");
const adultB = await mk("user");
const cg = await mk("caregiver");
const cgOther = await mk("caregiver");
const child = (await db.query<{ id: string }>(
  `insert into children (caregiver_id, name, age, pin_hash, privacy_tier) values ($1, 'k', 10, 'h', 'partial') returning id`, [cg])).rows[0].id;
await db.query(`insert into caregiver_user_links (caregiver_id, user_id, status) values ($1, $2, 'active')`, [cg, adultA]);

const today = (await db.query<{ d: string }>(`select ((now() at time zone '${TZ}')::date)::text d`)).rows[0].d;
// A timestamp at a LOCAL time on a local date offset from today.
const at = (daysAgo: number, hhmm: string) => `((date '${today}' - ${daysAgo}) + time '${hhmm}') at time zone '${TZ}'`;

// ---- adult A data ----
await db.exec(`
  insert into mood_checkins (profile_id, mood, created_at) values
    ('${adultA}', 'happy',    ${at(0, "09:00")}),
    ('${adultA}', 'stressed', ${at(0, "00:30")}),
    ('${adultA}', 'sad',      ${at(3, "21:00")}),
    ('${adultA}', 'happy',    ${at(10, "12:00")});
  insert into journal_entries (profile_id, content, created_at) values
    ('${adultA}', 'one', ${at(1, "08:00")}),
    ('${adultA}', 'two', ${at(6, "23:50")}),
    ('${adultA}', 'old', ${at(40, "10:00")});
`);
const routine = async (owner: { profile?: string; child?: string }, days: string, steps: number, active = true) => {
  const r = (await db.query<{ id: string }>(
    `insert into routines (profile_id, child_id, title, days_of_week, is_active, created_at)
     values ($1, $2, 'r', $3::smallint[], $4, ${at(10, "06:00")}) returning id`,
    [owner.profile ?? null, owner.child ?? null, days, active])).rows[0].id;
  const ids: string[] = [];
  for (let i = 0; i < steps; i++) {
    ids.push((await db.query<{ id: string }>(
      `insert into routine_steps (routine_id, label, order_index, created_at) values ($1, 's', $2, ${at(10, "06:00")}) returning id`,
      [r, i])).rows[0].id);
  }
  return ids;
};
const daily = await routine({ profile: adultA }, "{}", 2);
const todayDow = (await db.query<{ d: number }>(`select extract(dow from date '${today}')::int d`)).rows[0].d;
await routine({ profile: adultA }, `{${todayDow}}`, 1);           // once in any 7-day window
await routine({ profile: adultA }, "{}", 3, false);              // inactive: ignored
await db.exec(`
  insert into routine_step_completions (step_id, completed_on) values
    ('${daily[0]}', date '${today}'),
    ('${daily[0]}', date '${today}' - 1),
    ('${daily[1]}', date '${today}' - 1);
`);

const summary = async (role: string, uid: string, owner: { profile?: string; child?: string }, days = 7, tz = TZ) =>
  (await (async () => {
    await db.exec(`set role ${role}; select set_config('app.uid', '${uid}', false);`);
    try {
      return (await db.query<{ s: any }>(`select public.wellness_summary($1::uuid, $2::uuid, $3::date, $4, $5) as s`,
        [owner.profile ?? null, owner.child ?? null, today, days, tz])).rows[0].s;
    } finally {
      await db.exec(`reset role;`);
    }
  })());
const fails = async (role: string, uid: string, args: unknown[]) => {
  await db.exec(`set role ${role}; select set_config('app.uid', '${uid}', false);`);
  try {
    await db.query(`select public.wellness_summary($1::uuid, $2::uuid, $3::date, $4, $5)`, args);
    return false;
  } catch {
    return true;
  } finally {
    await db.exec(`reset role;`);
  }
};

// ---------------------------------------------------------------------------
// Adult: exact counts
// ---------------------------------------------------------------------------
const s7 = await summary("authenticated", adultA, { profile: adultA }, 7);
ok("period and local date range are reported",
  s7.periodDays === 7 && s7.to === today &&
  s7.from === (await db.query<{ d: string }>(`select (date '${today}' - 6)::text d`)).rows[0].d);
ok("mood: 3 check-ins on 2 local days in the last 7 days (the 10-day-old one excluded)",
  s7.mood.checkins === 3 && s7.mood.daysWithCheckin === 2);
ok("mood: counts by value, with every mood key present",
  s7.mood.counts.happy === 1 && s7.mood.counts.stressed === 1 && s7.mood.counts.sad === 1 &&
  s7.mood.counts.ecstatic === 0 && s7.mood.counts.neutral === 0 && s7.mood.counts.overwhelmed === 0);
ok("mood: latest is the most recent check-in", s7.mood.latest?.mood === "happy");
ok("a check-in at 00:30 IST counts on the local day (it was 'yesterday' in UTC)",
  (await db.query<{ utc_d: string }>(`select ((${at(0, "00:30")}) at time zone 'utc')::date::text utc_d`)).rows[0].utc_d !== today &&
  s7.mood.counts.stressed === 1);
ok("routines: 2 daily steps x 7 days + 1 weekly step = 15 scheduled; inactive routine ignored",
  s7.routines.scheduledSteps === 15);
ok("routines: 3 completions in the period", s7.routines.completedSteps === 3);
ok("journal: 2 entries this week (count only, no text)",
  s7.journal.entries === 2 && !JSON.stringify(s7).includes("one") && !JSON.stringify(s7).includes("two"));
const s30 = await summary("authenticated", adultA, { profile: adultA }, 30);
ok("30 days: 4 check-ins; steps counted only from when the routine existed (10 days)",
  s30.mood.checkins === 4 && s30.routines.scheduledSteps === 2 * 11 + 2 && s30.journal.entries === 2);

// ---------------------------------------------------------------------------
// Isolation
// ---------------------------------------------------------------------------
const zero = (s: any) => s.mood.checkins === 0 && s.mood.latest === null && s.routines.scheduledSteps === 0 &&
  s.routines.completedSteps === 0 && s.journal.entries === 0;
ok("another adult asking for A's summary gets zeros (RLS), not A's data",
  zero(await summary("authenticated", adultB, { profile: adultA })));
ok("a linked caregiver asking for the adult's summary gets zeros",
  zero(await summary("authenticated", cg, { profile: adultA })));

// ---------------------------------------------------------------------------
// Caregiver view of a partial-tier child: private notes excluded
// ---------------------------------------------------------------------------
await db.exec(`
  insert into mood_checkins (child_id, mood, is_private_note, created_at) values
    ('${child}', 'happy', false, ${at(0, "10:00")}),
    ('${child}', 'neutral', false, ${at(2, "10:00")}),
    ('${child}', 'overwhelmed', true, ${at(1, "10:00")});
  insert into journal_entries (child_id, content, is_private_note, created_at) values
    ('${child}', 'shared', false, ${at(0, "11:00")}),
    ('${child}', 'private', true, ${at(0, "12:00")});
`);
const cgView = await summary("authenticated", cg, { child });
ok("caregiver's summary of the child excludes the private mood note and private journal entry",
  cgView.mood.checkins === 2 && cgView.mood.counts.overwhelmed === 0 && cgView.journal.entries === 1);
const childView = await summary("service_role", "", { child });
ok("the child's own summary (Edge Function, service role) includes their private notes",
  childView.mood.checkins === 3 && childView.mood.counts.overwhelmed === 1 && childView.journal.entries === 2);
ok("another caregiver gets zeros for that child", zero(await summary("authenticated", cgOther, { child })));

// ---------------------------------------------------------------------------
// Validation and privileges
// ---------------------------------------------------------------------------
ok("exactly one owner required",
  await fails("authenticated", adultA, [null, null, today, 7, TZ]) &&
  await fails("authenticated", adultA, [adultA, child, today, 7, TZ]));
ok("only 7 or 30 days, a real date and a known timezone",
  await fails("authenticated", adultA, [adultA, null, today, 14, TZ]) &&
  await fails("authenticated", adultA, [adultA, null, null, 7, TZ]) &&
  await fails("authenticated", adultA, [adultA, null, today, 7, "Mars/Olympus"]));
ok("anon can't execute the summary function", await fails("anon", "", [adultA, null, today, 7, TZ]));
