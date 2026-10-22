-- ============================================================================
-- SafeSpace V1: AI Companion Conversations & Messages Schema
-- Migration: 20261020000000_ai_companion_conversations
--
-- Supports dual-track identity:
--   - Adult Auth Users (profile_id -> public.profiles(id))
--   - Child Sessions (child_id -> public.children(id))
--
-- All writes go through the ai-companion Edge Function (service role), which
-- verifies identity, runs the crisis screen and stores both sides of the
-- exchange. Clients get READ-ONLY access under RLS, so nobody can insert a
-- fake "assistant" message or rewrite history with a direct API call.
--
-- Privacy:
--   - Adults read only their own conversations.
--   - Linked caregivers (caregiver_user_links) get NO access to an adult
--     user's AI conversations (docs/caregiver-privacy-boundary.md).
--   - A child's caregiver can read that child's conversations. Whether the
--     'partial' privacy tier should hide some of them is an open decision
--     (docs/AI_COMPANION.md).
-- ============================================================================

create table if not exists public.ai_companion_conversations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  title text not null default 'New conversation'
    check (char_length(title) between 1 and 80),
  language text not null default 'en'
    check (language in ('en', 'hi', 'te', 'ta', 'kn', 'mr', 'bn', 'ur')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_companion_conversations_owner_check check (
    (profile_id is not null and child_id is null) or
    (profile_id is null and child_id is not null)
  )
);

create table if not exists public.ai_companion_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_companion_conversations(id) on delete cascade,
  sender text not null check (sender in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  detected_language text
    check (detected_language in ('en', 'hi', 'te', 'ta', 'kn', 'mr', 'bn', 'ur')),
  -- true when the assistant reply is the fixed crisis-screen message rather
  -- than model output (and on the user message that triggered it).
  is_safety_response boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_conversations_profile_updated
  on public.ai_companion_conversations (profile_id, updated_at desc);
create index if not exists idx_ai_conversations_child_updated
  on public.ai_companion_conversations (child_id, updated_at desc);
create index if not exists idx_ai_messages_conversation_created
  on public.ai_companion_messages (conversation_id, created_at);

create trigger set_ai_companion_conversations_updated_at
  before update on public.ai_companion_conversations
  for each row execute function public.handle_updated_at();

alter table public.ai_companion_conversations enable row level security;
alter table public.ai_companion_messages enable row level security;

-- Read-only for clients. Supabase grants ALL on new public tables to
-- `authenticated` by default, so revoke explicitly.
revoke all on public.ai_companion_conversations from authenticated;
revoke all on public.ai_companion_messages from authenticated;
grant select on public.ai_companion_conversations to authenticated;
grant select on public.ai_companion_messages to authenticated;

create policy "Adult users read their own conversations"
  on public.ai_companion_conversations for select
  using (auth.uid() = profile_id);

create policy "Adult users read messages in their own conversations"
  on public.ai_companion_messages for select
  using (
    exists (
      select 1 from public.ai_companion_conversations c
      where c.id = ai_companion_messages.conversation_id
        and c.profile_id = auth.uid()
    )
  );

create policy "Caregivers read child AI conversations"
  on public.ai_companion_conversations for select
  using (
    exists (
      select 1 from public.children c
      where c.id = ai_companion_conversations.child_id
        and c.caregiver_id = auth.uid()
    )
  );

create policy "Caregivers read child AI messages"
  on public.ai_companion_messages for select
  using (
    exists (
      select 1 from public.ai_companion_conversations conv
      join public.children c on c.id = conv.child_id
      where conv.id = ai_companion_messages.conversation_id
        and c.caregiver_id = auth.uid()
    )
  );

comment on table public.ai_companion_conversations is
  'AI Companion conversations. Written only by the ai-companion Edge Function.';
comment on column public.ai_companion_messages.is_safety_response is
  'Marks the crisis-screen exchange: the reply is a fixed safety message, not model output.';
