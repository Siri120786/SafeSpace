-- ============================================================================
-- SafeSpace — Core schema
-- Enforces the age-tiered privacy model and the safety-override rule
-- AT THE DATABASE LEVEL via Row Level Security (RLS), not in application code.
-- Rationale: filtering must happen server-side (see docs/Architecture_Specification.md
-- §3) — RLS is the strongest version of that rule, since even a bug in API code
-- cannot leak data past a policy Postgres itself enforces.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Caregivers (maps 1:1 to a Supabase auth.users row; this table holds
-- SafeSpace-specific profile data only, never credentials)
-- ----------------------------------------------------------------------------
create table caregivers (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  -- Short code a child's device enters ONCE so a bare 4-digit PIN can be
  -- resolved to the right family. Without it, PINs collide across families
  -- (only 10,000 combinations) and cannot identify a child.
  family_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_at timestamptz not null default now()
);

alter table caregivers enable row level security;

-- Supabase Auth creates auth.users rows; nothing creates the matching
-- caregivers row unless we do it here.
create or replace function public.handle_new_caregiver()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.caregivers (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_caregiver();

create policy "Caregivers can read and update their own row"
  on caregivers for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- Condition modules (static reference table — the six condition areas)
-- ----------------------------------------------------------------------------
create table condition_modules (
  key text primary key,          -- 'autism' | 'adhd' | 'anxiety' | 'depression' | 'ptsd' | 'pcos_pcod'
  display_name text not null,    -- friendly, non-clinical name shown to the child (e.g. "Calm Space")
  is_built boolean not null default false  -- honesty flag: only 'autism' is true until others are built
);

insert into condition_modules (key, display_name, is_built) values
  ('autism',     'My Space',     true),
  ('adhd',       'Focus Zone',   false),
  ('anxiety',    'Calm Space',   false),
  ('depression', 'Bright Days',  false),
  ('ptsd',       'Safe Harbor',  false),
  ('pcos_pcod',  'Cycle Care',   false);

-- ----------------------------------------------------------------------------
-- Children — the profile a caregiver creates. PIN is stored as a bcrypt hash,
-- never plaintext, and is verified server-side via the Edge Function in
-- supabase/functions/ (never compared client-side).
-- ----------------------------------------------------------------------------
create table children (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null references caregivers(id) on delete cascade,
  name text not null,
  age int not null check (age >= 4 and age <= 17),
  pin_hash text not null,
  privacy_tier text not null default 'full' check (privacy_tier in ('full', 'partial', 'private')),
  -- 'full'    -> ages 4-8,  caregiver sees everything
  -- 'partial' -> ages 9-12, child can attach a private note (see journal_entries.is_private_note)
  -- 'private' -> 13+, future scope, not yet enforced beyond this flag existing
  created_at timestamptz not null default now()
);

create table child_modules (
  child_id uuid not null references children(id) on delete cascade,
  module_key text not null references condition_modules(key),
  assigned_at timestamptz not null default now(),
  primary key (child_id, module_key)
);

alter table children enable row level security;
alter table child_modules enable row level security;

create policy "Caregivers manage their own children"
  on children for all
  using (auth.uid() = caregiver_id)
  with check (auth.uid() = caregiver_id);

create policy "Caregivers manage their own children's modules"
  on child_modules for all
  using (exists (select 1 from children c where c.id = child_id and c.caregiver_id = auth.uid()))
  with check (exists (select 1 from children c where c.id = child_id and c.caregiver_id = auth.uid()));

-- NOTE: children do not authenticate via Supabase Auth directly (no auth.users
-- row) — a child session is a short-lived, scoped token issued by the
-- verify-child-pin Edge Function after PIN verification. That function uses
-- the service role key server-side and returns a signed session limited to
-- one child_id. RLS above only governs the CAREGIVER's direct access.

-- ----------------------------------------------------------------------------
-- Shared feature: Journaling (used by all 6 modules — see docs/Architecture_
-- Specification.md §6 for which features call AI services vs. data only)
-- ----------------------------------------------------------------------------
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  module_key text not null references condition_modules(key),
  content text not null,             -- transcribed text (after STT, if voice input)
  sentiment_flags jsonb,             -- NLP output: e.g. {"distress_score": 0.2, "flags": []}
  is_private_note boolean not null default false,  -- true only possible when child.privacy_tier = 'partial'
  created_at timestamptz not null default now()
);

