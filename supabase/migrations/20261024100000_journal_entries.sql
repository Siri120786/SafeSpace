-- ============================================================================
-- SafeSpace Sprint 3: Journaling for adults and children
-- Migration: 20261024100000_journal_entries
--
-- Contract: docs/sprint-3/CONTRACTS.md section 2.
-- Extends journal_entries (0001, child-only) to the dual-identity pattern used
-- by mood_checkins and routines:
--   - owner: adult profile_id OR child child_id (exactly one)
--   - entry_type: 'journal' | 'gratitude'
--   - module_key is optional (null = shared journal)
--   - updated_at maintained by trigger
--   - is_private_note only allowed for a child on the 'partial' tier, now
--     enforced in the database (0001 documented the rule but didn't enforce it)
--
-- Access:
--   adults      -> create, read and delete their own entries (no edits)
--   caregivers  -> READ ONLY, under the existing 0001 privacy-tier policy,
--                  which is kept unchanged: a partial-tier child's private
--                  notes stay hidden. The 13+ 'private' tier is still an open
--                  project decision and is not changed here.
--   children    -> no Supabase login; create and list through the `journal`
--                  Edge Function (service role)
--   linked caregivers of an adult -> nothing
--   anon        -> nothing
-- Journal entries are never sent to AI; sentiment_flags stays unused.
-- ============================================================================

alter table public.journal_entries
  add column profile_id uuid references public.profiles(id) on delete cascade,
  add column entry_type text not null default 'journal'
    check (entry_type in ('journal', 'gratitude')),
  add column updated_at timestamptz not null default now();

alter table public.journal_entries alter column child_id drop not null;
alter table public.journal_entries alter column module_key drop not null;

alter table public.journal_entries
  add constraint journal_entries_one_owner check (
    (profile_id is not null and child_id is null) or
    (profile_id is null and child_id is not null)
  ),
  add constraint journal_entries_private_note_child_only check (
    not is_private_note or child_id is not null
  );

-- Length rule for new and edited entries. NOT VALID: existing rows (written
-- before this rule) aren't rechecked, so the migration can't fail on old data.
alter table public.journal_entries
  add constraint journal_entries_content_length
    check (char_length(btrim(content)) between 1 and 5000) not valid;

create index if not exists journal_entries_profile_created_idx
  on public.journal_entries (profile_id, created_at desc) where profile_id is not null;
create index if not exists journal_entries_child_created_idx
  on public.journal_entries (child_id, created_at desc) where child_id is not null;

create trigger set_journal_entries_updated_at
  before update on public.journal_entries
  for each row execute function public.handle_updated_at();

-- Private notes only for a child on the 'partial' tier (same rule and error
-- as mood_checkins), enforced here so no writer can bypass it.
create or replace function public.enforce_journal_private_note_tier()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_private_note and not exists (
    select 1 from public.children c
    where c.id = new.child_id and c.privacy_tier = 'partial'
  ) then
    raise exception 'private_note_not_allowed_for_privacy_tier';
  end if;
  return new;
end;
$$;

create trigger enforce_journal_private_note_tier
  before insert or update on public.journal_entries
  for each row execute function public.enforce_journal_private_note_tier();

-- ----------------------------------------------------------------------------
-- Privileges and policies
-- ----------------------------------------------------------------------------
-- 0001 relied on Supabase's default grants (ALL to anon and authenticated).
revoke all on public.journal_entries from anon, authenticated;
grant select, insert, delete on public.journal_entries to authenticated;

-- Kept as is: "Caregivers read journal entries respecting privacy tier" (0001).

create policy "Adults read their own journal entries"
  on public.journal_entries for select
  using (auth.uid() = profile_id);

create policy "Adults create their own journal entries"
  on public.journal_entries for insert
  with check (auth.uid() = profile_id and child_id is null and not is_private_note);

create policy "Adults delete their own journal entries"
  on public.journal_entries for delete
  using (auth.uid() = profile_id);

comment on column public.journal_entries.entry_type is
  'journal | gratitude (Bright Days gratitude journal).';
comment on column public.journal_entries.sentiment_flags is
  'Unused. Journal entries are not analysed by AI (Sprint 3 contract).';
