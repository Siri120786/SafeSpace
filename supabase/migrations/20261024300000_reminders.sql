-- ============================================================================
-- SafeSpace Sprint 3: Reminders (in-app delivery)
-- Migration: 20261024300000_reminders
--
-- Contract: docs/sprint-3/CONTRACTS.md section 4.
-- Reminders are delivered IN-APP only this sprint: schedules are stored, and
-- the app works out what is due while it is open. No push, SMS or email, no
-- scheduler, no provider secrets.
--
--   reminders: one owner (adult profile_id OR child child_id), kind, title,
--     time_of_day + days_of_week in the reminder's own IANA timezone, enabled.
--     A 'routine' reminder points at a routine owned by the SAME owner.
--   reminder_acknowledgements: one row per reminder per local date the
--     occurrence was marked done/dismissed (window: 7 days back, 1 ahead).
--
-- Access (same pattern as routines):
--   adults      -> full control of their own reminders and acknowledgements
--   caregivers  -> full control of their children's reminders; READ-only on
--                  their children's acknowledgements
--   children    -> no Supabase login; list / list_due / acknowledge through
--                  the `reminders` Edge Function (service role)
--   linked caregivers of an adult -> nothing
--   anon        -> nothing
-- Medication titles are free text: the UI must keep them generic and must not
-- ask for drug names (contract privacy note).
-- ============================================================================

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  kind text not null check (kind in ('routine', 'water', 'medication', 'wellness', 'custom')),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  routine_id uuid references public.routines(id) on delete cascade,
  time_of_day time not null,
  days_of_week smallint[] not null default '{}'
    check (days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  timezone text not null check (char_length(timezone) between 1 and 64),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reminders_one_owner check (
    (profile_id is not null and child_id is null) or
    (profile_id is null and child_id is not null)
  ),
  -- routine_id is set exactly when the reminder is about a routine.
  constraint reminders_routine_kind check ((kind = 'routine') = (routine_id is not null))
);

create index reminders_profile_idx on public.reminders (profile_id) where profile_id is not null;
create index reminders_child_idx on public.reminders (child_id) where child_id is not null;

create trigger set_reminders_updated_at
  before update on public.reminders
  for each row execute function public.handle_updated_at();

-- Timezone must be one Postgres knows, and a linked routine must belong to
-- the same owner (SECURITY DEFINER so the check isn't hidden by RLS).
create or replace function public.enforce_reminder_rules()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'invalid_input';
  end if;
  if new.routine_id is not null and not exists (
    select 1 from public.routines r
    where r.id = new.routine_id
      and r.profile_id is not distinct from new.profile_id
      and r.child_id is not distinct from new.child_id
  ) then
    raise exception 'invalid_input';
  end if;
  return new;
end;
$$;

create trigger enforce_reminder_rules
  before insert or update on public.reminders
  for each row execute function public.enforce_reminder_rules();

create table public.reminder_acknowledgements (
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  occurs_on date not null,
  acknowledged_at timestamptz not null default now(),
  primary key (reminder_id, occurs_on)
);

create or replace function public.enforce_reminder_ack_window()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.occurs_on > (now() at time zone 'utc')::date + 1
     or new.occurs_on < (now() at time zone 'utc')::date - 7 then
    raise exception 'invalid_input';
  end if;
  return new;
end;
$$;

create trigger enforce_reminder_ack_window
  before insert or update on public.reminder_acknowledgements
  for each row execute function public.enforce_reminder_ack_window();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.reminders enable row level security;
alter table public.reminder_acknowledgements enable row level security;

revoke all on public.reminders from anon, authenticated;
revoke all on public.reminder_acknowledgements from anon, authenticated;
grant select, insert, update, delete on public.reminders to authenticated;
grant select, insert, delete on public.reminder_acknowledgements to authenticated;

create policy "Adults manage their own reminders"
  on public.reminders for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id and child_id is null);

create policy "Caregivers manage their children's reminders"
  on public.reminders for all
  using (exists (select 1 from public.children c
                 where c.id = reminders.child_id and c.caregiver_id = auth.uid()))
  with check (profile_id is null and exists (select 1 from public.children c
                 where c.id = reminders.child_id and c.caregiver_id = auth.uid()));

create policy "Adults manage acknowledgements of their own reminders"
  on public.reminder_acknowledgements for all
  using (exists (select 1 from public.reminders r
                 where r.id = reminder_acknowledgements.reminder_id and r.profile_id = auth.uid()))
  with check (exists (select 1 from public.reminders r
                 where r.id = reminder_acknowledgements.reminder_id and r.profile_id = auth.uid()));

create policy "Caregivers read their children's acknowledgements"
  on public.reminder_acknowledgements for select
  using (exists (select 1 from public.reminders r
                 join public.children c on c.id = r.child_id
                 where r.id = reminder_acknowledgements.reminder_id and c.caregiver_id = auth.uid()));

comment on table public.reminders is
  'Sprint 3 reminders, delivered in-app only (the app computes what is due). Keep medication titles generic.';
comment on table public.reminder_acknowledgements is
  'One row per reminder per local date its occurrence was marked done or dismissed.';
