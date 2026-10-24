-- ============================================================================
-- SafeSpace: Games Corner creations saved to the account
-- Migration: 20261029400000_game_creations
--
-- Imagine & Create let a player keep up to 12 characters, scenes and stories,
-- stored in the browser and left behind on a shared device after sign-out.
-- Siri decided (2026-10-24) to keep them in the player's account instead, and
-- to keep them PRIVATE: they are the player's own creative work.
--
--   game_creations  one row per kept creation: the app's id for it, its kind
--                   and the choices made (plus a name of up to 24 characters
--                   and the player's own story text of up to 240). At most 12
--                   per player: keeping a 13th lets the oldest go, as before.
--
-- Access:
--   adults      -> their own, directly under RLS
--   children    -> their own, only through the `games` Edge Function
--                  (service role; child_id from the verified session token)
--   caregivers  -> NOTHING (Siri, 2026-10-24: the creations are the child's)
--   anon        -> nothing
-- Crisis detection does not read this text (scope unchanged, Siri 2026-10-24).
-- ============================================================================

-- A creation's content: an object, at most 4 KB, with any name at most 24
-- characters and any own story text at most 240.
create or replace function public.valid_game_creation(p_kind text, p jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(jsonb_typeof(p), '') = 'object'
     and octet_length(p::text) <= 4096
     and p ? p_kind
     and coalesce(jsonb_typeof(p -> p_kind), '') = 'object'
     and (not (p -> p_kind) ? 'name' or (
       coalesce(jsonb_typeof(p -> p_kind -> 'name'), '') = 'string' and char_length(p -> p_kind ->> 'name') <= 24))
     and (not (p -> p_kind) ? 'ownText' or (
       coalesce(jsonb_typeof(p -> p_kind -> 'ownText'), '') = 'string' and char_length(p -> p_kind ->> 'ownText') <= 240));
$$;

create table public.game_creations (
  pk uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  -- The app's own id for the creation (e.g. "story-1792845300000").
  id text not null check (id ~ '^[a-z]{1,12}-[0-9]{1,16}$'),
  kind text not null check (kind in ('character', 'scene', 'story')),
  content jsonb not null,
  created_at timestamptz not null default now(),
  constraint game_creations_content check (public.valid_game_creation(kind, content)),
  constraint game_creations_one_owner check ((profile_id is null) <> (child_id is null)),
  constraint game_creations_profile_id unique (profile_id, id),
  constraint game_creations_child_id unique (child_id, id)
);
create index game_creations_profile_created on public.game_creations (profile_id, created_at desc) where profile_id is not null;
create index game_creations_child_created on public.game_creations (child_id, created_at desc) where child_id is not null;

-- Keeping a 13th lets the oldest go (newest 12 stay), as the game always did.
create or replace function public.game_creations_keep_newest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.game_creations g
  where g.profile_id is not distinct from new.profile_id
    and g.child_id is not distinct from new.child_id
    and g.pk not in (
      select k.pk from public.game_creations k
      where k.profile_id is not distinct from new.profile_id
        and k.child_id is not distinct from new.child_id
      order by k.created_at desc, k.pk desc
      limit 12
    );
  return null;
end;
$$;

create trigger game_creations_keep_newest
  after insert on public.game_creations
  for each row execute function public.game_creations_keep_newest();

alter table public.game_creations enable row level security;

create policy "Adults read their own creations" on public.game_creations
  for select to authenticated using (auth.uid() = profile_id);
create policy "Adults keep their own creations" on public.game_creations
  for insert to authenticated with check (auth.uid() = profile_id and child_id is null);
create policy "Adults remove their own creations" on public.game_creations
  for delete to authenticated using (auth.uid() = profile_id);

-- Hosted projects grant nothing by default, local ones grant everything:
-- revoke, then grant exactly what the policies and the function need.
revoke all on public.game_creations from anon, authenticated, service_role;
grant select, insert, delete on public.game_creations to authenticated;
grant select, insert, delete on public.game_creations to service_role;
revoke all on function public.game_creations_keep_newest() from public, anon, authenticated;

comment on table public.game_creations is
  'Games Corner: characters, scenes and stories a player kept (newest 12). Private to the player; caregivers cannot read them.';
