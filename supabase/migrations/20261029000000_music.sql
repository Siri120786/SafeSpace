-- ============================================================================
-- SafeSpace role flow, step 9b/9c: music
-- Migration: 20261029000000_music
--
-- Music (step 9a) plays sounds and rhyme tunes made in the browser. This adds:
--
--   music_favorites   the tracks a person has hearted (dual owner: an adult
--                     profile_id OR a child child_id). Track ids come from the
--                     web app's catalog, so they are text, not foreign keys.
--   tool_settings     three caregiver controls for a child's music:
--                     music_enabled, music_volume_max (percent of full, 10-60)
--                     and music_sleep_minutes (a sleep timer that starts with
--                     every play: 10, 20 or 30).
--   storage "music"   a public, read-only bucket for hosted song files. Only
--                     the service role (the upload script) can add files.
--
-- Access:
--   adults      -> their own favorites, directly under RLS
--   children    -> their own favorites through the `focus-tools` Edge
--                  Function (service role)
--   caregivers  -> NOT a child's favorites (Siri, 2026-10-24: nothing about
--                  listening is shared, and no listening history is kept).
--                  They set the child's music controls in tool_settings,
--                  under the existing tool_settings policies.
--   anon        -> nothing (song files are public, like any web asset)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Favorites
-- ----------------------------------------------------------------------------
create table public.music_favorites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  track_id text not null check (track_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  created_at timestamptz not null default now(),
  constraint music_favorites_one_owner check ((profile_id is null) <> (child_id is null)),
  constraint music_favorites_profile_track unique (profile_id, track_id),
  constraint music_favorites_child_track unique (child_id, track_id)
);
create index music_favorites_profile_idx on public.music_favorites (profile_id, created_at desc) where profile_id is not null;
create index music_favorites_child_idx on public.music_favorites (child_id, created_at desc) where child_id is not null;

create trigger music_favorites_limit
  before insert on public.music_favorites
  for each row execute function public.focus_tools_owner_limit('100');

alter table public.music_favorites enable row level security;

create policy "Adults read their own music favorites" on public.music_favorites
  for select to authenticated using (auth.uid() = profile_id);
create policy "Adults add their own music favorites" on public.music_favorites
  for insert to authenticated with check (auth.uid() = profile_id and child_id is null);
create policy "Adults remove their own music favorites" on public.music_favorites
  for delete to authenticated using (auth.uid() = profile_id);

revoke all on public.music_favorites from anon, authenticated;
grant select, insert, delete on public.music_favorites to authenticated;
grant select, insert, update, delete on public.music_favorites to service_role;

comment on table public.music_favorites is 'Hearted music tracks (role-flow 9b). Adult or child owner; caregivers cannot read them.';

-- ----------------------------------------------------------------------------
-- A child's music controls (set by any of their caregivers)
-- ----------------------------------------------------------------------------
alter table public.tool_settings
  add column music_enabled boolean not null default true,
  add column music_volume_max smallint check (music_volume_max between 10 and 60),
  add column music_sleep_minutes smallint check (music_sleep_minutes in (10, 20, 30));

comment on column public.tool_settings.music_enabled is 'Music on or off for a child (role-flow 9c).';
comment on column public.tool_settings.music_volume_max is 'A child''s music volume ceiling, percent of full (10-60); null means the default 60.';
comment on column public.tool_settings.music_sleep_minutes is 'A sleep timer that starts with every play for a child (10, 20 or 30); null means none.';

-- ----------------------------------------------------------------------------
-- Song files: a public, read-only bucket (only where Storage exists, so the
-- in-memory test database, which has no storage schema, still applies this)
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('music', 'music', true, 20971520, array['audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/wav'])
    on conflict (id) do update
      set public = true,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end;
$$;
-- No storage.objects policies for this bucket: the public URL serves files to
-- anyone, and nobody but the service role can add, change or remove them.
