-- ============================================================================
-- SafeSpace: Safe Harbor's "My calm plan"
-- Migration: 20261030200000_calm_plans
--
-- Siri decided (2026-10-25) that Safe Harbor (the PTSD module) gets a calm
-- plan each person keeps for hard moments: signs that they need a pause, what
-- helps them feel safe, people they can reach out to, and places that feel
-- calm. It is saved to the account.
--
--   calm_plans   one row per person: an adult (profile_id) or a child
--                (child_id), never both. `plan` is a JSON object the app
--                shapes and checks; the database checks it is an object of
--                at most 8 KB.
--
-- Access:
--   adults      -> their own plan only, directly under RLS. Nobody else
--                  (not a linked caregiver) can read it.
--   children    -> no Supabase login; read and save their own plan through
--                  the `focus-tools` Edge Function (service role).
--   caregivers  -> READ a child's plan under the mood check-in rule
--                  (caregiver_can_see_child_activity: under 15 always, 15+
--                  only when the child shares). They can't change it.
--   anon        -> nothing
-- ============================================================================

create or replace function public.valid_calm_plan(p jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(jsonb_typeof(p), '') = 'object' and octet_length(p::text) <= 8192;
$$;

create table public.calm_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete cascade,
  child_id uuid unique references public.children(id) on delete cascade,
  plan jsonb not null default '{}'::jsonb check (public.valid_calm_plan(plan)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calm_plans_one_owner check ((profile_id is null) <> (child_id is null))
);

create trigger set_calm_plans_updated_at
  before update on public.calm_plans
  for each row execute function public.handle_updated_at();

alter table public.calm_plans enable row level security;

create policy "Adults read their own calm plan" on public.calm_plans
  for select to authenticated using (auth.uid() = profile_id);
create policy "Adults start their own calm plan" on public.calm_plans
  for insert to authenticated with check (auth.uid() = profile_id and child_id is null);
create policy "Adults change their own calm plan" on public.calm_plans
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id and child_id is null);
create policy "Adults delete their own calm plan" on public.calm_plans
  for delete to authenticated using (auth.uid() = profile_id);
create policy "Caregivers read a child's calm plan when shared" on public.calm_plans
  for select to authenticated using (child_id is not null and public.caregiver_can_see_child_activity(child_id));

-- Hosted projects grant nothing by default, local ones grant everything:
-- revoke, then grant exactly what the policies and the function need.
revoke all on public.calm_plans from anon, authenticated, service_role;
grant select, insert, update, delete on public.calm_plans to authenticated;
grant select, insert, update on public.calm_plans to service_role;

comment on table public.calm_plans is
  'Safe Harbor calm plan, one row per adult or child. Adults: only themselves. A child''s caregivers read it under the age-15 sharing rule.';
