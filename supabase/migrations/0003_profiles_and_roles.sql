-- ============================================================================
-- SafeSpace — Migration 0003: User Profiles & Role Foundation
-- Provides identity, role assignment ('caregiver' | 'user'), and profile state
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'caregiver' check (role in ('caregiver', 'user')),
  display_name text,
  onboarding_state text not null default 'pending' check (onboarding_state in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select, insert, update, delete on public.profiles to authenticated;

-- Row Level Security for profiles
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Function to handle updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Trigger function for creating profile upon auth signup
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_role text;
  user_display_name text;
begin
  user_role := coalesce(new.raw_user_meta_data->>'role', 'caregiver');
  if user_role not in ('caregiver', 'user') then
    user_role := 'caregiver';
  end if;
  user_display_name := new.raw_user_meta_data->>'display_name';

  insert into public.profiles (id, role, display_name)
  values (new.id, user_role, user_display_name)
  on conflict (id) do update
  set display_name = coalesce(excluded.display_name, public.profiles.display_name),
      updated_at = now();

  if user_role = 'caregiver' then
    insert into public.caregivers (id, display_name)
    values (new.id, user_display_name)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- Replace existing handle_new_caregiver trigger with handle_new_user_profile
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Backfill existing caregivers into profiles table
insert into public.profiles (id, role, display_name, created_at)
select id, 'caregiver', display_name, created_at
from public.caregivers
on conflict (id) do nothing;
