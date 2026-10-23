-- ============================================================================
-- SafeSpace role flow, step 2 (M1): several caregivers per child
-- Migration: 20261027000000_child_caregivers
-- Contract: docs/role-flow/CONTRACT.md section 4.
--
-- Until now a child had exactly one caregiver (children.caregiver_id) and 13
-- RLS policies checked `caregiver_id = auth.uid()`. Now:
--   - child_caregivers lists every caregiver of a child: one 'primary' (the
--     creator, still children.caregiver_id) and any 'co_caregiver's.
--   - is_caregiver_of(child_id) replaces the single-caregiver check in all 13
--     policies. Each policy keeps its other conditions unchanged; the
--     privacy-tier conditions on mood and journal are replaced in M2.
--   - Co-caregivers join with a one-time invite code made by the primary
--     (8 characters, 48 hours, single use). Only a SHA-256 hash of the code
--     is stored. No email lookups, no emails sent.
-- Clients can't read or write child_caregivers or caregiver_invites directly;
-- everything goes through the functions below.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- child_caregivers
-- ----------------------------------------------------------------------------
create table public.child_caregivers (
  child_id uuid not null references public.children(id) on delete cascade,
  caregiver_id uuid not null references public.caregivers(id) on delete cascade,
  role text not null check (role in ('primary', 'co_caregiver')),
  added_at timestamptz not null default now(),
  primary key (child_id, caregiver_id)
);

create unique index child_caregivers_one_primary
  on public.child_caregivers (child_id) where role = 'primary';
create index child_caregivers_caregiver_idx on public.child_caregivers (caregiver_id);

-- Every existing child: its current caregiver becomes the primary.
insert into public.child_caregivers (child_id, caregiver_id, role)
select id, caregiver_id, 'primary' from public.children
on conflict do nothing;

-- New children (create_child) get their primary row automatically.
create or replace function public.add_primary_caregiver()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.child_caregivers (child_id, caregiver_id, role)
  values (new.id, new.caregiver_id, 'primary')
  on conflict do nothing;
  return new;
end;
$$;

create trigger add_primary_caregiver
  after insert on public.children
  for each row execute function public.add_primary_caregiver();

alter table public.child_caregivers enable row level security;
revoke all on public.child_caregivers from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Helpers used by RLS policies. SECURITY DEFINER so the check reads
-- child_caregivers directly (no RLS recursion, no client grant needed).
-- ----------------------------------------------------------------------------
create or replace function public.is_caregiver_of(p_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.child_caregivers
    where child_id = p_child_id and caregiver_id = auth.uid()
  );
$$;

create or replace function public.is_primary_caregiver_of(p_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.child_caregivers
    where child_id = p_child_id and caregiver_id = auth.uid() and role = 'primary'
  );
$$;

