-- ============================================================================
-- SafeSpace Sprint 1: Profile & Onboarding Preferences
-- Migration: 20261005152905_profile_onboarding
--
-- Purpose:
--   1. Store authenticated user's selected support areas.
--   2. Store accessibility preferences separately from identity.
--   3. Enforce ownership through PostgreSQL RLS.
--   4. Keep profiles focused on identity + onboarding state.
--
-- Important:
--   Support areas are user-selected support preferences.
--   They are NOT diagnoses.
-- ============================================================================


-- ============================================================================
-- 1. PROFILE SUPPORT PREFERENCES
-- ============================================================================

create table if not exists public.profile_support_preferences (
  profile_id uuid primary key
    references public.profiles(id) on delete cascade,

  support_areas text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_support_preferences_valid_modules
    check (
      support_areas <@ array[
        'autism',
        'adhd',
        'anxiety',
        'depression',
        'ptsd',
        'pcos_pcod'
      ]::text[]
    )
);

alter table public.profile_support_preferences enable row level security;


-- Users can read their own support preferences.
create policy "Users can view their own support preferences"
  on public.profile_support_preferences
  for select
  using (auth.uid() = profile_id);


-- Users can create their own support preferences.
create policy "Users can create their own support preferences"
  on public.profile_support_preferences
  for insert
  with check (auth.uid() = profile_id);


-- Users can update their own support preferences.
create policy "Users can update their own support preferences"
  on public.profile_support_preferences
  for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);


-- Users can delete their own support preferences.
create policy "Users can delete their own support preferences"
  on public.profile_support_preferences
  for delete
  using (auth.uid() = profile_id);


-- Reuse the existing updated_at trigger function from 0003.
create trigger set_profile_support_preferences_updated_at
  before update on public.profile_support_preferences
  for each row execute function public.handle_updated_at();


-- ============================================================================
-- 2. PROFILE ACCESSIBILITY PREFERENCES
-- ============================================================================

create table if not exists public.profile_accessibility_preferences (
  profile_id uuid primary key
    references public.profiles(id) on delete cascade,

  reduced_sensory_stimulation boolean not null default false,
  larger_text boolean not null default false,
  read_aloud boolean not null default false,
  simplified_presentation boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile_accessibility_preferences enable row level security;


-- Users can read their own accessibility preferences.
create policy "Users can view their own accessibility preferences"
  on public.profile_accessibility_preferences
  for select
  using (auth.uid() = profile_id);


-- Users can create their own accessibility preferences.
create policy "Users can create their own accessibility preferences"
  on public.profile_accessibility_preferences
  for insert
  with check (auth.uid() = profile_id);


-- Users can update their own accessibility preferences.
create policy "Users can update their own accessibility preferences"
  on public.profile_accessibility_preferences
  for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);


-- Users can delete their own accessibility preferences.
create policy "Users can delete their own accessibility preferences"
  on public.profile_accessibility_preferences
  for delete
  using (auth.uid() = profile_id);


create trigger set_profile_accessibility_preferences_updated_at
  before update on public.profile_accessibility_preferences
  for each row execute function public.handle_updated_at();


-- ============================================================================
-- 3. INDEXES
-- ============================================================================

create index if not exists idx_profile_support_preferences_support_areas
  on public.profile_support_preferences
  using gin (support_areas);


-- ============================================================================
-- 4. DOCUMENTATION
-- ============================================================================

comment on table public.profile_support_preferences is
  'Authenticated user-selected support areas. These represent support preferences, not diagnoses.';

comment on table public.profile_accessibility_preferences is
  'Authenticated user accessibility and presentation preferences.';

comment on column public.profile_support_preferences.support_areas is
  'Selected SafeSpace support areas using the shared ModuleKey values.';

comment on column public.profile_accessibility_preferences.reduced_sensory_stimulation is
  'User prefers reduced sensory stimulation in the SafeSpace interface.';

comment on column public.profile_accessibility_preferences.larger_text is
  'User prefers larger text presentation.';

comment on column public.profile_accessibility_preferences.read_aloud is
  'User prefers supported content to be available through read-aloud functionality.';

comment on column public.profile_accessibility_preferences.simplified_presentation is
  'User prefers simplified presentation of supported content.';
