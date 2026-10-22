-- ============================================================================
-- SafeSpace: close anonymous-role privileges on mood_checkins
-- Migration: 20261022000100_mood_checkins_revoke_anon
--
-- 20261019120000_mood_checkins revoked `authenticated` and re-granted only
-- SELECT/INSERT, but left Supabase's default ALL grant to `anon` in place.
-- RLS already denies anon (every policy checks auth.uid()); this removes the
-- underlying privileges as a second layer.
--
-- Intended access after this migration:
--   anon           -> nothing (children write via the mood-checkin Edge
--                     Function, which uses the service role)
--   authenticated  -> SELECT, INSERT (unchanged; RLS limits to own rows and a
--                     caregiver's children under the privacy-tier rule)
--   service_role   -> unchanged (ALL)
-- ============================================================================

revoke all on public.mood_checkins from anon;
