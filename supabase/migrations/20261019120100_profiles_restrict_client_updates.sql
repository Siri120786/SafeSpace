-- ============================================================================
-- SafeSpace Sprint 2: Restrict which profile columns clients may update
-- Migration: 20261019120100_profiles_restrict_client_updates
--
-- The "Users can update their own profile" policy (0003) checks row ownership
-- only, and earlier migrations granted table-wide UPDATE. That let a user
-- change their own `role` (e.g. 'user' -> 'caregiver') with a direct API call.
--
-- Clients only ever update display_name and onboarding_state (web
-- packages/api-client/src/profile.ts, Flutter profile_service.dart), so the
-- UPDATE privilege is narrowed to those columns. RLS still applies on top.
-- updated_at keeps working: it is set by the trigger, not by the client.
-- ============================================================================

revoke update on public.profiles from authenticated;
grant update (display_name, onboarding_state) on public.profiles to authenticated;
