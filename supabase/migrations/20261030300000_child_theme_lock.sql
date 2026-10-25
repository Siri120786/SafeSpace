-- ============================================================================
-- Migration: 20261030300000_child_theme_lock
-- A child picks their own theme (it styles their space and their ADHD and
-- autism tools); any of their caregivers can lock it so it stays as set.
--
--   children.theme_locked      false by default: the child may pick.
--   set_child_theme_lock()     any caregiver of the child (authenticated).
--   set_child_own_theme()      the child's pick, through the child-settings
--                              Edge Function (service_role only, with the
--                              child id from the verified token). Refused
--                              with theme_locked while the lock is on.
--
-- The theme list is the same seven as 20261028100000. update_child() is
-- unchanged: caregivers still set the theme there, locked or not.
-- ============================================================================

alter table public.children
  add column if not exists theme_locked boolean not null default false;

create or replace function public.set_child_theme_lock(p_child_id uuid, p_locked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_caregiver_of(p_child_id) then
    raise exception 'not_found';
  end if;
  if p_locked is null then
    raise exception 'invalid_input';
  end if;
  update public.children set theme_locked = p_locked where id = p_child_id;
end;
$$;

create or replace function public.set_child_own_theme(p_child_id uuid, p_theme text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked boolean;
begin
  if p_theme is null
     or p_theme not in ('space', 'ocean', 'dinosaurs', 'trains', 'calm', 'animals', 'nature') then
    raise exception 'invalid_input';
  end if;
  select theme_locked into v_locked from public.children where id = p_child_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_locked then
    raise exception 'theme_locked';
  end if;
  update public.children set theme = p_theme where id = p_child_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Privileges
-- ----------------------------------------------------------------------------
grant select (theme_locked) on public.children to authenticated;

revoke all on function public.set_child_theme_lock(uuid, boolean) from public, anon;
revoke all on function public.set_child_own_theme(uuid, text) from public, anon, authenticated;

grant execute on function public.set_child_theme_lock(uuid, boolean) to authenticated;
grant execute on function public.set_child_own_theme(uuid, text) to service_role;
