-- ============================================================================
-- SafeSpace: explicit Data API grants for projects that don't expose new
-- tables automatically
-- Migration: 20261026000000_hosted_data_api_grants
--
-- The hosted project's default privileges give anon, authenticated and
-- service_role only REFERENCES, TRIGGER, TRUNCATE and MAINTAIN on new public
-- tables: no SELECT, INSERT, UPDATE or DELETE unless a migration grants them.
-- Local stacks grant ALL by default, so earlier migrations relied on that:
--   - Edge Functions (service_role) could not read or write any table;
--   - caregivers could not read caregivers / children / child_modules, and
--     every RLS policy with a `children` subquery failed with "permission
--     denied", including adults reading their own mood history (all SELECT
--     policies on a table are evaluated together).
--
-- This grants exactly what the app and its Edge Functions use (every
-- .from()/.rpc() in packages/api-client, apps/web, apps/mobile and
-- supabase/functions). RLS policies are unchanged and still decide which
-- rows each role sees; service_role bypasses RLS and is only ever used inside
-- Edge Functions, never shipped to clients.
--
-- After this migration, on both hosted and local:
--   anon          -> nothing on these tables
--   authenticated -> caregivers: SELECT; children, child_modules: SELECT, INSERT
--                    (create-child runs as the caregiver under RLS)
--   service_role  -> the reads/writes each Edge Function performs (below)
-- Grants on tables created in Sprint 2 and 3 for `authenticated` were already
-- explicit and are unchanged. pin_attempts is handled in 20261026100000.
-- Not covered (no code uses them yet): emergency_events, generated_stories.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Family tables (0001): caregivers, children, child_modules
-- ----------------------------------------------------------------------------
revoke all on public.caregivers from anon, authenticated;
revoke all on public.children from anon, authenticated;
revoke all on public.child_modules from anon, authenticated;

-- getMyFamilyCode; caregiver reads of their own row.
grant select on public.caregivers to authenticated;
-- listMyChildren / getChildOverview, RLS subqueries in caregiver policies, and
-- create-child (inserts as the signed-in caregiver).
grant select, insert on public.children to authenticated;
grant select, insert on public.child_modules to authenticated;

-- verify-child-pin (caregiver by family code, children's PIN hashes),
-- get-child-profile, mood-checkin and journal (child privacy tier).
grant select on public.caregivers to service_role;
grant select on public.children to service_role;
grant select on public.child_modules to service_role;

-- ----------------------------------------------------------------------------
-- Edge Function (service_role) access to Sprint 2 and 3 tables
-- ----------------------------------------------------------------------------
-- mood-checkin
grant select, insert on public.mood_checkins to service_role;
-- ai-companion (conversation language is updated in place)
grant select, insert, update on public.ai_companion_conversations to service_role;
grant select, insert on public.ai_companion_messages to service_role;
-- routines (mark / unmark a step for a day)
grant select on public.routines to service_role;
grant select on public.routine_steps to service_role;
grant select, insert, delete on public.routine_step_completions to service_role;
-- journal
grant select, insert on public.journal_entries to service_role;
-- reminders (acknowledge is INSERT ... ON CONFLICT DO NOTHING)
grant select on public.reminders to service_role;
grant select, insert on public.reminder_acknowledgements to service_role;
-- wellness-summary calls wellness_summary(), which is SECURITY INVOKER: the
-- reads above (mood_checkins, routines, routine_steps,
-- routine_step_completions, journal_entries) cover it.
