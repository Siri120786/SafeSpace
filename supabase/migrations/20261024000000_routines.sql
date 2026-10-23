-- ============================================================================
-- SafeSpace Sprint 3: Routines with per-day progress
-- Migration: 20261024000000_routines
--
-- Contract: docs/sprint-3/CONTRACTS.md section 3.
--   - routines: a titled, ordered list of steps, owned by exactly one identity
--     (adult profile_id OR child child_id), scheduled on days_of_week
--     (0 = Sunday ... 6 = Saturday; empty = every day).
--   - routine_steps (existing, 0001): now belongs to a routine. Existing rows
--     are kept and grouped into one routine per (child, module). The legacy
--     child_id / module_key / is_complete columns are no longer used.
--   - routine_step_completions: one row per step per LOCAL calendar date, so
--     "done today", history and streaks persist.
--
-- Access:
--   adults        -> full control of their own routines, steps, completions
--   caregivers    -> full control of their children's routines and steps;
--                    READ-only on their children's completions
--   children      -> no Supabase login; list and complete steps through the
--                    `routines` Edge Function (service role)
--   linked caregivers of an adult -> nothing
--   anon          -> nothing
-- Routines never call AI (architecture rule).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- routines
-- ----------------------------------------------------------------------------
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  module_key text references public.condition_modules(key),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  days_of_week smallint[] not null default '{}'
    check (days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint routines_one_owner check (
    (profile_id is not null and child_id is null) or
    (profile_id is null and child_id is not null)
  )
);

create index routines_profile_idx on public.routines (profile_id) where profile_id is not null;
create index routines_child_idx on public.routines (child_id) where child_id is not null;

create trigger set_routines_updated_at
  before update on public.routines
  for each row execute function public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- routine_steps: attach to routines, keep existing rows
-- ----------------------------------------------------------------------------
alter table public.routine_steps
  add column routine_id uuid references public.routines(id) on delete cascade;

-- Group existing child steps into one routine per (child, module).
insert into public.routines (child_id, module_key, title)
select distinct s.child_id, s.module_key, coalesce(cm.display_name, 'My routine')
from public.routine_steps s
left join public.condition_modules cm on cm.key = s.module_key
where s.child_id is not null;

update public.routine_steps s
set routine_id = r.id
from public.routines r
where r.child_id = s.child_id
  and r.module_key is not distinct from s.module_key
  and s.routine_id is null;

alter table public.routine_steps alter column routine_id set not null;

-- Legacy columns: kept for existing data, no longer written by the app.
alter table public.routine_steps alter column child_id drop not null;
alter table public.routine_steps alter column module_key drop not null;
comment on column public.routine_steps.child_id is 'DEPRECATED (Sprint 3): ownership comes from routine_id.';
comment on column public.routine_steps.module_key is 'DEPRECATED (Sprint 3): module comes from the routine.';
comment on column public.routine_steps.is_complete is 'DEPRECATED (Sprint 3): use routine_step_completions (per day).';

alter table public.routine_steps
  add constraint routine_steps_label_length check (char_length(btrim(label)) between 1 and 120);

create index routine_steps_routine_order_idx on public.routine_steps (routine_id, order_index);

-- ----------------------------------------------------------------------------
-- routine_step_completions
-- ----------------------------------------------------------------------------
create table public.routine_step_completions (
  step_id uuid not null references public.routine_steps(id) on delete cascade,
  completed_on date not null,
  completed_at timestamptz not null default now(),
  primary key (step_id, completed_on)
);

-- Only recent dates: today (with a day of timezone slack) back to 6 days ago.
-- No future completions, no rewriting old history.
create or replace function public.enforce_routine_completion_window()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.completed_on > (now() at time zone 'utc')::date + 1
     or new.completed_on < (now() at time zone 'utc')::date - 7 then
    raise exception 'completion_date_out_of_range';
  end if;
  return new;
end;
$$;

create trigger enforce_routine_completion_window
  before insert or update on public.routine_step_completions
  for each row execute function public.enforce_routine_completion_window();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.routines enable row level security;
alter table public.routine_step_completions enable row level security;
-- routine_steps already has RLS enabled (0001); replace its child-only policy.
drop policy if exists "Caregivers read and edit their children's routines" on public.routine_steps;

-- Supabase grants ALL on new public tables to anon/authenticated by default:
-- revoke explicitly, then grant only what the policies below need.
revoke all on public.routines from anon, authenticated;
revoke all on public.routine_steps from anon, authenticated;
revoke all on public.routine_step_completions from anon, authenticated;
grant select, insert, update, delete on public.routines to authenticated;
grant select, insert, update, delete on public.routine_steps to authenticated;
grant select, insert, delete on public.routine_step_completions to authenticated;

