// supabase/functions/child-settings/handler.ts
// A signed-in child's own settings (docs/role-flow/CONTRACT.md section 10).
// Verifies the child-session token and acts only on that child.
//
// Actions:
//   get          { child_session_token }
//   set_sharing  { child_session_token, share: boolean }   (15 or over only)
//
// set_sharing is the ONLY way the "share with my caregivers" choice changes;
// caregivers can't change it. No Deno or esm.sh imports here; index.ts wires
// the real dependencies and supabase/tests/child_settings_handler.test.mts
// wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";
import { CAREGIVER_VISIBILITY_AGE, childAgeYears, childSharingStatus } from "../_shared/childSharing.ts";

export interface ChildSettingsRow {
  birth_year: number;
  birth_month: number;
  shares_with_caregiver: boolean | null;
  sharing_decided_at: string | null;
}

export interface ChildSettingsStore {
  getChild(childId: string): Promise<ChildSettingsRow | null>;
  // Calls set_child_sharing(); throws its errors (sharing_not_available_under_15).
  setSharing(childId: string, share: boolean): Promise<void>;
}

export interface ChildSettingsDeps {
  store: ChildSettingsStore;
  verifyChildToken(token: string): Promise<string | null>;
  log(event: string, detail?: string): void;
  now?: () => Date;
}

export const MAX_BODY_BYTES = 2048;

function toSettings(row: ChildSettingsRow, now: Date) {
  const ageYears = childAgeYears(row.birth_year, row.birth_month, now);
  return {
    ageYears,
    sharing: childSharingStatus(ageYears, row.shares_with_caregiver),
    canChangeSharing: ageYears >= CAREGIVER_VISIBILITY_AGE,
    sharingDecidedAt: row.sharing_decided_at,
  };
}

export function createChildSettingsHandler(deps: ChildSettingsDeps) {
  const now = deps.now ?? (() => new Date());
  return async function handle(req: Request): Promise<Response> {
    const pre = preflight(req); if (pre) return pre;
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    try {
      const text = await req.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      let body: { action?: unknown; child_session_token?: unknown; share?: unknown };
      try {
        body = JSON.parse(text) ?? {};
      } catch {
        return json({ error: "invalid_request" }, 400);
      }
      if (body.action !== "get" && body.action !== "set_sharing") return json({ error: "invalid_action" }, 400);
      if (typeof body.child_session_token !== "string" || !body.child_session_token) {
        return json({ error: "invalid_session" }, 401);
      }
      if (body.action === "set_sharing" && typeof body.share !== "boolean") {
        return json({ error: "invalid_input" }, 400);
      }

      const childId = await deps.verifyChildToken(body.child_session_token);
      if (!childId) return json({ error: "invalid_session" }, 401);

      const row = await deps.store.getChild(childId);
      if (!row) return json({ error: "not_found" }, 404);

      if (body.action === "get") return json({ settings: toSettings(row, now()) });

      // set_sharing: refuse under 15 here for a clear error; the database refuses too.
      if (childAgeYears(row.birth_year, row.birth_month, now()) < CAREGIVER_VISIBILITY_AGE) {
        return json({ error: "sharing_not_available_under_15" }, 400);
      }
      await deps.store.setSharing(childId, body.share as boolean);
      const updated = await deps.store.getChild(childId);
      return json({ settings: toSettings(updated ?? row, now()) });
    } catch (e) {
      if ((e as Error)?.message?.includes("sharing_not_available_under_15")) {
        return json({ error: "sharing_not_available_under_15" }, 400);
      }
      deps.log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
