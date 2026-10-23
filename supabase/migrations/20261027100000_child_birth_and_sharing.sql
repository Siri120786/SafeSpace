-- ============================================================================
-- SafeSpace role flow, step 2 (M2): birth month/year, the age-15 sharing rule,
-- private-note removal
-- Migration: 20261027100000_child_birth_and_sharing
-- Contract: docs/role-flow/CONTRACT.md sections 5 and 6.
--
-- Replaces the old privacy tiers (full 4-8 / partial 9-12 with private notes /
-- private 13+) with one rule:
--   under 15   -> caregivers see the child's activity
--   15 or over -> the young person chooses; until they answer, it is shared
-- Age is calculated from birth month and year, so the rule changes on its own.
--
-- Activity (gated): mood check-ins, journal entries, routine step
-- completions, reminder acknowledgements, AI conversations and messages.
-- Never gated: the child's details, routines and reminders (caregivers set
-- them up), alerts.
--
-- Private notes: no new ones. Existing private notes stay hidden from
-- caregivers permanently.
--
-- Legacy columns kept for the Flutter app (until role-flow step 8):
-- children.age and children.privacy_tier are still written, from the new
-- rule ('full' under 15, 'private' from 15); nothing in the web app or the
-- policies reads them any more.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- New columns
-- ----------------------------------------------------------------------------
alter table public.children
  add column birth_year smallint,
  add column birth_month smallint check (birth_month between 1 and 12),
  add column shares_with_caregiver boolean,        -- null = not asked yet
  add column sharing_decided_at timestamptz,
  add column theme text check (theme in ('space', 'ocean', 'dinosaurs', 'trains')),
  add column low_sensory_default boolean not null default false;

-- Approximate birth month/year for existing children from their age today.
-- A primary caregiver can correct it (update_child).
update public.children
set birth_year = extract(year from current_date)::int - age,
    birth_month = extract(month from current_date)::int
where birth_year is null;

alter table public.children
  alter column birth_year set not null,
  alter column birth_month set not null;

-- Children are created through create_child(), which sets the birth month and
-- year. A direct insert that gives only an age (seed data, older tooling)
-- gets the same approximation as the backfill above instead of failing.
create or replace function public.fill_child_birth_from_age()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.birth_year is null and new.age is not null then
    new.birth_year := extract(year from current_date)::int - new.age;
    new.birth_month := coalesce(new.birth_month, extract(month from current_date)::int);
  end if;
  return new;
end;
$$;

create trigger fill_child_birth_from_age
  before insert on public.children
  for each row execute function public.fill_child_birth_from_age();

comment on column public.children.age is
  'LEGACY (role flow M2): age when last written, kept for the Flutter app. Use child_age_years(birth_year, birth_month).';
comment on column public.children.privacy_tier is
  'LEGACY (role flow M2): ''full'' under 15, ''private'' from 15, kept for the Flutter app. Use child_sharing_status().';
comment on column public.children.shares_with_caregiver is
  'Set only by the young person at 15 or over. null = not asked yet (treated as shared).';

-- ----------------------------------------------------------------------------
-- Age and sharing
-- ----------------------------------------------------------------------------

-- Whole years from the 1st of the birth month to p_on (default today).
create or replace function public.child_age_years(p_birth_year integer, p_birth_month integer, p_on date default current_date)
returns integer
language sql
stable
set search_path = public
as $$
  select ((extract(year from p_on)::int * 12 + extract(month from p_on)::int)
          - (p_birth_year * 12 + p_birth_month)) / 12;
$$;

-- 'under_15' | 'not_asked' | 'shared' | 'not_shared'. No access check: only
-- the server role and the functions below call it.
create or replace function public.child_sharing_status(p_child_id uuid, p_on date default current_date)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.child_age_years(c.birth_year, c.birth_month, p_on) < 15 then 'under_15'
    when c.shares_with_caregiver is null then 'not_asked'
    when c.shares_with_caregiver then 'shared'
    else 'not_shared'
  end
  from public.children c
  where c.id = p_child_id;
$$;

