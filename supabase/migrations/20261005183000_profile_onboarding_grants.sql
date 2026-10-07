-- ============================================================================
-- SafeSpace Migration: 20261005183000_profile_onboarding_grants
--
-- Purpose:
--   Grant explicit table-level SELECT, INSERT, UPDATE, DELETE privileges to
--   the 'authenticated' PostgreSQL role on public.profiles,
--   public.profile_support_preferences, and public.profile_accessibility_preferences.
--
-- Security:
--   Row Level Security (RLS) policies remain fully enabled and strictly enforced:
--   - profiles: auth.uid() = id
--   - profile_support_preferences: auth.uid() = profile_id
--   - profile_accessibility_preferences: auth.uid() = profile_id
-- ============================================================================

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.profile_support_preferences to authenticated;
grant select, insert, update, delete on public.profile_accessibility_preferences to authenticated;
