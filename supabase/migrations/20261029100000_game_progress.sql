-- ============================================================================
-- SafeSpace Sprint 4: Games Corner progress and preferences
-- Migration: 20261029100000_game_progress
--
-- Game rules and puzzles run on the device. Only a short progress record is
-- stored, plus the player's comfort settings.
--
--   game_progress    : per owner, game and level: rounds finished, best score
--                      (0-100, or null for open-ended games), last played.
--   game_preferences : per owner: preferred level, reduced motion, sound,
--                      read-aloud.
--
-- Owner is exactly one of (same pattern as routines and reminders):
--   profile_id  an adult with a Supabase login (profiles.id = auth.uid())
--   child_id    a child, who has NO Supabase login
--
-- Access:
--   adults      -> read, write and delete their own rows (RLS)
--   caregivers  -> READ-only on their children's rows, through
--                  caregiver_can_see_child_activity(child_id) for progress
--                  (honours the age-15 sharing choice) and is_caregiver_of
--                  for comfort settings; nobody who merely knows a child's id
--                  can read anything
--   children    -> only through the `games` Edge Function (service role),
--                  which derives child_id from the signed session token and
--                  calls the *_child_* functions below
--   linked caregivers of an adult -> nothing
--   anon        -> nothing
-- Game answers and scores are never used to infer ability or a diagnosis.
-- The ids below must match GAME_IDS in packages/shared-types.
-- ============================================================================

create table public.game_progress (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  game_id text not null
    check (game_id in ('memory-match', 'pattern-quest', 'feelings-detective', 'imagine-create', 'maze-explorer')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  rounds_completed integer not null default 0 check (rounds_completed >= 0),
  best_score integer check (best_score between 0 and 100),
  last_played_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint game_progress_one_owner check (
    (profile_id is not null and child_id is null) or
    (profile_id is null and child_id is not null)
  )
);

create unique index game_progress_profile_unique
  on public.game_progress (profile_id, game_id, difficulty) where profile_id is not null;
create unique index game_progress_child_unique
  on public.game_progress (child_id, game_id, difficulty) where child_id is not null;
create index game_progress_profile_last_played_idx
  on public.game_progress (profile_id, last_played_at desc) where profile_id is not null;
create index game_progress_child_last_played_idx
  on public.game_progress (child_id, last_played_at desc) where child_id is not null;

create trigger set_game_progress_updated_at
  before update on public.game_progress
  for each row execute function public.handle_updated_at();

create table public.game_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  difficulty text not null default 'easy' check (difficulty in ('easy', 'medium', 'hard')),
  reduced_motion boolean not null default false,
  sound_enabled boolean not null default true,
  voice_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint game_preferences_one_owner check (
    (profile_id is not null and child_id is null) or
    (profile_id is null and child_id is not null)
  )
);

create unique index game_preferences_profile_unique
  on public.game_preferences (profile_id) where profile_id is not null;
create unique index game_preferences_child_unique
  on public.game_preferences (child_id) where child_id is not null;

create trigger set_game_preferences_updated_at
  before update on public.game_preferences
  for each row execute function public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.game_progress enable row level security;
alter table public.game_preferences enable row level security;

-- Hosted projects grant nothing by default, local ones grant everything:
-- revoke, then grant exactly what the policies and functions need.
revoke all on public.game_progress from anon, authenticated, service_role;
revoke all on public.game_preferences from anon, authenticated, service_role;
grant select, insert, update, delete on public.game_progress to authenticated;
grant select, insert, update, delete on public.game_preferences to authenticated;
-- The `games` Edge Function: read a child's rows and call the child functions.
grant select, insert, update on public.game_progress to service_role;
grant select, insert, update on public.game_preferences to service_role;

create policy "Adults read own game progress"
  on public.game_progress for select to authenticated
  using (auth.uid() = profile_id);
create policy "Adults insert own game progress"
  on public.game_progress for insert to authenticated
  with check (auth.uid() = profile_id and child_id is null);
create policy "Adults update own game progress"
  on public.game_progress for update to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id and child_id is null);
create policy "Adults delete own game progress"
  on public.game_progress for delete to authenticated
  using (auth.uid() = profile_id);
-- Rounds played are activity, so they follow the same rule as mood check-ins
-- and routines: a caregiver sees them unless the young person (15+) has chosen
-- not to share (caregiver_can_see_child_activity, role flow M2).
create policy "Caregivers read their children's game progress"
  on public.game_progress for select to authenticated
  using (child_id is not null and public.caregiver_can_see_child_activity(child_id));

create policy "Adults read own game preferences"
  on public.game_preferences for select to authenticated
  using (auth.uid() = profile_id);
create policy "Adults insert own game preferences"
  on public.game_preferences for insert to authenticated
  with check (auth.uid() = profile_id and child_id is null);
