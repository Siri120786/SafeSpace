-- ============================================================================
-- SafeSpace role flow, step 8e: database for the ADHD and autism tools
-- Migration: 20261028200000_focus_tools
--
-- Manju's tools (Workstream B) saved on the device until now. This moves
-- them to the database so they follow the person to any device and
-- caregivers can see progress.
--
-- Every table uses the dual-owner pattern of routines and journal: an adult
-- profile_id OR a child child_id, exactly one.
--
--   focus_sessions   finished focus / Pomodoro sessions (append-only)
--   focus_tasks      a task and its small steps (steps as a checked JSON list)
--   habits           up to 20 habits; habit_checks holds one row per day ticked
--   star_events      each star award (unique key per owner, so un-ticking and
--                    re-ticking can't farm stars) and each goal claimed
--   star_goals       the current star goal
--   emotion_choices  which feelings card was picked, and when
--   tool_settings    countdown preset and sentence-builder word labels
--
-- Access:
--   adults      -> their own rows, directly under RLS
--   children    -> no Supabase login; read and write their own rows through
--                  the `focus-tools` Edge Function (service role, step 8e-2)
--   caregivers  -> READ a child's sessions, tasks, habits, stars and emotion
--                  choices under the mood check-in rule
--                  (caregiver_can_see_child_activity: under 15 always, 15+
--                  only when the child shares). Any caregiver of the child
--                  can read and set the child's star goal and tool settings
--                  (configuration, step 8f).
--   anon        -> nothing
-- Decisions (Siri, 2026-10-24): children can't delete emotion choices (like
-- mood check-ins); adults can clear their own.
--
-- Alerts: "I want a grown-up" on the feelings cards raises the same caregiver
-- alert as the talk board's "I need help", labelled 'feelings_card'. A second
-- press of either within 2 minutes is the same alert.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Shared checks
-- ----------------------------------------------------------------------------

