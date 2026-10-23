-- ============================================================================
-- SafeSpace Sprint 3: Wellness summary (counts only, non-diagnostic)
-- Migration: 20261024200000_wellness_summary
--
-- Contract: docs/sprint-3/CONTRACTS.md section 5 (WellnessSummary).
--
-- wellness_summary(owner, to-date, 7|30 days, IANA timezone) returns a JSON
-- object in the WellnessSummary contract shape: mood counts by value, days
-- with a check-in, the latest mood, routine steps scheduled vs completed,
-- and the number of journal entries. No scores, labels or journal text.
--
-- SECURITY INVOKER: it reads with the CALLER's row-level security, so it
-- adds no new access path:
--   - an adult gets their own numbers (someone else's id just gives zeros);
--   - a caregiver gets their child's numbers, automatically EXCLUDING a
--     partial-tier child's private mood and journal notes (existing RLS);
--   - a child's summary comes from the `wellness-summary` Edge Function
--     (service role), scoped to the child_id from the verified token.
-- Days are the owner's LOCAL dates in p_timezone.
-- Routine counts use each routine's CURRENT schedule and active flag
-- (schedule history isn't stored), counting days from when the step existed.
-- ============================================================================

create or replace function public.wellness_summary(
  p_profile_id uuid,
  p_child_id uuid,
  p_to date,
  p_period_days integer,
  p_timezone text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_from date;
  v_mood jsonb;
  v_scheduled bigint;
  v_completed bigint;
  v_journal bigint;
begin
  if (p_profile_id is null) = (p_child_id is null) then
    raise exception 'invalid_input';
  end if;
  if p_to is null or p_period_days is null or p_period_days not in (7, 30) then
    raise exception 'invalid_input';
  end if;
  if p_timezone is null or not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'invalid_input';
  end if;
  v_from := p_to - (p_period_days - 1);

  -- Mood check-ins in the period (local dates).
  with m as (
    select mc.mood, mc.created_at, (mc.created_at at time zone p_timezone)::date as d
    from public.mood_checkins mc
    where ((p_profile_id is not null and mc.profile_id = p_profile_id)
        or (p_child_id is not null and mc.child_id = p_child_id))
      and mc.created_at >= (v_from::timestamp - interval '1 day') at time zone 'utc'
  ), mp as (
    select * from m where d between v_from and p_to
  )
  select jsonb_build_object(
    'checkins', (select count(*) from mp),
    'daysWithCheckin', (select count(distinct d) from mp),
    'counts', jsonb_build_object(
      'ecstatic', (select count(*) from mp where mood = 'ecstatic'),
      'happy', (select count(*) from mp where mood = 'happy'),
      'neutral', (select count(*) from mp where mood = 'neutral'),
      'sad', (select count(*) from mp where mood = 'sad'),
      'stressed', (select count(*) from mp where mood = 'stressed'),
      'overwhelmed', (select count(*) from mp where mood = 'overwhelmed')
    ),
    'latest', (select jsonb_build_object('mood', mood, 'createdAt', created_at)
               from mp order by created_at desc limit 1)
  ) into v_mood;

  -- Routine step occurrences scheduled in the period: for each active
  -- routine's step, each day it existed on which the routine is scheduled.
  select coalesce(sum((
    select count(*)
    from generate_series(
      greatest(v_from, (greatest(r.created_at, s.created_at) at time zone p_timezone)::date),
      p_to,
      interval '1 day'
    ) as g(day)
    where cardinality(r.days_of_week) = 0
       or extract(dow from g.day)::smallint = any (r.days_of_week)
  )), 0) into v_scheduled
  from public.routines r
  join public.routine_steps s on s.routine_id = r.id
  where r.is_active
    and ((p_profile_id is not null and r.profile_id = p_profile_id)
      or (p_child_id is not null and r.child_id = p_child_id));

  -- Completions in the period, only on days the routine is scheduled.
  select count(*) into v_completed
  from public.routine_step_completions c
  join public.routine_steps s on s.id = c.step_id
  join public.routines r on r.id = s.routine_id
  where r.is_active
    and ((p_profile_id is not null and r.profile_id = p_profile_id)
      or (p_child_id is not null and r.child_id = p_child_id))
    and c.completed_on between v_from and p_to
    and (cardinality(r.days_of_week) = 0
      or extract(dow from c.completed_on)::smallint = any (r.days_of_week));

  -- Journal entries in the period: a count only, never content.
  select count(*) into v_journal
  from public.journal_entries j
  where ((p_profile_id is not null and j.profile_id = p_profile_id)
      or (p_child_id is not null and j.child_id = p_child_id))
    and (j.created_at at time zone p_timezone)::date between v_from and p_to;

  return jsonb_build_object(
    'periodDays', p_period_days,
    'from', v_from::text,
    'to', p_to::text,
    'mood', v_mood,
    'routines', jsonb_build_object('scheduledSteps', v_scheduled, 'completedSteps', v_completed),
    'journal', jsonb_build_object('entries', v_journal)
  );
end;
$$;

revoke all on function public.wellness_summary(uuid, uuid, date, integer, text) from public, anon;
grant execute on function public.wellness_summary(uuid, uuid, date, integer, text) to authenticated, service_role;

comment on function public.wellness_summary(uuid, uuid, date, integer, text) is
  'Sprint 3 wellness summary: counts only, read with the caller''s RLS (SECURITY INVOKER).';
