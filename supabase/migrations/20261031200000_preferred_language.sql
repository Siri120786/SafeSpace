-- Language preference (English, Hindi or Telugu) for the whole app.
--
--   - profiles.preferred_language: an adult's own choice. They update it like
--     their display name (a column-level grant; RLS still limits it to their
--     own row).
--   - children.preferred_language: a child's own choice, changed only through
--     set_child_language() from the child-settings Edge Function (service
--     role), like their theme.
-- null means "not chosen yet": the app then follows the device's language.

alter table public.profiles
  add column if not exists preferred_language text
    check (preferred_language is null or preferred_language in ('en', 'hi', 'te'));

alter table public.children
  add column if not exists preferred_language text
    check (preferred_language is null or preferred_language in ('en', 'hi', 'te'));

grant update (preferred_language) on public.profiles to authenticated;

create or replace function public.set_child_language(p_child_id uuid, p_language text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_language is null or p_language not in ('en', 'hi', 'te') then
    raise exception 'invalid_input';
  end if;
  update public.children set preferred_language = p_language where id = p_child_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

revoke all on function public.set_child_language(uuid, text) from public, anon, authenticated;
grant execute on function public.set_child_language(uuid, text) to service_role;