-- The one rule every gated policy uses: the caller cares for the child and
-- the child's activity is shared with caregivers.
create or replace function public.caregiver_can_see_child_activity(p_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_caregiver_of(p_child_id)
     and coalesce(public.child_sharing_status(p_child_id), 'not_shared') <> 'not_shared';
$$;

-- Legacy columns from the new rule.
create or replace function public.legacy_privacy_tier(p_birth_year integer, p_birth_month integer)
returns text
language sql
stable
set search_path = public
as $$
  select case when public.child_age_years(p_birth_year, p_birth_month) < 15 then 'full' else 'private' end;
$$;

update public.children
set privacy_tier = public.legacy_privacy_tier(birth_year, birth_month);

-- Shared validation for creating and updating children.
create or replace function public.check_child_birth(p_birth_year integer, p_birth_month integer)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  v_age integer;
begin
  if p_birth_year is null or p_birth_month is null or p_birth_month not between 1 and 12
     or p_birth_year * 12 + p_birth_month
        > extract(year from current_date)::int * 12 + extract(month from current_date)::int then
    raise exception 'invalid_input';
  end if;
  v_age := public.child_age_years(p_birth_year, p_birth_month);
  if v_age not between 4 and 17 then
    raise exception 'invalid_input';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Gated policies: the age-15 rule replaces the privacy tiers
-- ----------------------------------------------------------------------------
drop policy if exists "Caregivers read child mood check-ins respecting privacy tier" on public.mood_checkins;
create policy "Caregivers read child mood check-ins when shared"
  on public.mood_checkins for select
  using (public.caregiver_can_see_child_activity(child_id) and not is_private_note);

drop policy if exists "Caregivers read journal entries respecting privacy tier" on public.journal_entries;
create policy "Caregivers read child journal entries when shared"
  on public.journal_entries for select
  using (public.caregiver_can_see_child_activity(child_id) and not is_private_note);

drop policy if exists "Caregivers read their children's completions" on public.routine_step_completions;
create policy "Caregivers read their children's completions when shared"
  on public.routine_step_completions for select
  using (exists (select 1 from public.routine_steps s
                 join public.routines r on r.id = s.routine_id
                 where s.id = routine_step_completions.step_id
                   and public.caregiver_can_see_child_activity(r.child_id)));

drop policy if exists "Caregivers read their children's acknowledgements" on public.reminder_acknowledgements;
create policy "Caregivers read their children's acknowledgements when shared"
  on public.reminder_acknowledgements for select
  using (exists (select 1 from public.reminders r
                 where r.id = reminder_acknowledgements.reminder_id
                   and public.caregiver_can_see_child_activity(r.child_id)));

drop policy if exists "Caregivers read child AI conversations" on public.ai_companion_conversations;
create policy "Caregivers read child AI conversations when shared"
  on public.ai_companion_conversations for select
  using (public.caregiver_can_see_child_activity(child_id));

drop policy if exists "Caregivers read child AI messages" on public.ai_companion_messages;
create policy "Caregivers read child AI messages when shared"
  on public.ai_companion_messages for select
  using (exists (select 1 from public.ai_companion_conversations conv
                 where conv.id = ai_companion_messages.conversation_id
                   and public.caregiver_can_see_child_activity(conv.child_id)));

-- ----------------------------------------------------------------------------
-- Private notes: no new ones (same trigger names, new rule)
-- ----------------------------------------------------------------------------
create or replace function public.enforce_mood_checkin_private_note_tier()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_private_note and (tg_op = 'INSERT' or not old.is_private_note) then
    raise exception 'invalid_input';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_journal_private_note_tier()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_private_note and (tg_op = 'INSERT' or not old.is_private_note) then
    raise exception 'invalid_input';
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Creating and changing children
-- ----------------------------------------------------------------------------

-- New version: birth month and year. SECURITY DEFINER, service role only
-- (the create-child Edge Function, after verifying the caller's JWT).
create or replace function public.create_child(
  p_caregiver_id uuid,
  p_name text,
  p_birth_year integer,
  p_birth_month integer,
  p_pin_hash text,
  p_modules text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_id uuid;
begin
  if p_caregiver_id is null or not exists (select 1 from public.caregivers where id = p_caregiver_id) then
    raise exception 'not_a_caregiver';
  end if;
  perform public.check_child_birth(p_birth_year, p_birth_month);
  if v_name is null or char_length(v_name) not between 1 and 80
     or p_pin_hash is null
     or p_pin_hash !~ '^pbkdf2\$100000\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=$'
     or p_modules is null
     or exists (
       select 1 from unnest(p_modules) m
       where m is null or not exists (select 1 from public.condition_modules c where c.key = m)
     ) then
    raise exception 'invalid_input';
  end if;

  insert into public.children (caregiver_id, name, age, pin_hash, privacy_tier, birth_year, birth_month)
  values (
    p_caregiver_id, v_name,
    public.child_age_years(p_birth_year, p_birth_month),
    p_pin_hash,
    public.legacy_privacy_tier(p_birth_year, p_birth_month),
    p_birth_year, p_birth_month
  )
  returning id into v_id;

  insert into public.child_modules (child_id, module_key)
  select v_id, m from (select distinct unnest(p_modules) m) s;

  return v_id;
end;
$$;

-- Old version (age in years), kept so the create-child function deployed on
-- hosted keeps working until the new one is deployed. Birth month/year are
-- approximated from the age. Remove once every deployment uses the new one.
create or replace function public.create_child(
  p_caregiver_id uuid,
  p_name text,
  p_age integer,
  p_pin_hash text,
  p_modules text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_age is null or p_age not between 4 and 17 then
    raise exception 'invalid_input';
  end if;
  return public.create_child(
    p_caregiver_id, p_name,
    extract(year from current_date)::int - p_age,
    extract(month from current_date)::int,
    p_pin_hash, p_modules
  );
end;
$$;

-- Primary-only fields: name, birth month/year. Any caregiver: theme,
-- low-sensory default. A null argument means "leave unchanged"; an empty
-- theme ('') clears it.
create or replace function public.update_child(
  p_child_id uuid,
  p_name text default null,
  p_birth_year integer default null,
  p_birth_month integer default null,
  p_theme text default null,
  p_low_sensory_default boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child public.children%rowtype;
  v_name text := btrim(p_name);
  v_year integer;
  v_month integer;
begin
  if not public.is_caregiver_of(p_child_id) then
    raise exception 'not_found';
  end if;
  if (p_name is not null or p_birth_year is not null or p_birth_month is not null)
     and not public.is_primary_caregiver_of(p_child_id) then
    raise exception 'not_primary_caregiver';
  end if;

  select * into v_child from public.children where id = p_child_id for update;
  v_year := coalesce(p_birth_year, v_child.birth_year);
  v_month := coalesce(p_birth_month, v_child.birth_month);
  if p_birth_year is not null or p_birth_month is not null then
    perform public.check_child_birth(v_year, v_month);
  end if;
  if p_name is not null and (v_name is null or char_length(v_name) not between 1 and 80) then
    raise exception 'invalid_input';
  end if;
  if p_theme is not null and p_theme <> '' and p_theme not in ('space', 'ocean', 'dinosaurs', 'trains') then
    raise exception 'invalid_input';
  end if;

  update public.children
  set name = coalesce(v_name, name),
      birth_year = v_year,
      birth_month = v_month,
      age = public.child_age_years(v_year, v_month),
      privacy_tier = public.legacy_privacy_tier(v_year, v_month),
      theme = case when p_theme is null then theme when p_theme = '' then null else p_theme end,
      low_sensory_default = coalesce(p_low_sensory_default, low_sensory_default)
  where id = p_child_id;
end;
$$;

-- Any caregiver. Replaces the whole module list.
create or replace function public.set_child_modules(p_child_id uuid, p_modules text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_caregiver_of(p_child_id) then
    raise exception 'not_found';
  end if;
  if p_modules is null or exists (
       select 1 from unnest(p_modules) m
       where m is null or not exists (select 1 from public.condition_modules c where c.key = m)
     ) then
    raise exception 'invalid_input';
  end if;
  delete from public.child_modules where child_id = p_child_id;
  insert into public.child_modules (child_id, module_key)
  select p_child_id, m from (select distinct unnest(p_modules) m) s;
end;
$$;

-- The young person's own choice, 15 or over only. Service role only: the
-- child-settings Edge Function calls it after verifying the child's token.
-- Caregivers can't call it.
create or replace function public.set_child_sharing(p_child_id uuid, p_share boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_share is null then
    raise exception 'invalid_input';
  end if;
  if public.child_sharing_status(p_child_id) is null then
    raise exception 'not_found';
  end if;
  if public.child_sharing_status(p_child_id) = 'under_15' then
    raise exception 'sharing_not_available_under_15';
  end if;
  update public.children
  set shares_with_caregiver = p_share, sharing_decided_at = now()
  where id = p_child_id;
  return public.child_sharing_status(p_child_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- Privileges
-- ----------------------------------------------------------------------------
-- Clients read the new columns (still no pin_hash).
grant select (birth_year, birth_month, shares_with_caregiver, sharing_decided_at, theme, low_sensory_default)
  on public.children to authenticated;

revoke all on function public.fill_child_birth_from_age() from public, anon, authenticated;
revoke all on function public.child_age_years(integer, integer, date) from public, anon;
revoke all on function public.child_sharing_status(uuid, date) from public, anon, authenticated;
revoke all on function public.caregiver_can_see_child_activity(uuid) from public, anon;
revoke all on function public.legacy_privacy_tier(integer, integer) from public, anon, authenticated;
revoke all on function public.check_child_birth(integer, integer) from public, anon, authenticated;
revoke all on function public.create_child(uuid, text, integer, integer, text, text[]) from public, anon, authenticated;
revoke all on function public.create_child(uuid, text, integer, text, text[]) from public, anon, authenticated;
revoke all on function public.update_child(uuid, text, integer, integer, text, boolean) from public, anon;
revoke all on function public.set_child_modules(uuid, text[]) from public, anon;
revoke all on function public.set_child_sharing(uuid, boolean) from public, anon, authenticated;

grant execute on function public.child_age_years(integer, integer, date) to authenticated, service_role;
grant execute on function public.child_sharing_status(uuid, date) to service_role;
grant execute on function public.caregiver_can_see_child_activity(uuid) to authenticated, service_role;
grant execute on function public.create_child(uuid, text, integer, integer, text, text[]) to service_role;
grant execute on function public.create_child(uuid, text, integer, text, text[]) to service_role;
grant execute on function public.update_child(uuid, text, integer, integer, text, boolean) to authenticated;
grant execute on function public.set_child_modules(uuid, text[]) to authenticated;
grant execute on function public.set_child_sharing(uuid, boolean) to service_role;
