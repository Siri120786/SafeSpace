-- ============================================================================
-- Migration: 20261028100000_child_themes (role-flow step 8d)
-- Manju's special-interest themes join the child themes: "calm", "animals"
-- and "nature" are added to space, ocean, dinosaurs and trains. Each theme now
-- gives the child's space its own soft colours (apps/web: childThemes.ts);
-- low-sensory mode always shows the calm look.
--
-- The list lives in two places, both widened here: the column check on
-- children.theme and update_child()'s input check. update_child keeps its
-- signature, so its grants (authenticated) are unchanged; the body is the
-- same as in 20261027100000 apart from the theme list.
-- ============================================================================

alter table public.children drop constraint if exists children_theme_check;
alter table public.children
  add constraint children_theme_check
  check (theme in ('space', 'ocean', 'dinosaurs', 'trains', 'calm', 'animals', 'nature'));

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
  if p_theme is not null and p_theme <> ''
     and p_theme not in ('space', 'ocean', 'dinosaurs', 'trains', 'calm', 'animals', 'nature') then
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
