-- Day-by-day wellness timeline (the caregiver's "Recent activity" day strip).
--
-- wellness_daily: the same counts as wellness_summary (20261024200000), one
-- row per local day instead of totals, for 7 or 30 days ending p_to. Like
-- wellness_summary it is SECURITY INVOKER, so it reads with the caller's own
-- RLS: an adult sees their own days; a caregiver sees a child's days only
-- while the child shares activity (otherwise every day reads as empty).
-- Counts and the day's last mood only: never a score, label or any text.
--
-- Each day: { date, mood (that day's latest check-in, or null), checkins,
--             stepsScheduled, stepsDone, journalEntries }

create or replace function public.wellness_daily(
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

  return (
    with days as (
      select g::date as d from generate_series(v_from, p_to, interval '1 day') g
    ),
    moods as (
      select (mc.created_at at time zone p_timezone)::date as d, mc.mood, mc.created_at
      from public.mood_checkins mc
      where ((p_profile_id is not null and mc.profile_id = p_profile_id)
          or (p_child_id is not null and mc.child_id = p_child_id))
        and mc.created_at >= (v_from::timestamp - interval '1 day') at time zone 'utc'
    ),
    steps as (
      select s.id as step_id, r.days_of_week,
             (greatest(r.created_at, s.created_at) at time zone p_timezone)::date as since
      from public.routines r
      join public.routine_steps s on s.routine_id = r.id
      where r.is_active
        and ((p_profile_id is not null and r.profile_id = p_profile_id)
          or (p_child_id is not null and r.child_id = p_child_id))
    ),
    journal as (
      select (j.created_at at time zone p_timezone)::date as d
      from public.journal_entries j
      where ((p_profile_id is not null and j.profile_id = p_profile_id)
          or (p_child_id is not null and j.child_id = p_child_id))
        and j.created_at >= (v_from::timestamp - interval '1 day') at time zone 'utc'
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', days.d::text,
      'mood', (select m.mood from moods m where m.d = days.d order by m.created_at desc limit 1),
      'checkins', (select count(*) from moods m where m.d = days.d),
      'stepsScheduled', (select count(*) from steps st
                         where st.since <= days.d
                           and (cardinality(st.days_of_week) = 0
                             or extract(dow from days.d)::smallint = any (st.days_of_week))),
      'stepsDone', (select count(*) from public.routine_step_completions c
                    join steps st on st.step_id = c.step_id
                    where c.completed_on = days.d
                      and (cardinality(st.days_of_week) = 0
                        or extract(dow from days.d)::smallint = any (st.days_of_week))),
      'journalEntries', (select count(*) from journal jj where jj.d = days.d)
    ) order by days.d), '[]'::jsonb)
    from days
  );
end;
$$;

revoke all on function public.wellness_daily(uuid, uuid, date, integer, text) from public, anon;
grant execute on function public.wellness_daily(uuid, uuid, date, integer, text) to authenticated, service_role;

comment on function public.wellness_daily(uuid, uuid, date, integer, text) is
  'Day-by-day wellness counts (timeline), read with the caller''s RLS (SECURITY INVOKER).';
