// supabase/functions/journal/handler.ts
// Child-facing journaling (Sprint 3). Children have no Supabase login, so this
// function verifies the signed child-session token, derives the child_id, and
// writes/reads ONLY that child's entries with the service role. Children can
// create and list their own entries; caregivers read them under RLS only while
// the child's activity is shared (docs/role-flow/CONTRACT.md section 5).
// Entries are never sent to AI. Contract: docs/sprint-3/CONTRACTS.md section 2.
//
// Actions:
//   create { child_session_token, content, entry_type?, module_key? }
//          (is_private_note: true is refused; private notes were removed)
//   list   { child_session_token, limit?, entry_type? }
//
// No Deno or esm.sh imports; index.ts wires the real dependencies and
// supabase/tests/journal_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";
import { parseJournalRequest, toJournalEntry, type JournalRow } from "../_shared/journal.ts";
import { escalateChildText, type RaiseSafetyAlert } from "../_shared/safety.ts";

export interface ChildJournalStore {
  createEntry(row: {
    child_id: string;
    content: string;
    entry_type: string;
    module_key: string | null;
    is_private_note: boolean;
  }): Promise<JournalRow>;
  listEntries(childId: string, limit: number, entryType: string | null): Promise<JournalRow[]>;
}

export interface JournalDeps {
  store: ChildJournalStore;
  verifyChildToken(token: string): Promise<string | null>;
  log(event: string, detail?: string): void;
  // Raises the caregiver alert when a saved entry trips the crisis screen
  // (raise_safety_alert). Absent means no alert is raised.
  raiseSafetyAlert?: RaiseSafetyAlert;
}

// Room for a 5000-character entry in any script (up to 4 bytes per char).
export const MAX_BODY_BYTES = 24_576;

export function createJournalHandler(deps: JournalDeps) {
  return async function handle(req: Request): Promise<Response> {
    const pre = preflight(req); if (pre) return pre;
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    try {
      const declared = Number(req.headers.get("Content-Length") ?? 0);
      if (declared > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      const text = await req.text();
      if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return json({ error: "invalid_request" }, 400);
      }
      const parsed = parseJournalRequest(raw);
      if (!parsed.ok) return json({ error: parsed.error }, parsed.status);

      const childId = await deps.verifyChildToken(parsed.childSessionToken);
      if (!childId) return json({ error: "invalid_session" }, 401);

      const request = parsed.value;
      if (request.action === "list") {
        const rows = await deps.store.listEntries(childId, request.limit, request.entryType);
        return json({ entries: rows.map(toJournalEntry) });
      }

      // create
      // Private notes were removed (role flow); the database trigger refuses them too.
      if (request.isPrivateNote) return json({ error: "invalid_input" }, 400);
      const row = await deps.store.createEntry({
        child_id: childId,
        content: request.content,
        entry_type: request.entryType,
        module_key: request.moduleKey,
        is_private_note: request.isPrivateNote,
      });
      // Checked after saving, so the entry is kept whatever happens. On a
      // match the child sees the safety message and their caregivers get an
      // alert naming the journal, never the words.
      const safety = deps.raiseSafetyAlert
        ? await escalateChildText(request.content, childId, "journal_flag", deps.raiseSafetyAlert, deps.log)
        : null;
      return json({ entry: toJournalEntry(row), safety });
    } catch (e) {
      deps.log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
