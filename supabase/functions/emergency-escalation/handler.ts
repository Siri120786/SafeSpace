// supabase/functions/emergency-escalation/handler.ts
// A child's safety alert from text they wrote, for clients that don't save
// through the companion, journal or mood functions (those already escalate
// on the server). The check always runs HERE on the text itself: a client
// can't claim a crisis or skip one. On crisis words, every caregiver of the
// child gets an in-app alert naming where it came from (never the words), at
// most one per source per 30 minutes (raise_safety_alert), and the child gets
// the fixed safety message, helplines and a gentle note that their grown-up
// knows. Children only: Individuals have no linked contact to alert.
//
// Action:
//   escalate { child_session_token, source: "companion" | "journal" | "mood", text }
//
// No Deno or esm.sh imports; index.ts wires the real dependencies and
// supabase/tests/safety_functions_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";
import { CRISIS_RESOURCES, escalateChildText, type RaiseSafetyAlert, type SafetySource } from "../_shared/safety.ts";
import { CONTENT_MAX_LENGTH } from "../_shared/journal.ts";

const SOURCES: Record<string, SafetySource> = {
  companion: "companion_flag",
  journal: "journal_flag",
  mood: "check_in",
};

export interface EscalationDeps {
  verifyChildToken(token: string): Promise<string | null>;
  raiseSafetyAlert: RaiseSafetyAlert;
  log(event: string, detail?: string): void;
}

export const MAX_BODY_BYTES = 24_576;

export function createEscalationHandler(deps: EscalationDeps) {
  return async function handle(req: Request): Promise<Response> {
    const pre = preflight(req); if (pre) return pre;
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    try {
      const raw = await req.text();
      if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      let b: Record<string, unknown>;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return json({ error: "invalid_request" }, 400);
        b = parsed;
      } catch {
        return json({ error: "invalid_request" }, 400);
      }
      if ((b.action ?? "escalate") !== "escalate") return json({ error: "invalid_action" }, 400);
      if (typeof b.source !== "string" || !Object.hasOwn(SOURCES, b.source) ||
          typeof b.text !== "string" || b.text.length > CONTENT_MAX_LENGTH) {
        return json({ error: "invalid_input" }, 400);
      }
      if (typeof b.child_session_token !== "string" || !b.child_session_token) return json({ error: "invalid_session" }, 401);
      const childId = await deps.verifyChildToken(b.child_session_token);
      if (!childId) return json({ error: "invalid_session" }, 401);

      const safety = await escalateChildText(b.text, childId, SOURCES[b.source], deps.raiseSafetyAlert, deps.log);
      // Helplines are always returned on a match, whether or not the alert
      // went through: never hold crisis resources back on a notification.
      return json({
        escalated: safety?.caregiverAlerted === true,
        safety,
        resources: safety ? CRISIS_RESOURCES : [],
      });
    } catch (e) {
      deps.log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
