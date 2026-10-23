// supabase/functions/reset-child-pin/handler.ts
// A primary caregiver sets a child's new 4-digit PIN
// (docs/role-flow/CONTRACT.md section 9).
//
//   1. The caller's JWT is verified; their id comes from it, never the body.
//   2. They must be the child's PRIMARY caregiver. This is checked before any
//      PIN hash is read, so the function can't be used to probe other
//      families' PINs.
//   3. The new PIN must differ from the family's other children (otherwise
//      verify-child-pin is ambiguous). It is hashed here; the plaintext never
//      reaches the database.
//   4. reset_child_pin() stores the hash and bumps the child's session
//      version, which signs the child out everywhere.
//
// No Deno or esm.sh imports here; index.ts wires the real dependencies and
// supabase/tests/reset_child_pin_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";

export interface ResetChildPinStore {
  // The caller's role for the child, or null when they aren't its caregiver.
  roleFor(childId: string, caregiverId: string): Promise<"primary" | "co_caregiver" | null>;
  // PIN hashes of the child's siblings (same family), not the child's own.
  siblingPinHashes(childId: string): Promise<string[]>;
  resetPin(childId: string, caregiverId: string, pinHash: string): Promise<void>;
}

export interface ResetChildPinDeps {
  store: ResetChildPinStore;
  getUserId(authorization: string): Promise<string | null>;
  hashPin(pin: string): Promise<string>;
  verifyPin(pin: string, hash: string): Promise<boolean>;
  log(event: string, detail?: string): void;
}

export const MAX_BODY_BYTES = 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createResetChildPinHandler(deps: ResetChildPinDeps) {
  return async function handle(req: Request): Promise<Response> {
    const pre = preflight(req); if (pre) return pre;
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    try {
      const authorization = req.headers.get("Authorization") ?? "";
      const userId = authorization ? await deps.getUserId(authorization) : null;
      if (!userId) return json({ error: "unauthorized" }, 401);

      const text = await req.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      let body: { child_id?: unknown; pin?: unknown } = {};
      try {
        body = JSON.parse(text) ?? {};
      } catch {
        return json({ error: "invalid_request" }, 400);
      }
      const { child_id, pin } = body;
      if (typeof child_id !== "string" || !UUID_RE.test(child_id) || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
        return json({ error: "invalid_request" }, 400);
      }

      const role = await deps.store.roleFor(child_id, userId);
      if (!role) return json({ error: "not_found" }, 404);
      if (role !== "primary") return json({ error: "not_primary_caregiver" }, 403);

      for (const hash of await deps.store.siblingPinHashes(child_id)) {
        if (await deps.verifyPin(pin, hash)) return json({ error: "pin_already_used_in_family" }, 409);
      }
      await deps.store.resetPin(child_id, userId, await deps.hashPin(pin));
      return json({ ok: true });
    } catch (e) {
      const message = (e as Error)?.message ?? "";
      if (message.includes("not_primary_caregiver")) return json({ error: "not_primary_caregiver" }, 403);
      if (message.includes("not_found")) return json({ error: "not_found" }, 404);
      deps.log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
