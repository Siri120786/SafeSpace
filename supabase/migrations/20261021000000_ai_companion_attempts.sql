-- ============================================================================
-- SafeSpace: AI Companion attempt log + atomic rate-limit slot
-- Migration: 20261021000000_ai_companion_attempts
--
-- Counts every model attempt (including ones Gemini fails or blocks, which
-- store no messages) so they cannot bypass the per-identity limit, and makes
-- check-and-record atomic so concurrent requests cannot slip past it.
--
-- Follows the pin_attempts convention (0002): bigint identity id,
-- attempted_at, recent-first index, RLS on with no policies, service role only.
-- Stores ONLY the verified owner and a timestamp: no message text, prompts,
-- model output or request metadata.
--
-- Retention: rows are only needed for the 60-second window. Proposed policy:
-- delete rows older than 24 hours. No cleanup job exists yet; tracked in
-- docs/AI_COMPANION.md ("Attempt log retention").
-- ============================================================================

create table public.ai_companion_attempts (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  attempted_at timestamptz not null default now(),

  constraint ai_companion_attempts_one_owner check (
    (profile_id is not null and child_id is null) or
    (profile_id is null and child_id is not null)
  )
);

create index ai_companion_attempts_profile_recent
  on public.ai_companion_attempts (profile_id, attempted_at desc)
  where profile_id is not null;
create index ai_companion_attempts_child_recent
  on public.ai_companion_attempts (child_id, attempted_at desc)
  where child_id is not null;

alter table public.ai_companion_attempts enable row level security;
-- No policies, and no client privileges (Supabase grants ALL on new public
-- tables to anon/authenticated by default, so revoke explicitly).
revoke all on public.ai_companion_attempts from anon, authenticated;

-- ----------------------------------------------------------------------------
-- ai_companion_take_slot: atomically "count attempts in the window; if under
-- the limit, record one". Returns true when the attempt is allowed.
--
-- Concurrency: a per-owner transaction-scoped advisory lock serialises callers
-- for the same identity, and each statement after the lock sees all attempts
-- committed by earlier holders (READ COMMITTED), so N concurrent calls can
-- never record more than p_limit attempts in a window. Different identities
-- use different locks and never block each other.
-- ----------------------------------------------------------------------------
create or replace function public.ai_companion_take_slot(
  p_profile_id uuid,
  p_child_id uuid,
  p_limit integer,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := coalesce(p_profile_id, p_child_id);
  v_count integer;
begin
  if (p_profile_id is null) = (p_child_id is null) then
    raise exception 'ai_companion_take_slot: exactly one owner is required';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 1000
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 3600 then
    raise exception 'ai_companion_take_slot: invalid limit or window';
  end if;

  -- Separate key spaces for adults and children, even if UUIDs ever collided.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'ai_companion_attempts:' || case when p_profile_id is not null then 'p:' else 'c:' end || v_owner::text,
      0
    )
  );

  select count(*) into v_count
  from public.ai_companion_attempts a
  where a.attempted_at > clock_timestamp() - make_interval(secs => p_window_seconds)
    and (
      (p_profile_id is not null and a.profile_id = p_profile_id) or
      (p_child_id is not null and a.child_id = p_child_id)
    );

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.ai_companion_attempts (profile_id, child_id, attempted_at)
  values (p_profile_id, p_child_id, clock_timestamp());
  return true;
end;
$$;

-- Only the trusted server path (service role, used by the Edge Function) may
-- call it. Functions are executable by PUBLIC by default, and Supabase also
-- grants EXECUTE on new public functions to anon/authenticated.
revoke all on function public.ai_companion_take_slot(uuid, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.ai_companion_take_slot(uuid, uuid, integer, integer)
  to service_role;

comment on table public.ai_companion_attempts is
  'AI Companion model-attempt log for rate limiting. Owner + timestamp only; no content. Proposed retention: 24 hours (cleanup job not yet implemented).';
comment on function public.ai_companion_take_slot(uuid, uuid, integer, integer) is
  'Atomic per-identity rate-limit slot for the ai-companion Edge Function. Service role only.';