-- A task's steps: up to 30 objects {id, label, isComplete, orderIndex,
-- completedAt?}. Missing or wrong-typed fields fail (coalesce, so a missing
-- field never slips through as null).
create or replace function public.valid_task_steps(p jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(jsonb_typeof(p), '') = 'array'
     and jsonb_array_length(p) <= 30
     and not exists (
       select 1 from jsonb_array_elements(p) e
       where coalesce(jsonb_typeof(e), '') <> 'object'
          or coalesce(jsonb_typeof(e -> 'id'), '') <> 'string'
          or char_length(e ->> 'id') not between 1 and 64
          or coalesce(jsonb_typeof(e -> 'label'), '') <> 'string'
          or char_length(btrim(e ->> 'label')) not between 1 and 120
          or coalesce(jsonb_typeof(e -> 'isComplete'), '') <> 'boolean'
          or coalesce(jsonb_typeof(e -> 'orderIndex'), '') <> 'number'
          or (e ? 'completedAt' and coalesce(jsonb_typeof(e -> 'completedAt'), '') not in ('number', 'null'))
     );
$$;

-- The countdown preset: {activity: 1-60 chars, totalSeconds: 10-3600}.
create or replace function public.valid_transition_preset(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null or (
    coalesce(jsonb_typeof(p), '') = 'object'
    and coalesce(jsonb_typeof(p -> 'activity'), '') = 'string'
    and char_length(btrim(p ->> 'activity')) between 1 and 60
    and coalesce(jsonb_typeof(p -> 'totalSeconds'), '') = 'number'
    and (p ->> 'totalSeconds')::numeric between 10 and 3600
  );
$$;

-- Sentence-builder word labels: {tileId: label}, up to 40, labels 1-30 chars.
create or replace function public.valid_aac_labels(p jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(jsonb_typeof(p), '') = 'object'
     and (select count(*) from jsonb_object_keys(p)) <= 40
     and not exists (
       select 1 from jsonb_each(p) kv
       where char_length(kv.key) not between 1 and 40
          or coalesce(jsonb_typeof(kv.value), '') <> 'string'
          or char_length(btrim(kv.value #>> '{}')) not between 1 and 30
     );
$$;

-- A cap on how many rows one owner may have in a table (TG_ARGV[0]).
-- Serialised per owner, so simultaneous inserts can't pass it.
create or replace function public.focus_tools_owner_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := TG_ARGV[0]::integer;
  v_count integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(TG_TABLE_NAME || ':' || coalesce(new.profile_id, new.child_id)::text, 0)
  );
  execute format(
    'select count(*) from public.%I where profile_id is not distinct from $1 and child_id is not distinct from $2',
    TG_TABLE_NAME
  ) into v_count using new.profile_id, new.child_id;
  if v_count >= v_limit then
    raise exception 'limit_reached';
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Focus sessions
-- ----------------------------------------------------------------------------
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  ended_at timestamptz not null default now(),
  duration_seconds integer not null check (duration_seconds between 1 and 14400),
  mode text not null check (mode in ('simple', 'pomodoro')),
  phase text check (phase in ('focus', 'shortBreak', 'longBreak')),
  completed boolean not null default true,
  activity_label text check (activity_label is null or char_length(btrim(activity_label)) between 1 and 80),
  created_at timestamptz not null default now(),
  constraint focus_sessions_one_owner check ((profile_id is null) <> (child_id is null))
);
create index focus_sessions_profile_idx on public.focus_sessions (profile_id, ended_at desc) where profile_id is not null;
create index focus_sessions_child_idx on public.focus_sessions (child_id, ended_at desc) where child_id is not null;

-- At most 100 sessions per owner in any 24 hours (a session lasts at least a
-- minute in the app; this stops runaway writes, not real use).
create or replace function public.focus_sessions_daily_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('focus_sessions:' || coalesce(new.profile_id, new.child_id)::text, 0)
  );
  if (select count(*) from public.focus_sessions
      where profile_id is not distinct from new.profile_id and child_id is not distinct from new.child_id
        and created_at > clock_timestamp() - interval '24 hours') >= 100 then
    raise exception 'limit_reached';
  end if;
  return new;
end;
$$;
create trigger focus_sessions_daily_limit
  before insert on public.focus_sessions
  for each row execute function public.focus_sessions_daily_limit();

-- ----------------------------------------------------------------------------
-- Tasks
-- ----------------------------------------------------------------------------
create table public.focus_tasks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  steps jsonb not null default '[]'::jsonb check (public.valid_task_steps(steps)),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint focus_tasks_one_owner check ((profile_id is null) <> (child_id is null))
);
create index focus_tasks_profile_idx on public.focus_tasks (profile_id, created_at desc) where profile_id is not null;
create index focus_tasks_child_idx on public.focus_tasks (child_id, created_at desc) where child_id is not null;
create trigger set_focus_tasks_updated_at
  before update on public.focus_tasks
  for each row execute function public.handle_updated_at();
create trigger focus_tasks_owner_limit
  before insert on public.focus_tasks
  for each row execute function public.focus_tools_owner_limit('50');

-- ----------------------------------------------------------------------------
-- Habits and the days they were ticked
-- ----------------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  icon text check (icon is null or char_length(icon) between 1 and 16),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint habits_one_owner check ((profile_id is null) <> (child_id is null))
);
create index habits_profile_idx on public.habits (profile_id) where profile_id is not null;
create index habits_child_idx on public.habits (child_id) where child_id is not null;
create trigger habits_owner_limit
  before insert on public.habits
  for each row execute function public.focus_tools_owner_limit('20');

create table public.habit_checks (
  habit_id uuid not null references public.habits(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, day)
);

-- A tick is for the last month, up to a day ahead (time zones).
create or replace function public.habit_checks_day_window()
returns trigger
language plpgsql
as $$
begin
  if new.day < current_date - 31 or new.day > current_date + 1 then
    raise exception 'invalid_input';
  end if;
  return new;
end;
$$;
create trigger habit_checks_day_window
  before insert on public.habit_checks
  for each row execute function public.habit_checks_day_window();

-- ----------------------------------------------------------------------------
-- Stars: awards and claims, and the goal
-- ----------------------------------------------------------------------------
create table public.star_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  event_key text not null check (char_length(event_key) between 1 and 160),
  kind text not null check (kind in ('award', 'claim')),
  stars integer not null,
  created_at timestamptz not null default now(),
  constraint star_events_one_owner check ((profile_id is null) <> (child_id is null)),
  constraint star_events_amount check (
    (kind = 'award' and stars between 1 and 10) or (kind = 'claim' and stars between -100 and -1)
  ),
  -- One award per event per owner: re-ticking a step can't earn twice.
  constraint star_events_profile_key unique (profile_id, event_key),
  constraint star_events_child_key unique (child_id, event_key)
);
create index star_events_child_idx on public.star_events (child_id) where child_id is not null;

