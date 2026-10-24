-- ============================================================================
-- SafeSpace: Cycle Care (PCOS / PCOD) saved to the person's account
-- Migration: 20261029300000_cycle_care
--
-- Cycle Care kept the chosen label, the diet plan (with rewards), the health
-- profile and the movement log in browser storage under fixed keys, shared by
-- everyone on the device. Siri decided (2026-10-24) to keep it in the account
-- instead, so each person can come back to it on any device and nobody else
-- on a shared device sees it.
--
--   cycle_care_data  one row per adult: condition ('pcos' | 'pcod' | 'unsure')
--                    and three JSON parts the web app shapes and checks:
--                    diet, profile (health profile) and exercise.
--
-- Access: ONLY the person themselves (RLS on auth.uid()). No caregiver, no
-- linked adult, no service-role reads from any function. anon: nothing.
-- Not saved (as before): check-ins, notes, the water tally. Medicine
-- reminders already live in the account (reminders).
-- ============================================================================

-- A JSON part: an object, at most 64 KB as text (the app's own limits keep
-- real data far smaller: e.g. at most 400 movement entries).
create or replace function public.valid_cycle_care_part(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null or (coalesce(jsonb_typeof(p), '') = 'object' and octet_length(p::text) <= 65536);
$$;

create table public.cycle_care_data (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  condition text check (condition in ('pcos', 'pcod', 'unsure')),
  diet jsonb check (public.valid_cycle_care_part(diet)),
  profile jsonb check (public.valid_cycle_care_part(profile)),
  exercise jsonb check (public.valid_cycle_care_part(exercise)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_cycle_care_data_updated_at
  before update on public.cycle_care_data
  for each row execute function public.handle_updated_at();

alter table public.cycle_care_data enable row level security;

create policy "People read their own Cycle Care" on public.cycle_care_data
  for select to authenticated using (auth.uid() = profile_id);
create policy "People start their own Cycle Care" on public.cycle_care_data
  for insert to authenticated with check (auth.uid() = profile_id);
create policy "People change their own Cycle Care" on public.cycle_care_data
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "People delete their own Cycle Care" on public.cycle_care_data
  for delete to authenticated using (auth.uid() = profile_id);

-- Hosted projects grant nothing by default, local ones grant everything:
-- revoke, then grant exactly what the policies need.
revoke all on public.cycle_care_data from anon, authenticated, service_role;
grant select, insert, update, delete on public.cycle_care_data to authenticated;

comment on table public.cycle_care_data is
  'Cycle Care (PCOS / PCOD): label, diet plan, health profile and movement, one row per person. Only that person can read or change it.';
