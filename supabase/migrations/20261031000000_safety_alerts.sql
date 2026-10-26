-- Safety alerts (safety-check + emergency-escalation).
--
-- When a child's AI Companion message, journal entry or mood check-in note
-- trips the crisis screen (supabase/functions/_shared/safety.ts), the server
-- raises an in-app alert for every caregiver of that child, in the same
-- emergency_events table as "I need help". Like every alert it is readable by
-- the child's caregivers whatever the sharing choice (emergency logs are
-- exempt from privacy settings by design; see 0001_init_schema.sql).
--
--   - Sources: 'companion_flag' (AI Companion), 'journal_flag' (journal),
--     'check_in' (mood check-in note).
--   - "Where, not what": the alert stores only its source. The child's words
--     are never copied into it (ai_alert_summary stays null).
--   - Rate limit: one open alert per child and source per 30 minutes; a
--     repeat returns the same alert instead of piling up new ones.
--   - In-app delivery: the alert shows in the caregivers' app as soon as it
--     is written, so caregiver_notified_at is set then (as for help alerts).
--   - Server only: the service role calls it from Edge Functions after the
--     check has run on the server. Clients can't raise one directly.
-- Children only: Individuals have no linked contact, so they keep the fixed
-- safety message with no alert.

alter table public.emergency_events drop constraint if exists emergency_events_triggered_by_check;
alter table public.emergency_events
  add constraint emergency_events_triggered_by_check
    check (triggered_by in ('aac_tap', 'check_in', 'journal_flag', 'feelings_card', 'companion_flag')) not valid;

create or replace function public.raise_safety_alert(p_child_id uuid, p_source text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_source is null or p_source not in ('companion_flag', 'journal_flag', 'check_in') then
    raise exception 'invalid_input';
  end if;
  if not exists (select 1 from public.children where id = p_child_id) then
    raise exception 'not_found';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('safety_alert:' || p_child_id::text || ':' || p_source, 0));

  select id into v_id from public.emergency_events
  where child_id = p_child_id and triggered_by = p_source and reviewed_at is null
    and created_at > clock_timestamp() - interval '30 minutes'
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

revoke all on function public.raise_safety_alert(uuid, text) from public, anon, authenticated;
grant execute on function public.raise_safety_alert(uuid, text) to service_role;
