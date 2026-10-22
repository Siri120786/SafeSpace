import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    const res = fn();
    if (res && typeof res.then === "function") {
      return res.then(
        () => console.log(`PASS ${name}`),
        (err) => {
          console.error(`FAIL ${name}:`, err);
          process.exitCode = 1;
        }
      );
    }
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}:`, err);
    process.exitCode = 1;
  }
}

async function setupDatabase() {
  const db = new PGlite();

  // Mock auth schema and functions
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      raw_user_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz default now()
    );
    create or replace function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
    create role authenticated;
    create role anon;
    create role service_role bypassrls;
    grant usage on schema public, auth to authenticated;
  `);

  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await db.exec(sql);
  }

  return db;
}

async function main() {
  const db = await setupDatabase();

  // Test 1: User Sign Up creates Profile with default pending state & role
  await runTest("Profile loads with default pending state", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    await db.exec(`
      insert into auth.users (id, email, raw_user_meta_data)
      values ('${userId}', 'user1@example.com', '{"role": "user", "display_name": "Test User"}');
    `);

    const res = await db.query<{ id: string; role: string; display_name: string; onboarding_state: string }>(
      `select id, role, display_name, onboarding_state from public.profiles where id = '${userId}';`
    );

    assert.equal(res.rows.length, 1);
    assert.equal(res.rows[0].display_name, "Test User");
    assert.equal(res.rows[0].role, "user");
    assert.equal(res.rows[0].onboarding_state, "pending");
  });

  // Test 2: Profile can be edited (Display Name) & validated
  await runTest("Profile display name can be edited & validated", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    await db.exec(`
      update public.profiles set display_name = 'Updated User Name' where id = '${userId}';
    `);

    const res = await db.query<{ display_name: string }>(
      `select display_name from public.profiles where id = '${userId}';`
    );

    assert.equal(res.rows[0].display_name, "Updated User Name");
  });

  // Test 3: Support Preferences saving & validation
  await runTest("Support preferences can be saved and retrieved", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    await db.exec(`
      insert into public.profile_support_preferences (profile_id, support_areas)
      values ('${userId}', array['autism', 'adhd', 'anxiety'])
      on conflict (profile_id) do update set support_areas = excluded.support_areas;
    `);

    const res = await db.query<{ support_areas: string[] }>(
      `select support_areas from public.profile_support_preferences where profile_id = '${userId}';`
    );

    assert.equal(res.rows.length, 1);
    assert.deepEqual(res.rows[0].support_areas, ["autism", "adhd", "anxiety"]);
  });

  // Test 4: Support Preferences rejects invalid modules
  await runTest("Support preferences rejects invalid module key", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    let threw = false;
    try {
      await db.exec(`
        insert into public.profile_support_preferences (profile_id, support_areas)
        values ('${userId}', array['invalid_medical_diagnosis']);
      `);
    } catch {
      threw = true;
    }
    assert.equal(threw, true, "Should reject invalid module keys");
  });

  // Test 5: Accessibility preferences saving
  await runTest("Accessibility preferences can be saved and retrieved", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    await db.exec(`
      insert into public.profile_accessibility_preferences
        (profile_id, reduced_sensory_stimulation, larger_text, read_aloud, simplified_presentation)
      values ('${userId}', true, true, false, true)
      on conflict (profile_id) do update set
        reduced_sensory_stimulation = excluded.reduced_sensory_stimulation,
        larger_text = excluded.larger_text,
        read_aloud = excluded.read_aloud,
        simplified_presentation = excluded.simplified_presentation;
    `);

    const res = await db.query<{
      reduced_sensory_stimulation: boolean;
      larger_text: boolean;
      read_aloud: boolean;
      simplified_presentation: boolean;
    }>(
      `select reduced_sensory_stimulation, larger_text, read_aloud, simplified_presentation
       from public.profile_accessibility_preferences where profile_id = '${userId}';`
    );

    assert.equal(res.rows.length, 1);
    assert.equal(res.rows[0].reduced_sensory_stimulation, true);
    assert.equal(res.rows[0].larger_text, true);
    assert.equal(res.rows[0].read_aloud, false);
    assert.equal(res.rows[0].simplified_presentation, true);
  });

  // Test 6: Onboarding progress completion
  await runTest("Onboarding state marks completed and persists", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    await db.exec(`
      update public.profiles set onboarding_state = 'completed' where id = '${userId}';
    `);

    const res = await db.query<{ onboarding_state: string }>(
      `select onboarding_state from public.profiles where id = '${userId}';`
    );

    assert.equal(res.rows[0].onboarding_state, "completed");
  });
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