-- The family code the child signs in with (the primary's), for any caregiver
-- of the child. Null when the caller isn't one.
create or replace function public.child_family_code(p_child_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select cg.family_code
  from public.children ch
  join public.caregivers cg on cg.id = ch.caregiver_id
  where ch.id = p_child_id and public.is_caregiver_of(p_child_id);
$$;

-- Who cares for a child: names and roles only.
create or replace function public.list_child_caregivers(p_child_id uuid)
returns table (caregiver_id uuid, display_name text, role text, added_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_caregiver_of(p_child_id) then
    raise exception 'not_found';
  end if;
  return query
    select cc.caregiver_id, coalesce(p.display_name, cg.display_name), cc.role, cc.added_at
    from public.child_caregivers cc
    join public.caregivers cg on cg.id = cc.caregiver_id
    left join public.profiles p on p.id = cc.caregiver_id
    where cc.child_id = p_child_id
    order by (cc.role = 'primary') desc, cc.added_at;
end;
$$;

-- ----------------------------------------------------------------------------
-- caregiver_invites
-- ----------------------------------------------------------------------------
create table public.caregiver_invites (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  code_hash text not null unique,
  created_by uuid not null references public.caregivers(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.caregivers(id) on delete set null
);

create index caregiver_invites_child_idx on public.caregiver_invites (child_id);

alter table public.caregiver_invites enable row level security;
revoke all on public.caregiver_invites from anon, authenticated;

-- Codes are compared case-insensitively, ignoring spaces and dashes.
create or replace function public.caregiver_invite_hash(p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g')), 'UTF8')), 'hex');
$$;

-- Primary only. Returns the code once; it is never stored in readable form.
-- At most 5 unused, unexpired invites per child at a time.
create or replace function public.create_caregiver_invite(p_child_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  c_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- no 0/O, 1/I/L
  v_code text := '';
  v_expires timestamptz := now() + interval '48 hours';
  v_bits bigint;
  i integer;
begin
  if not public.is_caregiver_of(p_child_id) then
    raise exception 'not_found';
  end if;
  if not public.is_primary_caregiver_of(p_child_id) then
    raise exception 'not_primary_caregiver';
  end if;
  if (select count(*) from public.caregiver_invites ci
      where ci.child_id = p_child_id and ci.used_at is null and ci.expires_at > now()) >= 5 then
    raise exception 'rate_limited';
  end if;

  for i in 1..8 loop
    -- 32 random bits from a v4 UUID per character; modulo bias is negligible.
    v_bits := ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint;
    v_code := v_code || substr(c_alphabet, (v_bits % 31)::integer + 1, 1);
  end loop;

  insert into public.caregiver_invites (child_id, code_hash, created_by, expires_at)
  values (p_child_id, public.caregiver_invite_hash(v_code), auth.uid(), v_expires);

  return query select v_code, v_expires;
end;
$$;

-- Any signed-in caregiver. Returns the child id they now care for.
create or replace function public.accept_caregiver_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.caregiver_invites%rowtype;
begin
  if auth.uid() is null or not exists (select 1 from public.caregivers where id = auth.uid()) then
    raise exception 'not_a_caregiver';
  end if;

  select * into v_invite from public.caregiver_invites
  where code_hash = public.caregiver_invite_hash(p_code)
  for update;

  if not found or v_invite.used_at is not null or v_invite.expires_at <= now() then
    raise exception 'invite_invalid';
  end if;
  if exists (select 1 from public.child_caregivers
             where child_id = v_invite.child_id and caregiver_id = auth.uid()) then
    raise exception 'already_caregiver';
  end if;

  insert into public.child_caregivers (child_id, caregiver_id, role)
  values (v_invite.child_id, auth.uid(), 'co_caregiver');

  update public.caregiver_invites
  set used_at = now(), used_by = auth.uid()
  where id = v_invite.id;

  return v_invite.child_id;
end;
$$;

-- The primary removes a co-caregiver; a co-caregiver can remove only
-- themselves (leave). The primary can't be removed.
create or replace function public.remove_child_caregiver(p_child_id uuid, p_caregiver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role text;
begin
  if not public.is_caregiver_of(p_child_id) then
    raise exception 'not_found';
  end if;

  select role into v_target_role from public.child_caregivers
  where child_id = p_child_id and caregiver_id = p_caregiver_id;
  if v_target_role is null then
    raise exception 'not_found';
  end if;
  if v_target_role = 'primary' then
    raise exception 'invalid_input';
  end if;
  if p_caregiver_id <> auth.uid() and not public.is_primary_caregiver_of(p_child_id) then
    raise exception 'not_primary_caregiver';
  end if;

  delete from public.child_caregivers
  where child_id = p_child_id and caregiver_id = p_caregiver_id;
end;
$$;

-- Functions are executable by PUBLIC by default. The RLS helpers must be
-- executable by authenticated (policies run with the caller's privileges).
revoke all on function public.add_primary_caregiver() from public, anon, authenticated;
revoke all on function public.is_caregiver_of(uuid) from public, anon;
revoke all on function public.is_primary_caregiver_of(uuid) from public, anon;
revoke all on function public.child_family_code(uuid) from public, anon;
revoke all on function public.list_child_caregivers(uuid) from public, anon;
revoke all on function public.caregiver_invite_hash(text) from public, anon, authenticated;
revoke all on function public.create_caregiver_invite(uuid) from public, anon;
revoke all on function public.accept_caregiver_invite(text) from public, anon;
revoke all on function public.remove_child_caregiver(uuid, uuid) from public, anon;
grant execute on function public.is_caregiver_of(uuid) to authenticated, service_role;
grant execute on function public.is_primary_caregiver_of(uuid) to authenticated, service_role;
grant execute on function public.child_family_code(uuid) to authenticated;
grant execute on function public.list_child_caregivers(uuid) to authenticated;
grant execute on function public.create_caregiver_invite(uuid) to authenticated;
grant execute on function public.accept_caregiver_invite(text) to authenticated;
grant execute on function public.remove_child_caregiver(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- The 13 child policies: single caregiver -> any caregiver of the child.
-- Everything else in each policy is unchanged.
-- ----------------------------------------------------------------------------

-- children: read only. Children are created and changed through functions.
drop policy if exists "Caregivers manage their own children" on public.children;
create policy "Caregivers read the children they care for"
  on public.children for select
  using (public.is_caregiver_of(id));

drop policy if exists "Caregivers manage their own children's modules" on public.child_modules;
create policy "Caregivers read their children's modules"
  on public.child_modules for select
  using (public.is_caregiver_of(child_id));

drop policy if exists "Caregivers manage their children's routines" on public.routines;
create policy "Caregivers manage their children's routines"
  on public.routines for all
  using (public.is_caregiver_of(child_id))
  with check (profile_id is null and public.is_caregiver_of(child_id));

drop policy if exists "Caregivers manage their children's reminders" on public.reminders;
create policy "Caregivers manage their children's reminders"
  on public.reminders for all
  using (public.is_caregiver_of(child_id))
  with check (profile_id is null and public.is_caregiver_of(child_id));

drop policy if exists "Caregivers always read emergency events for their children" on public.emergency_events;
create policy "Caregivers always read emergency events for their children"
  on public.emergency_events for select
  using (public.is_caregiver_of(child_id));

drop policy if exists "Caregivers can mark events reviewed" on public.emergency_events;
create policy "Caregivers can mark events reviewed"
  on public.emergency_events for update
  using (public.is_caregiver_of(child_id))
  with check (public.is_caregiver_of(child_id));

drop policy if exists "Caregivers read their children's generated stories" on public.generated_stories;
create policy "Caregivers read their children's generated stories"
  on public.generated_stories for select
  using (public.is_caregiver_of(child_id));

-- Activity (privacy-tier conditions unchanged here; M2 replaces them).
drop policy if exists "Caregivers read child mood check-ins respecting privacy tier" on public.mood_checkins;
create policy "Caregivers read child mood check-ins respecting privacy tier"
  on public.mood_checkins for select
  using (
    public.is_caregiver_of(child_id)
    and not (
      mood_checkins.is_private_note = true
      and exists (select 1 from public.children c where c.id = mood_checkins.child_id and c.privacy_tier = 'partial')
    )
  );

drop policy if exists "Caregivers read journal entries respecting privacy tier" on public.journal_entries;
create policy "Caregivers read journal entries respecting privacy tier"
  on public.journal_entries for select
  using (
    public.is_caregiver_of(child_id)
    and not (
      journal_entries.is_private_note = true
      and exists (select 1 from public.children c where c.id = journal_entries.child_id and c.privacy_tier = 'partial')
    )
  );

drop policy if exists "Caregivers read their children's completions" on public.routine_step_completions;
create policy "Caregivers read their children's completions"
  on public.routine_step_completions for select
  using (exists (select 1 from public.routine_steps s
                 join public.routines r on r.id = s.routine_id
                 where s.id = routine_step_completions.step_id and public.is_caregiver_of(r.child_id)));

drop policy if exists "Caregivers read their children's acknowledgements" on public.reminder_acknowledgements;
create policy "Caregivers read their children's acknowledgements"
  on public.reminder_acknowledgements for select
  using (exists (select 1 from public.reminders r
                 where r.id = reminder_acknowledgements.reminder_id and public.is_caregiver_of(r.child_id)));

drop policy if exists "Caregivers read child AI conversations" on public.ai_companion_conversations;
create policy "Caregivers read child AI conversations"
  on public.ai_companion_conversations for select
  using (public.is_caregiver_of(child_id));

drop policy if exists "Caregivers read child AI messages" on public.ai_companion_messages;
create policy "Caregivers read child AI messages"
  on public.ai_companion_messages for select
  using (exists (select 1 from public.ai_companion_conversations conv
                 where conv.id = ai_companion_messages.conversation_id and public.is_caregiver_of(conv.child_id)));

comment on table public.child_caregivers is
  'Every caregiver of a child: one primary (the creator, children.caregiver_id) and any co-caregivers. Written only by functions.';
comment on table public.caregiver_invites is
  'One-time codes for joining as a co-caregiver. Only a SHA-256 hash of each code is stored.';
