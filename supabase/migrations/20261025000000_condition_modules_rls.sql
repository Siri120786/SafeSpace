-- ============================================================================
-- SafeSpace: lock down condition_modules (static reference data)
-- Migration: 20261025000000_condition_modules_rls
--
-- 0001 created condition_modules without RLS, and Supabase's default
-- privileges gave anon/authenticated ALL on it, so any client could insert,
-- rename, delete or flip is_built on the six modules. It is static reference
-- data (0001 "static reference table", docs/DATABASE_SCHEMA.md); changes ship
-- as migrations, which run as the table owner.
--
-- After this migration:
--   anon           -> nothing (no pre-login screen reads it; children use
--                     Edge Functions with the service role)
--   authenticated  -> SELECT only (read-only reference data)
--   service_role   -> unchanged (ALL, bypasses RLS) for trusted backend use
--   foreign keys from child_modules / journal_entries / routine_steps /
--   generated_stories keep working: FK checks bypass RLS and run as owner.
-- ============================================================================

alter table public.condition_modules enable row level security;

revoke all on public.condition_modules from anon, authenticated;
grant select on public.condition_modules to authenticated;

create policy "Authenticated users read condition modules"
  on public.condition_modules for select
  to authenticated
  using (true);
