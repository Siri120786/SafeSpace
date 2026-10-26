// supabase/functions/safety-check/handler.ts
// The crisis check as an endpoint, for clients that need to know before they
// show something (e.g. the mobile app). It only answers "crisis words or not"
// and returns the fixed safety message and helplines; it never raises an
// alert, stores anything or scores the text. Alerts come only from
// emergency-escalation and the server-side hooks (_shared/safety.ts).
//
// Action:
//   check { text, child_session_token? }   adults send an Authorization header
//
// No Deno or esm.sh imports; index.ts wires the real dependencies and
// supabase/tests/safety_functions_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";
import { CRISIS_RESOURCES, adultSafetyNotice } from "../_shared/safety.ts";
import { CONTENT_MAX_LENGTH } from "../_shared/journal.ts";

export interface SafetyCheckDeps {
  verifyChildToken(token: string): Promise<string | null>;
  authenticateAdult(authorization: string): Promise<string | null>;
  log(event: string, detail?: string): void;
}

// Room for a 5000-character text in any script (up to 4 bytes per char).
export const MAX_BODY_BYTES = 24_576;

export function createSafetyCheckHandler(deps: SafetyCheckDeps) {
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
      if ((b.action ?? "check") !== "check") return json({ error: "invalid_action" }, 400);
      if (typeof b.text !== "string" || b.text.length > CONTENT_MAX_LENGTH) return json({ error: "invalid_input" }, 400);

      // Signed-in people only, so this isn't an open endpoint.
      if (b.child_session_token !== undefined) {
        if (typeof b.child_session_token !== "string" || !(await deps.verifyChildToken(b.child_session_token))) {
          return json({ error: "invalid_session" }, 401);
        }
      } else {
        const authorization = req.headers.get("Authorization") ?? "";
        if (!authorization.startsWith("Bearer ") || !(await deps.authenticateAdult(authorization))) {
          return json({ error: "invalid_session" }, 401);
        }
      }

      const notice = adultSafetyNotice(b.text);
      return json({
        crisis: notice !== null,
        safetyMessage: notice?.message ?? null,
        resources: notice ? CRISIS_RESOURCES : [],
      });
    } catch (e) {
      deps.log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
