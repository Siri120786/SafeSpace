-- ============================================================================
-- SafeSpace Sprint 2: Shared Mood Check-in
-- Migration: 20261019120000_mood_checkins
--
-- One table for both identity tracks (same pattern as the profile/child split
-- elsewhere):
--   - Adult auth users (profile_id -> public.profiles) write and read their own
--     rows directly, under RLS.
--   - Children (child_id -> public.children) have no auth.users row, so their
--     rows are written and read by the mood-checkin Edge Function using the
--     service role, scoped by the signed child-session token.
--
-- Privacy:
--   - A child's caregiver reads that child's check-ins under the SAME rule as
--     journal_entries (migration 0001): everything except a 'partial'-tier
--     child's private note.
--   - Linked caregivers (caregiver_user_links) get NO access to an adult
--     user's mood check-ins. See docs/caregiver-privacy-boundary.md.
--
-- Mood values are feelings the user picks, not a clinical assessment. No
-- distress scoring or escalation happens here; see docs/SPRINT_2_FOUNDATION.md.
-- ============================================================================

create table if not exists public.mood_checkins (
  id uuid primary key default gen_random_uuid(),

  profile_id uuid references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,

  -- Keep in sync with MOOD_VALUES in packages/shared-types and
  -- supabase/functions/_shared/moodCheckin.ts (a test checks all three).
  mood text not null
    check (mood in ('ecstatic', 'happy', 'neutral', 'sad', 'stressed', 'overwhelmed')),
  intensity smallint
    check (intensity between 1 and 5),
  note text
    check (note is null or char_length(btrim(note)) between 1 and 500),
  is_private_note boolean not null default false,

  created_at timestamptz not null default now(),

  constraint mood_checkins_one_owner check (
    (profile_id is not null and child_id is null) or
    (profile_id is null and child_id is not null)
  ),
  -- Private notes are a child privacy-tier feature only.
  constraint mood_checkins_private_note_child_only check (
    not is_private_note or child_id is not null
  )
);

create index if not exists idx_mood_checkins_profile_created
  on public.mood_checkins (profile_id, created_at desc);
create index if not exists idx_mood_checkins_child_created
  on public.mood_checkins (child_id, created_at desc);

-- A private note is only allowed when the child is on the 'partial' tier,
-- mirroring the rule documented on journal_entries.is_private_note. Enforced
-- here rather than only in the Edge Function so no writer can bypass it.
create or replace function public.enforce_mood_checkin_private_note_tier()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_private_note and not exists (
    select 1 from public.children c
    where c.id = new.child_id and c.privacy_tier = 'partial'
  ) then
    raise exception 'private_note_not_allowed_for_privacy_tier';
  end if;
  return new;
end;
$$;

create trigger enforce_mood_checkin_private_note_tier
  before insert or update on public.mood_checkins
  for each row execute function public.enforce_mood_checkin_private_note_tier();

alter table public.mood_checkins enable row level security;

-- History is append-only for clients. Supabase's default privileges grant
-- ALL on new public tables to `authenticated`, so revoke explicitly rather
-- than relying on a missing grant. (RLS has no update/delete policy either.)
revoke all on public.mood_checkins from authenticated;
grant select, insert on public.mood_checkins to authenticated;

create policy "Users read their own mood check-ins"
  on public.mood_checkins for select
  using (auth.uid() = profile_id);

create policy "Users create their own mood check-ins"
  on public.mood_checkins for insert
  with check (auth.uid() = profile_id and child_id is null);

create policy "Caregivers read child mood check-ins respecting privacy tier"
  on public.mood_checkins for select
  using (
    exists (
      select 1 from public.children c
      where c.id = mood_checkins.child_id
        and c.caregiver_id = auth.uid()
        and not (c.privacy_tier = 'partial' and mood_checkins.is_private_note = true)
    )
  );

comment on table public.mood_checkins is
  'Shared mood check-ins for adult users (profile_id) and children (child_id). User-selected feelings, not diagnoses.';
comment on column public.mood_checkins.intensity is
  'Optional self-rated intensity, 1 (a little) to 5 (a lot).';
comment on column public.mood_checkins.is_private_note is
  'Child-only. Hides the row from the caregiver when the child is on the partial privacy tier.';
