// supabase/functions/verify-child-pin/handler.ts
// The ONLY place a PIN is ever checked. Client sends { family_code, pin };
// server finds that family's children, verifies the PIN against the stored
// hashes, and returns a signed child-session token scoped to one child_id.
//
// Rate limit: at most 5 failed attempts per family code in 15 minutes,
// enforced atomically by pin_attempt_begin (migration 20261026100000). Each
// attempt is reserved, and counted as failed, BEFORE the PIN is checked, and
// is marked succeeded only when it matches. Any store error fails closed:
// 500, no token, and the attempt stays counted.
//
// No Deno or esm.sh imports here; index.ts wires the real dependencies and
// supabase/tests/verify_child_pin_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";

export interface PinAttemptStore {
  // Reserves an attempt for the family (recorded as failed). Returns its id,
  // or null when the family already has 5 failures in the last 15 minutes.
  beginAttempt(familyCode: string): Promise<number | null>;
  // PIN hashes of the children in the family with this code; empty when no
  // caregiver has the code.
  listFamilyChildren(familyCode: string): Promise<{ id: string; pin_hash: string }[]>;
  // Marks a reserved attempt as succeeded. Throws if it can't.
  markSucceeded(attemptId: number): Promise<void>;
}

export interface VerifyChildPinDeps {
  store: PinAttemptStore;
  verifyPin(pin: string, hash: string): Promise<boolean>;
  signChildToken(childId: string): Promise<string>;
  log(event: string, detail?: string): void;
}

export const MAX_BODY_BYTES = 1024;
const FAMILY_CODE_RE = /^[A-Z0-9]{1,64}$/;

export function createVerifyChildPinHandler(deps: VerifyChildPinDeps) {
  return async function handle(req: Request): Promise<Response> {
    const pre = preflight(req); if (pre) return pre;
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    try {
      const text = await req.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      let body: { family_code?: unknown; pin?: unknown } = {};
      try {
        body = JSON.parse(text) ?? {};
      } catch {
        return json({ error: "invalid_request" }, 400);
      }
      const { family_code, pin } = body;
      if (typeof family_code !== "string" || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
        return json({ error: "invalid_request" }, 400);
      }
      const code = family_code.trim().toUpperCase();
      if (!FAMILY_CODE_RE.test(code)) return json({ error: "invalid_request" }, 400);

      const attemptId = await deps.store.beginAttempt(code);
      if (attemptId === null) return json({ error: "too_many_attempts" }, 429);

      let matchId: string | null = null;
      for (const k of await deps.store.listFamilyChildren(code)) {
        if (await deps.verifyPin(pin, k.pin_hash)) { matchId = k.id; break; }
      }
      // Same response for "unknown family" and "wrong PIN" so codes can't be
      // probed. The reserved attempt already counts as a failure.
      if (!matchId) return json({ error: "invalid_credentials" }, 401);

      await deps.store.markSucceeded(attemptId);
      return json({ child_session_token: await deps.signChildToken(matchId), child_id: matchId });
    } catch (e) {
      deps.log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