create policy "Adults update own game preferences"
  on public.game_preferences for update to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id and child_id is null);
create policy "Adults delete own game preferences"
  on public.game_preferences for delete to authenticated
  using (auth.uid() = profile_id);
create policy "Caregivers read their children's game preferences"
  on public.game_preferences for select to authenticated
  using (child_id is not null and public.is_caregiver_of(child_id));

-- ----------------------------------------------------------------------------
-- Atomic helpers. Adult versions are SECURITY INVOKER: the owner is always
-- auth.uid(), never a parameter, and RLS still applies.
-- ----------------------------------------------------------------------------
create or replace function public.record_game_round(
  p_game_id text,
  p_difficulty text,
  p_score integer default null
)
returns public.game_progress
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.game_progress;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;
  if p_score is not null and (p_score < 0 or p_score > 100) then
    raise exception 'invalid_input';
  end if;

  insert into public.game_progress as g (profile_id, game_id, difficulty, rounds_completed, best_score)
  values (auth.uid(), p_game_id, p_difficulty, 1, p_score)
  on conflict (profile_id, game_id, difficulty) where profile_id is not null
  do update set
    rounds_completed = g.rounds_completed + 1,
    best_score = case
      when excluded.best_score is null then g.best_score
      when g.best_score is null then excluded.best_score
      else greatest(g.best_score, excluded.best_score)
    end,
    last_played_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.save_game_preferences(
  p_difficulty text,
  p_reduced_motion boolean,
  p_sound_enabled boolean,
  p_voice_enabled boolean
)
returns public.game_preferences
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.game_preferences;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  insert into public.game_preferences as p (profile_id, difficulty, reduced_motion, sound_enabled, voice_enabled)
  values (auth.uid(), p_difficulty, p_reduced_motion, p_sound_enabled, p_voice_enabled)
  on conflict (profile_id) where profile_id is not null
  do update set
    difficulty = excluded.difficulty,
    reduced_motion = excluded.reduced_motion,
    sound_enabled = excluded.sound_enabled,
    voice_enabled = excluded.voice_enabled
  returning * into v_row;
  return v_row;
end;
$$;

-- Child versions: called ONLY by the `games` Edge Function, which has already
-- verified the child's signed session and passes that child's id.
create or replace function public.record_child_game_round(
  p_child_id uuid,
  p_game_id text,
  p_difficulty text,
  p_score integer default null
)
returns public.game_progress
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.game_progress;
begin
  if p_child_id is null then
    raise exception 'unauthorized';
  end if;
  if p_score is not null and (p_score < 0 or p_score > 100) then
    raise exception 'invalid_input';
  end if;

  insert into public.game_progress as g (child_id, game_id, difficulty, rounds_completed, best_score)
  values (p_child_id, p_game_id, p_difficulty, 1, p_score)
  on conflict (child_id, game_id, difficulty) where child_id is not null
  do update set
    rounds_completed = g.rounds_completed + 1,
    best_score = case
      when excluded.best_score is null then g.best_score
      when g.best_score is null then excluded.best_score
      else greatest(g.best_score, excluded.best_score)
    end,
    last_played_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.save_child_game_preferences(
  p_child_id uuid,
  p_difficulty text,
  p_reduced_motion boolean,
  p_sound_enabled boolean,
  p_voice_enabled boolean
)
returns public.game_preferences
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.game_preferences;
begin
  if p_child_id is null then
    raise exception 'unauthorized';
  end if;

  insert into public.game_preferences as p (child_id, difficulty, reduced_motion, sound_enabled, voice_enabled)
  values (p_child_id, p_difficulty, p_reduced_motion, p_sound_enabled, p_voice_enabled)
  on conflict (child_id) where child_id is not null
  do update set
    difficulty = excluded.difficulty,
    reduced_motion = excluded.reduced_motion,
    sound_enabled = excluded.sound_enabled,
    voice_enabled = excluded.voice_enabled
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.record_game_round(text, text, integer) from public, anon;
revoke all on function public.save_game_preferences(text, boolean, boolean, boolean) from public, anon;
revoke all on function public.record_child_game_round(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.save_child_game_preferences(uuid, text, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function public.record_game_round(text, text, integer) to authenticated;
grant execute on function public.save_game_preferences(text, boolean, boolean, boolean) to authenticated;
grant execute on function public.record_child_game_round(uuid, text, text, integer) to service_role;
grant execute on function public.save_child_game_preferences(uuid, text, boolean, boolean, boolean) to service_role;

comment on table public.game_progress is
  'Games Corner: rounds finished per owner, game and level. Activity only; never used to infer ability or diagnosis.';
comment on table public.game_preferences is
  'Games Corner comfort settings per owner: level, reduced motion, sound, read-aloud.';