-- routines: adult owners and caregivers of the owning child.
create policy "Adults manage their own routines"
  on public.routines for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id and child_id is null);

create policy "Caregivers manage their children's routines"
  on public.routines for all
  using (exists (select 1 from public.children c
                 where c.id = routines.child_id and c.caregiver_id = auth.uid()))
  with check (profile_id is null and exists (select 1 from public.children c
                 where c.id = routines.child_id and c.caregiver_id = auth.uid()));

-- routine_steps: whoever can manage the routine can manage its steps. The
-- subquery runs under the routines policies above, so it inherits them.
create policy "Routine managers manage steps"
  on public.routine_steps for all
  using (exists (select 1 from public.routines r where r.id = routine_steps.routine_id))
  with check (exists (select 1 from public.routines r where r.id = routine_steps.routine_id));

-- completions: adults read and write their own; caregivers read only.
create policy "Adults manage completions of their own routines"
  on public.routine_step_completions for all
  using (exists (select 1 from public.routine_steps s
                 join public.routines r on r.id = s.routine_id
                 where s.id = routine_step_completions.step_id and r.profile_id = auth.uid()))
  with check (exists (select 1 from public.routine_steps s
                 join public.routines r on r.id = s.routine_id
                 where s.id = routine_step_completions.step_id and r.profile_id = auth.uid()));

create policy "Caregivers read their children's completions"
  on public.routine_step_completions for select
  using (exists (select 1 from public.routine_steps s
                 join public.routines r on r.id = s.routine_id
                 join public.children c on c.id = r.child_id
                 where s.id = routine_step_completions.step_id and c.caregiver_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- Atomic helpers (SECURITY INVOKER: they run with the caller's RLS)
-- ----------------------------------------------------------------------------

-- Creates a routine and all of its steps in one transaction. p_child_id null
-- means "for myself" (adult); otherwise the caller must be that child's
-- caregiver, which the routines policies enforce.
create or replace function public.create_routine_with_steps(
  p_child_id uuid,
  p_title text,
  p_module_key text,
  p_days_of_week smallint[],
  p_steps jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_routine_id uuid;
  v_step jsonb;
  v_index int := 0;
begin
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' then
    raise exception 'invalid_input';
  end if;

  insert into public.routines (profile_id, child_id, module_key, title, days_of_week)
  values (
    case when p_child_id is null then auth.uid() end,
    p_child_id,
    p_module_key,
    btrim(p_title),
    coalesce(p_days_of_week, '{}')
  )
  returning id into v_routine_id;

  for v_step in select * from jsonb_array_elements(p_steps) loop
    insert into public.routine_steps (routine_id, label, scheduled_time, order_index)
    values (
      v_routine_id,
      btrim(v_step->>'label'),
      nullif(v_step->>'scheduled_time', '')::time,
      v_index
    );
    v_index := v_index + 1;
  end loop;

  return v_routine_id;
end;
$$;

-- Rewrites order_index for every step of a routine. p_step_ids must contain
-- each of the routine's steps exactly once.
create or replace function public.reorder_routine_steps(p_routine_id uuid, p_step_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing uuid[];
begin
  select coalesce(array_agg(id order by id), '{}') into v_existing
  from public.routine_steps where routine_id = p_routine_id;

  if v_existing = '{}' or array_length(p_step_ids, 1) is distinct from array_length(v_existing, 1)
     or (select array_agg(x order by x) from unnest(p_step_ids) x) <> v_existing then
    raise exception 'invalid_input';
  end if;

  update public.routine_steps s
  set order_index = o.ord - 1
  from unnest(p_step_ids) with ordinality as o(id, ord)
  where s.id = o.id and s.routine_id = p_routine_id;
end;
$$;

revoke all on function public.create_routine_with_steps(uuid, text, text, smallint[], jsonb) from public, anon;
revoke all on function public.reorder_routine_steps(uuid, uuid[]) from public, anon;
grant execute on function public.create_routine_with_steps(uuid, text, text, smallint[], jsonb) to authenticated, service_role;
grant execute on function public.reorder_routine_steps(uuid, uuid[]) to authenticated, service_role;

comment on table public.routines is
  'Sprint 3 routines: ordered steps on chosen weekdays, owned by an adult or a child. Never uses AI.';
comment on table public.routine_step_completions is
  'One row per routine step per local date it was completed.';