create table public.star_goals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete cascade,
  child_id uuid unique references public.children(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  target_stars integer not null check (target_stars between 1 and 100),
  icon text check (icon is null or char_length(icon) between 1 and 16),
  updated_at timestamptz not null default now(),
  constraint star_goals_one_owner check ((profile_id is null) <> (child_id is null))
);
create trigger set_star_goals_updated_at
  before update on public.star_goals
  for each row execute function public.handle_updated_at();

-- Claim the goal: if there are enough stars, spend the goal's target. Atomic
-- per owner, so two taps can't spend twice. A missing goal counts as 10 stars.
-- Internal: called by the two functions below.
create or replace function public.claim_star_goal_for(p_profile_id uuid, p_child_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target integer;
  v_current integer;
begin
  if (p_profile_id is null) = (p_child_id is null) then
    raise exception 'invalid_input';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('stars:' || coalesce(p_profile_id, p_child_id)::text, 0));
  select target_stars into v_target from public.star_goals
  where profile_id is not distinct from p_profile_id and child_id is not distinct from p_child_id;
  v_target := coalesce(v_target, 10);
  select coalesce(sum(stars), 0) into v_current from public.star_events
  where profile_id is not distinct from p_profile_id and child_id is not distinct from p_child_id;
  if v_current < v_target then
    return jsonb_build_object('claimed', false, 'currentStars', v_current);
  end if;
  insert into public.star_events (profile_id, child_id, event_key, kind, stars)
  values (p_profile_id, p_child_id, 'claim:' || gen_random_uuid(), 'claim', -v_target);
  return jsonb_build_object('claimed', true, 'currentStars', v_current - v_target);
end;
$$;

-- An adult claims their own goal.
create or replace function public.claim_my_star_goal()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_found';
  end if;
  return public.claim_star_goal_for(auth.uid(), null);
end;
$$;

-- Server only (focus-tools Edge Function, after verifying the child session).
create or replace function public.claim_child_star_goal(p_child_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.children where id = p_child_id) then
    raise exception 'not_found';
  end if;
  return public.claim_star_goal_for(null, p_child_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- Emotion choices (feelings cards)
-- ----------------------------------------------------------------------------
create table public.emotion_choices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  card_id text not null check (card_id in (
    'happy', 'calm', 'ecstatic', 'neutral', 'sad', 'tired', 'stressed', 'overwhelmed', 'proud', 'curious'
  )),
  created_at timestamptz not null default now(),
  constraint emotion_choices_one_owner check ((profile_id is null) <> (child_id is null))
);
create index emotion_choices_profile_idx on public.emotion_choices (profile_id, created_at desc) where profile_id is not null;
create index emotion_choices_child_idx on public.emotion_choices (child_id, created_at desc) where child_id is not null;

-- ----------------------------------------------------------------------------
-- Tool settings (one row per person)
-- ----------------------------------------------------------------------------
create table public.tool_settings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete cascade,
  child_id uuid unique references public.children(id) on delete cascade,
  transition_preset jsonb check (public.valid_transition_preset(transition_preset)),
  aac_labels jsonb not null default '{}'::jsonb check (public.valid_aac_labels(aac_labels)),
  updated_at timestamptz not null default now(),
  constraint tool_settings_one_owner check ((profile_id is null) <> (child_id is null))
);
create trigger set_tool_settings_updated_at
  before update on public.tool_settings
  for each row execute function public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- Row-level security
-- ----------------------------------------------------------------------------
alter table public.focus_sessions enable row level security;
alter table public.focus_tasks enable row level security;
alter table public.habits enable row level security;
alter table public.habit_checks enable row level security;
alter table public.star_events enable row level security;
alter table public.star_goals enable row level security;
alter table public.emotion_choices enable row level security;
alter table public.tool_settings enable row level security;

-- Focus sessions: adults keep and clear their own; caregivers read by the rule.
create policy "Adults read their own focus sessions" on public.focus_sessions
  for select to authenticated using (auth.uid() = profile_id);
create policy "Adults add their own focus sessions" on public.focus_sessions
  for insert to authenticated with check (auth.uid() = profile_id and child_id is null);
create policy "Adults clear their own focus sessions" on public.focus_sessions
  for delete to authenticated using (auth.uid() = profile_id);
create policy "Caregivers read child focus sessions when shared" on public.focus_sessions
  for select to authenticated using (child_id is not null and public.caregiver_can_see_child_activity(child_id));

