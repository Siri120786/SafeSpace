// supabase/functions/_shared/journal.ts
// Pure helpers for journaling (Sprint 3): request validation for the child
// `journal` Edge Function and row -> contract shaping. No Deno APIs, so it
// runs under Node in supabase/tests/journal_handler.test.mts.
// Limits and values mirror the database (20261024100000_journal_entries) and
// packages/shared-types; the tests pin them down.

export const JOURNAL_ENTRY_TYPES = ["journal", "gratitude"] as const;
export const MODULE_KEYS = ["autism", "adhd", "anxiety", "depression", "ptsd", "pcos_pcod"] as const;
export const CONTENT_MAX_LENGTH = 5000;
export const DEFAULT_LIMIT = 30;
export const MAX_LIMIT = 100;

export type JournalRequest =
  | {
    action: "create";
    content: string;
    entryType: (typeof JOURNAL_ENTRY_TYPES)[number];
    moduleKey: (typeof MODULE_KEYS)[number] | null;
    isPrivateNote: boolean;
  }
  | { action: "list"; limit: number; entryType: (typeof JOURNAL_ENTRY_TYPES)[number] | null };

export type JournalParse =
  | { ok: true; value: JournalRequest; childSessionToken: string }
  | { ok: false; status: 400 | 401; error: string };

const oneOf = <T extends readonly string[]>(list: T, v: unknown): v is T[number] =>
  typeof v === "string" && (list as readonly string[]).includes(v);

export function clampLimit(limit: unknown): number {
  if (!Number.isInteger(limit) || (limit as number) < 1) return DEFAULT_LIMIT;
  return Math.min(limit as number, MAX_LIMIT);
}

export function parseJournalRequest(raw: unknown): JournalParse {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, status: 400, error: "invalid_request" };
  }
  const b = raw as Record<string, unknown>;
  if (typeof b.child_session_token !== "string" || !b.child_session_token) {
    return { ok: false, status: 401, error: "invalid_session" };
  }
  const token = b.child_session_token;

  if (b.action === "list") {
    if (b.entry_type !== undefined && b.entry_type !== null && !oneOf(JOURNAL_ENTRY_TYPES, b.entry_type)) {
      return { ok: false, status: 400, error: "invalid_input" };
    }
    return {
      ok: true,
      value: { action: "list", limit: clampLimit(b.limit), entryType: oneOf(JOURNAL_ENTRY_TYPES, b.entry_type) ? b.entry_type : null },
      childSessionToken: token,
    };
  }

  if (b.action === "create") {
    if (typeof b.content !== "string") return { ok: false, status: 400, error: "invalid_input" };
    const content = b.content.trim();
    if (!content) return { ok: false, status: 400, error: "invalid_input" };
    if (content.length > CONTENT_MAX_LENGTH) return { ok: false, status: 400, error: "content_too_long" };
    if (b.entry_type !== undefined && b.entry_type !== null && !oneOf(JOURNAL_ENTRY_TYPES, b.entry_type)) {
      return { ok: false, status: 400, error: "invalid_input" };
    }
    if (b.module_key !== undefined && b.module_key !== null && !oneOf(MODULE_KEYS, b.module_key)) {
      return { ok: false, status: 400, error: "invalid_input" };
    }
    if (b.is_private_note !== undefined && typeof b.is_private_note !== "boolean") {
      return { ok: false, status: 400, error: "invalid_input" };
    }
    return {
      ok: true,
      value: {
        action: "create",
        content,
        entryType: oneOf(JOURNAL_ENTRY_TYPES, b.entry_type) ? b.entry_type : "journal",
        moduleKey: oneOf(MODULE_KEYS, b.module_key) ? b.module_key : null,
        isPrivateNote: b.is_private_note === true,
      },
      childSessionToken: token,
    };
  }
  return { ok: false, status: 400, error: "invalid_action" };
}

export interface JournalRow {
  id: string;
  profile_id: string | null;
  child_id: string | null;
  module_key: string | null;
  entry_type: string;
  content: string;
  is_private_note: boolean;
  created_at: string;
  updated_at: string;
}

// DB row -> JournalEntry contract (camelCase). sentiment_flags is never exposed.
export function toJournalEntry(r: JournalRow) {
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