alter table journal_entries enable row level security;

-- THE AGE-TIERED PRIVACY RULE, ENFORCED IN SQL:
-- A caregiver may read a journal entry UNLESS it's marked as the child's
-- private note under the 'partial' tier. This is the literal implementation
-- of the age-tiered privacy model from the architecture spec.
create policy "Caregivers read journal entries respecting privacy tier"
  on journal_entries for select
  using (
    exists (
      select 1 from children c
      where c.id = journal_entries.child_id
        and c.caregiver_id = auth.uid()
        and not (c.privacy_tier = 'partial' and journal_entries.is_private_note = true)
    )
  );

-- Inserts happen via the child's scoped session (service role, bypasses RLS
-- by design — the child's own Edge-Function-issued token is the auth boundary
-- here, not a Postgres policy, since children have no auth.users row).

-- ----------------------------------------------------------------------------
-- Shared feature: Routines (the ONE feature that never calls AI — see spec §6)
-- ----------------------------------------------------------------------------
create table routine_steps (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  module_key text not null references condition_modules(key),
  label text not null,
  scheduled_time time,
  is_complete boolean not null default false,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

alter table routine_steps enable row level security;

create policy "Caregivers read and edit their children's routines"
  on routine_steps for all
  using (exists (select 1 from children c where c.id = routine_steps.child_id and c.caregiver_id = auth.uid()))
  with check (exists (select 1 from children c where c.id = routine_steps.child_id and c.caregiver_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- Shared feature: Stories (LLM-generated content)
-- ----------------------------------------------------------------------------
create table generated_stories (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  module_key text not null references condition_modules(key),
  prompt_context jsonb,      -- what situation the story was generated for
  content_text text,
  content_image_url text,
  created_at timestamptz not null default now()
);

alter table generated_stories enable row level security;

create policy "Caregivers read their children's generated stories"
  on generated_stories for select
  using (exists (select 1 from children c where c.id = generated_stories.child_id and c.caregiver_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- Shared feature: Emergency escalation log
-- Implements the 5-step flow from docs/Architecture_Specification.md §5:
-- distress detected -> classifier check -> privacy override -> AI alert -> logged.
-- This table IS the "logged" step, and its RLS policy IS the "privacy override"
-- step — caregivers can always read this table regardless of the child's
-- privacy_tier, because emergency logs are exempt from the tier system entirely.
-- ----------------------------------------------------------------------------
create table emergency_events (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  triggered_by text not null,        -- 'check_in' | 'aac_tap' | 'journal_flag'
  classifier_score numeric,          -- safety classifier's confidence, not a diagnosis
  ai_alert_summary text,             -- the short LLM-drafted summary sent to the caregiver
  caregiver_notified_at timestamptz,
  reviewed_at timestamptz,           -- post-incident review, per methodology's "test, don't just trust" rule
  reviewed_by uuid references caregivers(id),
  created_at timestamptz not null default now()
);

alter table emergency_events enable row level security;

-- HARD OVERRIDE: no privacy_tier condition anywhere in this policy, by design.
create policy "Caregivers always read emergency events for their children"
  on emergency_events for select
  using (exists (select 1 from children c where c.id = emergency_events.child_id and c.caregiver_id = auth.uid()));

create policy "Caregivers can mark events reviewed"
  on emergency_events for update
  using (exists (select 1 from children c where c.id = emergency_events.child_id and c.caregiver_id = auth.uid()))
  with check (exists (select 1 from children c where c.id = emergency_events.child_id and c.caregiver_id = auth.uid()));
