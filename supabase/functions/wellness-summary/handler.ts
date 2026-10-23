// supabase/functions/wellness-summary/handler.ts
// Child-facing wellness summary (Sprint 3). Verifies the signed child-session
// token, derives the child_id, and returns that child's own WellnessSummary
// (counts only) from the wellness_summary database function. Adults and
// caregivers call the function directly under their own RLS.
// Contract: docs/sprint-3/CONTRACTS.md section 5.
//
// Action:
//   get { child_session_token, period_days: 7 | 30, to: "YYYY-MM-DD", timezone: IANA }
//
// No Deno or esm.sh imports; index.ts wires the real dependencies and
// supabase/tests/wellness_summary_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";
import { isValidLocalDate } from "../_shared/routines.ts";

export interface WellnessStore {
  // Calls wellness_summary for the child. Throws Error("invalid_input") for
  // inputs the database rejects (e.g. an unknown timezone).
  summaryForChild(childId: string, to: string, periodDays: 7 | 30, timezone: string): Promise<unknown>;
}

export interface WellnessDeps {
  store: WellnessStore;
  verifyChildToken(token: string): Promise<string | null>;
  log(event: string, detail?: string): void;
}

export const MAX_BODY_BYTES = 2048;
const TIMEZONE_RE = /^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/;

export function createWellnessSummaryHandler(deps: WellnessDeps) {
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
      if (typeof b.child_session_token !== "string" || !b.child_session_token) {
        return json({ error: "invalid_session" }, 401);
      }
      if ((b.action ?? "get") !== "get") return json({ error: "invalid_action" }, 400);
      if ((b.period_days !== 7 && b.period_days !== 30) || !isValidLocalDate(b.to) ||
          typeof b.timezone !== "string" || !TIMEZONE_RE.test(b.timezone)) {
        return json({ error: "invalid_input" }, 400);
      }

      const childId = await deps.verifyChildToken(b.child_session_token);
      if (!childId) return json({ error: "invalid_session" }, 401);

      try {
        const summary = await deps.store.summaryForChild(childId, b.to, b.period_days, b.timezone);
        return json({ summary });
      } catch (e) {
        if ((e as Error)?.message === "invalid_input") return json({ error: "invalid_input" }, 400);
        throw e;
      }
    } catch (e) {
      deps.log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
