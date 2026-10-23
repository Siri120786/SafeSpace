// supabase/functions/child-alerts/handler.ts
// The talk board's "I need help" (docs/role-flow/CONTRACT.md section 7).
// Verifies the child's session and raises an alert that every caregiver of
// the child sees, whatever the sharing choice. A second tap within 2 minutes
// returns the same alert. In-app only: nobody is emailed or texted.
//
// Actions:
//   raise_help { child_session_token }
//
// No Deno or esm.sh imports here; index.ts wires the real dependencies and
// supabase/tests/child_alerts_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";

export interface ChildAlertsStore {
  // raise_help_alert(): returns the alert id (an existing one within 2 minutes).
  raiseHelp(childId: string): Promise<string>;
}

export interface ChildAlertsDeps {
  store: ChildAlertsStore;
  verifyChildToken(token: string): Promise<string | null>;
  log(event: string, detail?: string): void;
}

export const MAX_BODY_BYTES = 1024;

export function createChildAlertsHandler(deps: ChildAlertsDeps) {
  return async function handle(req: Request): Promise<Response> {
    const pre = preflight(req); if (pre) return pre;
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    try {
      const text = await req.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      let body: { action?: unknown; child_session_token?: unknown };
      try {
        body = JSON.parse(text) ?? {};
      } catch {
        return json({ error: "invalid_request" }, 400);
      }
      if (body.action !== "raise_help") return json({ error: "invalid_action" }, 400);
      if (typeof body.child_session_token !== "string" || !body.child_session_token) {
        return json({ error: "invalid_session" }, 401);
      }
      const childId = await deps.verifyChildToken(body.child_session_token);
      if (!childId) return json({ error: "invalid_session" }, 401);

      const alertId = await deps.store.raiseHelp(childId);
      return json({ alertId });
    } catch (e) {
      deps.log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
