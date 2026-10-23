// supabase/functions/create-child/handler.ts
// Caregiver-authenticated. The ONLY way to add a child (clients have no
// INSERT on children or child_modules; migration 20261026200000).
//
//   1. The caller's JWT is verified; the caregiver id comes from it, never
//      from the request body.
//   2. The caller must be a caregiver.
//   3. Fields are validated; unknown module keys are dropped.
//   4. The PIN must differ from the family's other children (otherwise
//      verify-child-pin is ambiguous). Hashed server-side; the plaintext PIN
//      never reaches the database.
//   5. create_child() inserts the child and modules in one transaction and
//      derives privacy_tier from age.
//
// No Deno or esm.sh imports here; index.ts wires the real dependencies and
// supabase/tests/create_child_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";

export const VALID_MODULES = ["autism", "adhd", "anxiety", "depression", "ptsd", "pcos_pcod"];
export const MAX_BODY_BYTES = 2048;
export const NAME_MAX_LENGTH = 80;

// Errors create_child() raises on purpose; anything else is a 500.
export class CreateChildRejected extends Error {
  constructor(readonly reason: "not_a_caregiver" | "invalid_input") {
    super(reason);
  }
}

export interface CreateChildStore {
  isCaregiver(userId: string): Promise<boolean>;
  // pin_hash of every child of THIS caregiver.
  listSiblingPinHashes(caregiverId: string): Promise<string[]>;
  createChild(input: {
    caregiverId: string;
    name: string;
    age: number;
    pinHash: string;
    modules: string[];
  }): Promise<string>;
}

export interface CreateChildDeps {
  store: CreateChildStore;
  // Verified user id for the request's Authorization header, or null.
  getUserId(authorization: string): Promise<string | null>;
  hashPin(pin: string): Promise<string>;
  verifyPin(pin: string, hash: string): Promise<boolean>;
  log(event: string, detail?: string): void;
}

export function createCreateChildHandler(deps: CreateChildDeps) {
  return async function handle(req: Request): Promise<Response> {
    const pre = preflight(req); if (pre) return pre;
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    try {
      const authorization = req.headers.get("Authorization") ?? "";
      const userId = authorization ? await deps.getUserId(authorization) : null;
      if (!userId) return json({ error: "unauthorized" }, 401);

      const text = await req.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      let body: { name?: unknown; age?: unknown; pin?: unknown; modules?: unknown } = {};
      try {
        body = JSON.parse(text) ?? {};
      } catch {
        return json({ error: "invalid_request" }, 400);
      }
      const { name, age, pin, modules } = body;
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (!trimmed || trimmed.length > NAME_MAX_LENGTH ||
          typeof age !== "number" || !Number.isInteger(age) || age < 4 || age > 17 ||
          typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
        return json({ error: "invalid_request" }, 400);
      }
      const mods = Array.isArray(modules)
        ? [...new Set(modules.filter((m): m is string => typeof m === "string" && VALID_MODULES.includes(m)))]
        : [];

      if (!(await deps.store.isCaregiver(userId))) return json({ error: "not_a_caregiver" }, 403);

      for (const hash of await deps.store.listSiblingPinHashes(userId)) {
        if (await deps.verifyPin(pin, hash)) return json({ error: "pin_already_used_in_family" }, 409);
      }

      const childId = await deps.store.createChild({
        caregiverId: userId,
        name: trimmed,
        age,
        pinHash: await deps.hashPin(pin),
        modules: mods,
      });
      return json({ child_id: childId });
    } catch (e) {
      if (e instanceof CreateChildRejected) {
        return e.reason === "not_a_caregiver"
          ? json({ error: "not_a_caregiver" }, 403)
          : json({ error: "invalid_request" }, 400);
      }
      deps.log("unhandled_exception", errorSummary(e));
      return json({ error: "create_failed" }, 500);
    }
  };
}
