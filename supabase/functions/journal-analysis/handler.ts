// supabase/functions/journal-analysis/handler.ts
// Rule-based journal insights (last 30 days). The rules live in
// ../_shared/journalAnalysis.ts; no AI, no new keys, nothing stored.
//
// Who can ask, and about whose journal:
//   - a child (signed child session): their own entries, private notes included
//   - an adult (Supabase Auth JWT): their own entries
//   - a caregiver (JWT + child_id): that child's entries, read under the
//     caregiver's own RLS, so the child's sharing choice applies and private
//     notes are never included. A child that isn't theirs reads as no entries.
//
// Action:
//   get { child_session_token?, child_id?, timezone: IANA }
//
// No Deno or esm.sh imports; index.ts wires the real dependencies and
// supabase/tests/journal_analysis_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";
import { analyzeJournal, PERIOD_DAYS, type EntryRow, type Viewer } from "../_shared/journalAnalysis.ts";

export type Reader =
  | { kind: "child"; childId: string }
  | { kind: "adult_own"; profileId: string; authorization: string }
  | { kind: "caregiver_child"; childId: string; authorization: string };

export interface JournalAnalysisStore {
  // Entries created at or after `since`, newest first.
  entries(reader: Reader, since: string): Promise<EntryRow[]>;
}

export interface JournalAnalysisDeps {
  store: JournalAnalysisStore;
  verifyChildToken(token: string): Promise<string | null>;
  authenticateAdult(authorization: string): Promise<string | null>;
  log(event: string, detail?: string): void;
  now?: () => Date;
}

export const MAX_BODY_BYTES = 2048;
const TIMEZONE_RE = /^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validTimezone(tz: string): boolean {
  if (!TIMEZONE_RE.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function createJournalAnalysisHandler(deps: JournalAnalysisDeps) {
  const now = deps.now ?? (() => new Date());
  return async function handle(req: Request): Promise<Response> {
    const pre = preflight(req); if (pre) return pre;
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    try {
      const text = await req.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return json({ error: "invalid_request" }, 400);
      }
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return json({ error: "invalid_request" }, 400);
      const b = raw as Record<string, unknown>;
      if ((b.action ?? "get") !== "get") return json({ error: "invalid_action" }, 400);
      if (typeof b.timezone !== "string" || !validTimezone(b.timezone)) return json({ error: "invalid_input" }, 400);
      if (b.child_id !== undefined && (typeof b.child_id !== "string" || !UUID_RE.test(b.child_id))) {
        return json({ error: "invalid_input" }, 400);
      }

      let reader: Reader;
      let viewer: Viewer;
      if (b.child_session_token !== undefined) {
        if (typeof b.child_session_token !== "string" || !b.child_session_token) return json({ error: "invalid_session" }, 401);
        const childId = await deps.verifyChildToken(b.child_session_token);
        if (!childId) return json({ error: "invalid_session" }, 401);
        // A child only ever reads their own journal; any child_id is ignored.
        reader = { kind: "child", childId };
        viewer = "writer";
      } else {
        const authorization = req.headers.get("Authorization") ?? "";
        const profileId = authorization.startsWith("Bearer ") ? await deps.authenticateAdult(authorization) : null;
        if (!profileId) return json({ error: "invalid_session" }, 401);
        if (typeof b.child_id === "string") {
          reader = { kind: "caregiver_child", childId: b.child_id, authorization };
          viewer = "caregiver";
        } else {
          reader = { kind: "adult_own", profileId, authorization };
          viewer = "writer";
        }
      }

      const at = now();
      const since = new Date(at.getTime() - PERIOD_DAYS * 86_400_000).toISOString();
      const rows = await deps.store.entries(reader, since);
      return json({ insights: analyzeJournal(rows, { viewer, timezone: b.timezone, now: at }) });
    } catch (e) {
      deps.log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
