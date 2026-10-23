-- ============================================================================
-- SafeSpace: atomic, fail-closed PIN attempt limiting
-- Migration: 20261026100000_pin_attempt_slots
--
-- verify-child-pin used to count recent failures, check the PIN, then insert
-- the attempt, ignoring database errors. That failed OPEN: a failed count read
-- as zero and a failed insert was never counted, and parallel requests all
-- passed the check before any of them was recorded.
--
-- The rule is unchanged: at most 5 failed attempts per family code in any
-- 15-minute window. It is now enforced here:
--   pin_attempt_begin(family_code) -> under a per-family advisory lock, count
--     the family's failures in the window; if 5 or more, return null (the
--     caller answers 429). Otherwise record this attempt as FAILED and return
--     its id. The attempt counts as a failure until proven otherwise, so N
--     concurrent requests can never get more than 5 guesses.
--   pin_attempt_succeeded(id) -> mark that attempt as succeeded after the PIN
--     matched. Only flips an unsucceeded attempt from the last 15 minutes.
--
-- Both are SECURITY DEFINER and executable by service_role only, so the Edge
-- Function needs no table privileges on pin_attempts. Clients get nothing.
-- ============================================================================

revoke all on public.pin_attempts from anon, authenticated;

create or replace function public.pin_attempt_begin(p_family_code text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max_failed constant integer := 5;
  c_window constant interval := interval '15 minutes';
  v_code text := upper(btrim(p_family_code));
  v_failed integer;
  v_id bigint;
begin
  if v_code is null or v_code = '' or char_length(v_code) > 64 then
    raise exception 'invalid_input';
  end if;

  -- Serialise attempts for the same family; other families never block.
  perform pg_advisory_xact_lock(hashtextextended('pin_attempts:' || v_code, 0));

  select count(*) into v_failed
  from public.pin_attempts
  where family_code = v_code
    and succeeded = false
    and attempted_at > clock_timestamp() - c_window;

  if v_failed >= c_max_failed then
    return null;
  end if;

  insert into public.pin_attempts (family_code, succeeded, attempted_at)
  values (v_code, false, clock_timestamp())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.pin_attempt_succeeded(p_attempt_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.pin_attempts
  set succeeded = true
  where id = p_attempt_id
    and succeeded = false
    and attempted_at > clock_timestamp() - interval '15 minutes';
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

-- Functions are executable by PUBLIC by default; restrict to the server path.
revoke all on function public.pin_attempt_begin(text) from public, anon, authenticated;
revoke all on function public.pin_attempt_succeeded(bigint) from public, anon, authenticated;
grant execute on function public.pin_attempt_begin(text) to service_role;
grant execute on function public.pin_attempt_succeeded(bigint) to service_role;

comment on function public.pin_attempt_begin(text) is
  'Reserves a PIN attempt for a family code (counted as failed) or returns null when 5 failures in 15 minutes. Service role only.';
comment on function public.pin_attempt_succeeded(bigint) is
  'Marks a reserved PIN attempt as succeeded. Service role only.';
