-- ============================================================================
-- Migration: 20261027300000_routine_step_icons (role-flow step 4c)
-- Routine steps get an optional icon, chosen by the caregiver from a fixed
-- list (docs/role-flow/CONTRACT.md section 3: steps with time, icon, title).
-- The child's Now / Next cards show it (P1).
--
-- Stored as a short key, not an emoji, so the apps decide how to draw it.
-- The list lives here and in ROUTINE_STEP_ICONS (packages/shared-types);
-- supabase/tests/routine_step_icons.test.mts checks they match.
--
-- The column inherits the table's existing grants. create_routine_with_steps
-- keeps its signature (and so its grants) and now also stores `icon`.
-- ============================================================================

alter table public.routine_steps
  add column if not exists icon text;

alter table public.routine_steps
  add constraint routine_steps_icon_known check (
    icon is null or icon in (
      'wake', 'toilet', 'wash', 'brush_teeth', 'dress', 'breakfast', 'lunch',
      'dinner', 'snack', 'water', 'medicine', 'school', 'homework', 'reading',
      'play', 'outdoor', 'exercise', 'music', 'screen', 'tidy', 'bath', 'calm',
      'bed'
    )
  );

comment on column public.routine_steps.icon is
  'Optional icon key from a fixed list (role-flow 4c); null = no icon.';

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
    insert into public.routine_steps (routine_id, label, scheduled_time, order_index, icon)
    values (
      v_routine_id,
      btrim(v_step->>'label'),
      nullif(v_step->>'scheduled_time', '')::time,
      v_index,
      nullif(v_step->>'icon', '')
    );
    v_index := v_index + 1;
  end loop;

  return v_routine_id;
end;
$$;
