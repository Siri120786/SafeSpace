-- ============================================================================
-- SafeSpace Sprint 1 (Trisha): Caregiver-to-linked-user foundation
-- Migration: 20261009170000_caregiver_user_links
--
-- Adds a link between a caregiver profile and a linked adult user profile.
-- An actively linked caregiver gets READ-ONLY access to exactly:
--   profiles, profile_support_preferences, profile_accessibility_preferences
-- No journals, mood entries, AI data or notes. No caregiver write access.
-- Links are created by the service role only in Sprint 1 (no client insert).
-- ============================================================================

create table if not exists public.caregiver_user_links (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint caregiver_user_links_unique_pair unique (caregiver_id, user_id),
  constraint caregiver_user_links_not_self check (caregiver_id <> user_id)
);

alter table public.caregiver_user_links enable row level security;

-- Read-only for clients. No insert/update/delete grant or policy.
grant select on public.caregiver_user_links to authenticated;

create policy "Caregivers can view their own links"
  on public.caregiver_user_links for select
  using (auth.uid() = caregiver_id);

create trigger set_caregiver_user_links_updated_at
  before update on public.caregiver_user_links
  for each row execute function public.handle_updated_at();

-- Linked caregivers may READ (select only) the linked user's data.
create policy "Linked caregivers can view linked user profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.caregiver_user_links l
      where l.caregiver_id = auth.uid()
        and l.user_id = profiles.id
        and l.status = 'active'
    )
  );

create policy "Linked caregivers can view linked user support preferences"
  on public.profile_support_preferences for select
  using (
    exists (
      select 1 from public.caregiver_user_links l
      where l.caregiver_id = auth.uid()
        and l.user_id = profile_support_preferences.profile_id
        and l.status = 'active'
    )
  );

create policy "Linked caregivers can view linked user accessibility preferences"
  on public.profile_accessibility_preferences for select
  using (
    exists (
      select 1 from public.caregiver_user_links l
      where l.caregiver_id = auth.uid()
        and l.user_id = profile_accessibility_preferences.profile_id
        and l.status = 'active'
    )
  );

comment on table public.caregiver_user_links is
  'Caregiver to linked-user relationship. Grants read-only access to basic profile data only.';