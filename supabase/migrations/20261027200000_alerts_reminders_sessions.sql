-- ============================================================================
-- SafeSpace role flow, step 2 (M3): alerts, reminder heads-up, child sessions
-- Migration: 20261027200000_alerts_reminders_sessions
-- Contract: docs/role-flow/CONTRACT.md sections 7, 9 and 10.
--
-- Alerts (talk-board "I need help"):
--   - raise_help_alert(child_id): server only (child-alerts Edge Function).
--     A second tap within 2 minutes returns the same alert.
--   - Every caregiver of the child reads the child's alerts, whatever the
--     sharing choice (RLS from M1), and any of them can mark one reviewed
--     (mark_alert_reviewed). Clients can't write emergency_events directly;
--     the old caregiver UPDATE policy is replaced by the function.
--   - In-app only: no push, SMS or email.
-- Reminders: lead_minutes (0 to 120) for a heads-up before the time.
-- Child sessions: children.session_version is put in each child-session token
-- and checked on every child request. reset_child_pin() bumps it, so a PIN
-- reset signs the child out everywhere; a deleted child's tokens stop working.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Alerts
-- ----------------------------------------------------------------------------
alter table public.emergency_events
  add constraint emergency_events_triggered_by_check
    check (triggered_by in ('aac_tap', 'check_in', 'journal_flag')) not valid;

create index if not exists emergency_events_child_created_idx
  on public.emergency_events (child_id, created_at desc);

drop policy if exists "Caregivers can mark events reviewed" on public.emergency_events;

revoke all on public.emergency_events from anon, authenticated;
grant select on public.emergency_events to authenticated;

create or replace function public.raise_help_alert(p_child_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.children where id = p_child_id) then
    raise exception 'not_found';
  end if;
  -- One alert per child per 2 minutes, even for simultaneous taps.
  perform pg_advisory_xact_lock(hashtextextended('help_alert:' || p_child_id::text, 0));

  select id into v_id from public.emergency_events
  where child_id = p_child_id and triggered_by = 'aac_tap'
    and created_at > clock_timestamp() - interval '2 minutes'
  order by created_at desc
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.emergency_events (child_id, triggered_by, caregiver_notified_at, created_at)
  values (p_child_id, 'aac_tap', clock_timestamp(), clock_timestamp())
  returning id into v_id;
  return v_id;
end;
$$;

-- Any caregiver of the child. Idempotent: the first reviewer is kept.
create or replace function public.mark_alert_reviewed(p_alert_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child uuid;
begin
  select child_id into v_child from public.emergency_events where id = p_alert_id;
  if v_child is null or not public.is_caregiver_of(v_child) then
    raise exception 'not_found';
  end if;
  update public.emergency_events
  set reviewed_at = coalesce(reviewed_at, now()),
      reviewed_by = coalesce(reviewed_by, auth.uid())
  where id = p_alert_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Reminder heads-up
-- ----------------------------------------------------------------------------
alter table public.reminders
  add column lead_minutes smallint not null default 0 check (lead_minutes between 0 and 120);

comment on column public.reminders.lead_minutes is
  'Heads-up: the reminder is due this many minutes before time_of_day (0 = at the time).';

-- ----------------------------------------------------------------------------
-- Child sessions and PIN reset
-- ----------------------------------------------------------------------------
alter table public.children
  add column session_version integer not null default 1;

comment on column public.children.session_version is
  'Put in every child-session token and checked on each child request. Bumped by reset_child_pin() to sign the child out.';

-- Server only: the reset-child-pin Edge Function uses it to authorise the
-- caller BEFORE looking at any PIN hashes.
create or replace function public.caregiver_role_for_child(p_child_id uuid, p_caregiver_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.child_caregivers where child_id = p_child_id and caregiver_id = p_caregiver_id;
$$;

-- Server only (reset-child-pin, after verifying the caller's JWT and checking
-- the new PIN is unique in the family). Primary caregiver only.
create or replace function public.reset_child_pin(p_child_id uuid, p_caregiver_id uuid, p_pin_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.caregiver_role_for_child(p_child_id, p_caregiver_id);
begin
  if v_role is null then
    raise exception 'not_found';
  end if;
  if v_role <> 'primary' then
    raise exception 'not_primary_caregiver';
  end if;
  if p_pin_hash is null or p_pin_hash !~ '^pbkdf2\$100000\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=$' then
    raise exception 'invalid_input';
  end if;
  update public.children
  set pin_hash = p_pin_hash, session_version = session_version + 1
  where id = p_child_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Privileges
-- ----------------------------------------------------------------------------
revoke all on function public.raise_help_alert(uuid) from public, anon, authenticated;
revoke all on function public.mark_alert_reviewed(uuid) from public, anon;
revoke all on function public.caregiver_role_for_child(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reset_child_pin(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.raise_help_alert(uuid) to service_role;
grant execute on function public.mark_alert_reviewed(uuid) to authenticated;
grant execute on function public.caregiver_role_for_child(uuid, uuid) to service_role;
grant execute on function public.reset_child_pin(uuid, uuid, text) to service_role;