-- Tasks.
create policy "Adults read their own tasks" on public.focus_tasks
  for select to authenticated using (auth.uid() = profile_id);
create policy "Adults add their own tasks" on public.focus_tasks
  for insert to authenticated with check (auth.uid() = profile_id and child_id is null);
create policy "Adults change their own tasks" on public.focus_tasks
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id and child_id is null);
create policy "Adults delete their own tasks" on public.focus_tasks
  for delete to authenticated using (auth.uid() = profile_id);
create policy "Caregivers read child tasks when shared" on public.focus_tasks
  for select to authenticated using (child_id is not null and public.caregiver_can_see_child_activity(child_id));

-- Habits.
create policy "Adults read their own habits" on public.habits
  for select to authenticated using (auth.uid() = profile_id);
create policy "Adults add their own habits" on public.habits
  for insert to authenticated with check (auth.uid() = profile_id and child_id is null);
create policy "Adults change their own habits" on public.habits
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id and child_id is null);
create policy "Adults delete their own habits" on public.habits
  for delete to authenticated using (auth.uid() = profile_id);
create policy "Caregivers read child habits when shared" on public.habits
  for select to authenticated using (child_id is not null and public.caregiver_can_see_child_activity(child_id));

-- Habit ticks follow their habit.
create policy "Adults read ticks of their own habits" on public.habit_checks
  for select to authenticated
  using (exists (select 1 from public.habits h where h.id = habit_id and h.profile_id = auth.uid()));
create policy "Adults tick their own habits" on public.habit_checks
  for insert to authenticated
  with check (exists (select 1 from public.habits h where h.id = habit_id and h.profile_id = auth.uid()));
create policy "Adults untick their own habits" on public.habit_checks
  for delete to authenticated
  using (exists (select 1 from public.habits h where h.id = habit_id and h.profile_id = auth.uid()));
create policy "Caregivers read child habit ticks when shared" on public.habit_checks
  for select to authenticated
  using (exists (select 1 from public.habits h where h.id = habit_id and h.child_id is not null
                 and public.caregiver_can_see_child_activity(h.child_id)));

-- Stars: adults add their own awards (claims only through claim_my_star_goal).
create policy "Adults read their own stars" on public.star_events
  for select to authenticated using (auth.uid() = profile_id);
create policy "Adults earn their own stars" on public.star_events
  for insert to authenticated with check (auth.uid() = profile_id and child_id is null and kind = 'award');
create policy "Caregivers read child stars when shared" on public.star_events
  for select to authenticated using (child_id is not null and public.caregiver_can_see_child_activity(child_id));

create policy "Adults read their own star goal" on public.star_goals
  for select to authenticated using (auth.uid() = profile_id);
create policy "Adults set their own star goal" on public.star_goals
  for insert to authenticated with check (auth.uid() = profile_id and child_id is null);
create policy "Adults change their own star goal" on public.star_goals
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id and child_id is null);
create policy "Caregivers read their child's star goal" on public.star_goals
  for select to authenticated using (child_id is not null and public.is_caregiver_of(child_id));
create policy "Caregivers set their child's star goal" on public.star_goals
  for insert to authenticated with check (child_id is not null and profile_id is null and public.is_caregiver_of(child_id));
create policy "Caregivers change their child's star goal" on public.star_goals
  for update to authenticated using (child_id is not null and public.is_caregiver_of(child_id))
  with check (child_id is not null and profile_id is null and public.is_caregiver_of(child_id));

-- Emotion choices: adults keep and clear their own; children can't delete
-- theirs (like mood check-ins); caregivers read by the rule.
create policy "Adults read their own emotion choices" on public.emotion_choices
  for select to authenticated using (auth.uid() = profile_id);
create policy "Adults add their own emotion choices" on public.emotion_choices
  for insert to authenticated with check (auth.uid() = profile_id and child_id is null);
create policy "Adults clear their own emotion choices" on public.emotion_choices
  for delete to authenticated using (auth.uid() = profile_id);
create policy "Caregivers read child emotion choices when shared" on public.emotion_choices
  for select to authenticated using (child_id is not null and public.caregiver_can_see_child_activity(child_id));

-- Tool settings: adults their own; any caregiver of a child sets the child's.
create policy "Adults read their own tool settings" on public.tool_settings
  for select to authenticated using (auth.uid() = profile_id);
create policy "Adults create their own tool settings" on public.tool_settings
  for insert to authenticated with check (auth.uid() = profile_id and child_id is null);
