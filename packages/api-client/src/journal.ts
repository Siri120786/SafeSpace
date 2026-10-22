// packages/api-client/src/journal.ts
// Journaling contract (docs/sprint-3/CONTRACTS.md section 2).
//   - Adults: journal_entries directly under RLS (20261024100000): create,
//     list, delete their own. No edits.
//   - Children: the `journal` Edge Function (create, list).
//   - Caregivers: read their children's entries under RLS; a partial-tier
//     child's private notes are hidden by the database, not by this file.
// Entries are never sent to AI.

import { getSafeSpaceClient } from "./supabaseClient";
import { ContractError, invokeEdge, toContractError } from "./edge";
import {
  JOURNAL_CONTENT_MAX_LENGTH,
  JOURNAL_ENTRY_TYPES,
  MODULE_KEYS,
} from "@safespace/shared-types";
import type {
  AppSession,
  CreateJournalEntryInput,
  JournalEntry,
  JournalEntryType,
  ModuleKey,
} from "@safespace/shared-types";

const COLUMNS = "id, profile_id, child_id, module_key, entry_type, content, is_private_note, created_at, updated_at";
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export interface ListJournalOptions {
  limit?: number;
  entryType?: JournalEntryType;
  moduleKey?: ModuleKey;
}

function toJournalEntry(r: any): JournalEntry {
  return {
    id: r.id,
    profileId: r.profile_id,
    childId: r.child_id,
    moduleKey: r.module_key,
    entryType: r.entry_type,
    content: r.content,
    isPrivateNote: r.is_private_note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function clampLimit(limit: unknown): number {
  if (!Number.isInteger(limit) || (limit as number) < 1) return DEFAULT_LIMIT;
  return Math.min(limit as number, MAX_LIMIT);
}

function checkEntryType(t: unknown): JournalEntryType | undefined {
  if (t === undefined) return undefined;
  if (!(JOURNAL_ENTRY_TYPES as readonly unknown[]).includes(t)) throw new ContractError("invalid_input");
  return t as JournalEntryType;
}

function checkModule(m: unknown): ModuleKey | null | undefined {
  if (m === undefined || m === null) return m as null | undefined;
  if (!(MODULE_KEYS as readonly unknown[]).includes(m)) throw new ContractError("invalid_input");
  return m as ModuleKey;
}

/** Saves an entry for whoever is signed in (adult or child). */
export async function createJournalEntry(session: AppSession, input: CreateJournalEntryInput): Promise<JournalEntry> {
  const content = typeof input?.content === "string" ? input.content.trim() : "";
  if (!content) throw new ContractError("invalid_input");
  if (content.length > JOURNAL_CONTENT_MAX_LENGTH) throw new ContractError("content_too_long");
  const entryType = checkEntryType(input.entryType) ?? "journal";
  const moduleKey = checkModule(input.moduleKey) ?? null;
  if (input.isPrivateNote !== undefined && typeof input.isPrivateNote !== "boolean") throw new ContractError("invalid_input");

  if (session?.kind === "child") {
    const data = await invokeEdge<{ entry: JournalEntry }>("journal", {
      action: "create",
      child_session_token: session.childSessionToken,
      content,
      entry_type: entryType,
      module_key: moduleKey,
      is_private_note: input.isPrivateNote === true,
    });
    return data.entry;
  }

  if (session?.kind === "auth_user") {
    if (input.isPrivateNote) throw new ContractError("private_note_not_allowed_for_privacy_tier");
    const supabase = getSafeSpaceClient();
    const { data, error } = await supabase
      .from("journal_entries")
      .insert({ profile_id: session.profile.id, content, entry_type: entryType, module_key: moduleKey })
      .select(COLUMNS)
      .single();
    if (error) throw toContractError(error);
    return toJournalEntry(data);
  }

  throw new ContractError("unsupported_session");
}

/** The signed-in adult's or child's own entries, newest first. */
export async function listMyJournalEntries(session: AppSession, options: ListJournalOptions = {}): Promise<JournalEntry[]> {
  const limit = clampLimit(options.limit);
  const entryType = checkEntryType(options.entryType);
  const moduleKey = checkModule(options.moduleKey);

  if (session?.kind === "child") {
    const data = await invokeEdge<{ entries: JournalEntry[] }>("journal", {
      action: "list",
      child_session_token: session.childSessionToken,
      // Ask for the max when filtering by module client-side, then trim.
      limit: moduleKey ? MAX_LIMIT : limit,
      entry_type: entryType ?? null,
    });
    const entries = data.entries ?? [];
    return (moduleKey ? entries.filter((e) => e.moduleKey === moduleKey) : entries).slice(0, limit);
  }

  if (session?.kind === "auth_user") {
    const supabase = getSafeSpaceClient();
    let query = supabase
      .from("journal_entries")
      .select(COLUMNS)
      .eq("profile_id", session.profile.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (entryType) query = query.eq("entry_type", entryType);
    if (moduleKey) query = query.eq("module_key", moduleKey);
    const { data, error } = await query;
    if (error) throw toContractError(error);
    return (data ?? []).map(toJournalEntry);
  }

  throw new ContractError("unsupported_session");
}

/** Adults delete their own entry. Children can't delete this sprint. */
export async function deleteJournalEntry(session: AppSession, entryId: string): Promise<void> {
  if (session?.kind !== "auth_user") throw new ContractError("unsupported_session");
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", entryId)
    .eq("profile_id", session.profile.id)
    .select("id");
  if (error) throw toContractError(error);
  if (!data || data.length === 0) throw new ContractError("not_found");
}

/** A caregiver's view of one child's entries (private notes hidden by RLS). */
export async function listChildJournalEntries(
  childId: string,
  options: Omit<ListJournalOptions, "moduleKey"> = {},
): Promise<JournalEntry[]> {
  const entryType = checkEntryType(options.entryType);
  const supabase = getSafeSpaceClient();
  let query = supabase
    .from("journal_entries")
    .select(COLUMNS)
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(clampLimit(options.limit));
  if (entryType) query = query.eq("entry_type", entryType);
  const { data, error } = await query;
  if (error) throw toContractError(error);
  return (data ?? []).map(toJournalEntry);
}
