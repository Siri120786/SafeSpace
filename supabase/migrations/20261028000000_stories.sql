-- ============================================================================
-- SafeSpace role flow, step 6b: caregiver-made animated stories
-- Migration: 20261028000000_stories
--
-- A story is a script (JSON, the format in supabase/functions/_shared/
-- storyScript.ts) played on the device. Caregivers (and Individuals, for
-- themselves) write one from a template or have Gemini draft it, check it,
-- and publish it to one or more of their children.
--
--   stories          one row per script. Written only by the `stories` Edge
--                    Function (service role), which validates the script.
--   story_children   which children a story is published to. A child only
--                    ever sees stories listed here (through the same function,
--                    with a child-session token).
--   story_writer_attempts + story_writer_take_slot: the daily cap on Gemini
--                    drafts (10 per adult per rolling 24 hours). Owner and
--                    timestamp only, like ai_companion_attempts.
--
-- Reads (authenticated, RLS): the author sees their own stories; every
-- caregiver of a child sees the stories published to that child, so a
-- co-caregiver knows what the child is watching. Clients write nothing.
-- ============================================================================

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  script jsonb not null check (jsonb_typeof(script) = 'object'),
  source text not null check (source in ('template', 'ai', 'manual')),
  template_key text check (template_key is null or template_key ~ '^[a-z_]{1,40}$'),
  -- The caregiver has checked the Telugu of every scene (Gemini's Telugu is a draft).
  telugu_checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stories_author_updated_idx on public.stories (author_id, updated_at desc);

create table public.story_children (
  story_id uuid not null references public.stories(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  published_at timestamptz not null default now(),
  primary key (story_id, child_id)
);

create index story_children_child_idx on public.story_children (child_id, published_at desc);

create trigger set_stories_updated_at
  before update on public.stories
  for each row execute function public.handle_updated_at();

alter table public.stories enable row level security;
alter table public.story_children enable row level security;

-- A story's children, for RLS on stories without recursing through
-- story_children's own policy.
create or replace function public.caregiver_sees_story(p_story_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.story_children sc
    where sc.story_id = p_story_id and public.is_caregiver_of(sc.child_id)
  );
$$;

create policy "Authors and the child's caregivers read stories"
  on public.stories for select to authenticated
  using (author_id = auth.uid() or public.caregiver_sees_story(id));

create policy "Authors and the child's caregivers read story children"
  on public.story_children for select to authenticated
  using (
    public.is_caregiver_of(child_id)
    or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- Gemini draft cap
-- ----------------------------------------------------------------------------
create table public.story_writer_attempts (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index story_writer_attempts_recent
  on public.story_writer_attempts (profile_id, attempted_at desc);

alter table public.story_writer_attempts enable row level security;

-- Atomically "count attempts in the window; if under the limit, record one".
-- Same locking as ai_companion_take_slot. A failed draft still counts.
create or replace function public.story_writer_take_slot(
  p_profile_id uuid,
  p_limit integer,
  p_window_seconds integer default 86400
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_profile_id is null or p_limit is null or p_limit < 1 or p_limit > 100
     or p_window_seconds is null or p_window_seconds < 60 or p_window_seconds > 604800 then
    raise exception 'story_writer_take_slot: invalid input';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('story_writer_attempts:' || p_profile_id::text, 0));

  select count(*) into v_count from public.story_writer_attempts
  where profile_id = p_profile_id
    and attempted_at > clock_timestamp() - make_interval(secs => p_window_seconds);
  if v_count >= p_limit then
    return false;
  end if;

  insert into public.story_writer_attempts (profile_id, attempted_at) values (p_profile_id, clock_timestamp());
  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- Privileges (hosted default privileges grant no data access on new tables)
-- ----------------------------------------------------------------------------
revoke all on public.stories, public.story_children, public.story_writer_attempts from anon, authenticated;
grant select on public.stories, public.story_children to authenticated;
grant select, insert, update, delete on public.stories, public.story_children to service_role;
grant select, insert, delete on public.story_writer_attempts to service_role;

revoke all on function public.caregiver_sees_story(uuid) from public, anon;
grant execute on function public.caregiver_sees_story(uuid) to authenticated, service_role;
revoke all on function public.story_writer_take_slot(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.story_writer_take_slot(uuid, integer, integer) to service_role;

comment on table public.stories is
  'Caregiver-made animated story scripts (role-flow 6b). Written only by the stories Edge Function, which validates the script.';
comment on table public.story_children is
  'Which children a story is published to. Children see only these, through the stories Edge Function.';
comment on table public.story_writer_attempts is
  'Gemini story-draft attempts for the daily cap. Owner + timestamp only. Proposed retention: 48 hours (no cleanup job yet).';