create policy "Adults change their own tool settings" on public.tool_settings
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id and child_id is null);
create policy "Caregivers read their child's tool settings" on public.tool_settings
  for select to authenticated using (child_id is not null and public.is_caregiver_of(child_id));
create policy "Caregivers create their child's tool settings" on public.tool_settings
  for insert to authenticated with check (child_id is not null and profile_id is null and public.is_caregiver_of(child_id));
create policy "Caregivers change their child's tool settings" on public.tool_settings
  for update to authenticated using (child_id is not null and public.is_caregiver_of(child_id))
  with check (child_id is not null and profile_id is null and public.is_caregiver_of(child_id));

-- ----------------------------------------------------------------------------
-- Alerts: "I want a grown-up" on the feelings cards
-- ----------------------------------------------------------------------------
alter table public.emergency_events drop constraint if exists emergency_events_triggered_by_check;
alter table public.emergency_events
  add constraint emergency_events_triggered_by_check
    check (triggered_by in ('aac_tap', 'check_in', 'journal_flag', 'feelings_card')) not valid;

-- A help alert from the talk board ('aac_tap') or the feelings cards
-- ('feelings_card'). Any help alert from either within 2 minutes is the same
-- alert, even for simultaneous taps. Server only.
create or replace function public.raise_help_alert(p_child_id uuid, p_source text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_source is null or p_source not in ('aac_tap', 'feelings_card') then
    raise exception 'invalid_input';
  end if;
  if not exists (select 1 from public.children where id = p_child_id) then
    raise exception 'not_found';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('help_alert:' || p_child_id::text, 0));

  select id into v_id from public.emergency_events
  where child_id = p_child_id and triggered_by in ('aac_tap', 'feelings_card')
    and created_at > clock_timestamp() - interval '2 minutes'
  order by created_at desc
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.emergency_events (child_id, triggered_by, caregiver_notified_at, created_at)
  values (p_child_id, p_source, clock_timestamp(), clock_timestamp())
  returning id into v_id;
  return v_id;
end;
$$;

-- The talk board's version, unchanged for callers.
create or replace function public.raise_help_alert(p_child_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.raise_help_alert(p_child_id, 'aac_tap');
end;
$$;

-- ----------------------------------------------------------------------------
-- Privileges (hosted default privileges grant no data access on new tables)
-- ----------------------------------------------------------------------------
revoke all on public.focus_sessions, public.focus_tasks, public.habits, public.habit_checks,
  public.star_events, public.star_goals, public.emotion_choices, public.tool_settings
  from anon, authenticated;

grant select, insert, delete on public.focus_sessions to authenticated;
grant select, insert, update, delete on public.focus_tasks to authenticated;
grant select, insert, update, delete on public.habits to authenticated;
grant select, insert, delete on public.habit_checks to authenticated;
grant select, insert on public.star_events to authenticated;
grant select, insert, update on public.star_goals to authenticated;
grant select, insert, delete on public.emotion_choices to authenticated;
grant select, insert, update on public.tool_settings to authenticated;

grant select, insert, update, delete on public.focus_sessions, public.focus_tasks, public.habits,
  public.habit_checks, public.star_events, public.star_goals, public.emotion_choices, public.tool_settings
  to service_role;

revoke all on function public.focus_tools_owner_limit() from public, anon, authenticated;
revoke all on function public.focus_sessions_daily_limit() from public, anon, authenticated;
revoke all on function public.claim_star_goal_for(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_my_star_goal() from public, anon;
revoke all on function public.claim_child_star_goal(uuid) from public, anon, authenticated;
revoke all on function public.raise_help_alert(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_my_star_goal() to authenticated;
grant execute on function public.claim_child_star_goal(uuid) to service_role;
grant execute on function public.raise_help_alert(uuid, text) to service_role;

comment on table public.focus_sessions is 'Focus / Pomodoro sessions (role-flow 8e). Adult or child owner; caregivers read under the activity sharing rule.';
comment on table public.focus_tasks is 'Task breakdowns with steps (role-flow 8e).';
comment on table public.habits is 'Habits (role-flow 8e); habit_checks holds the days ticked.';
comment on table public.star_events is 'Star awards (unique per owner and event) and goal claims (role-flow 8e).';
comment on table public.emotion_choices is 'Feelings cards picked (role-flow 8e). Children cannot delete; caregivers read under the activity sharing rule.';
comment on table public.tool_settings is 'Countdown preset and sentence-builder labels per person (role-flow 8e).';
