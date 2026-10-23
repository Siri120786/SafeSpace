// supabase/functions/routines/handler.ts
// Child-facing routines (Sprint 3). Children have no Supabase login, so this
// function verifies the signed child-session token, derives the child_id, and
// reads/writes ONLY that child's routines with the service role. Children can
// view routines and tick steps; they can't create or edit routines (their
// caregiver manages them under RLS). Adults use the tables directly.
// Contract: docs/sprint-3/CONTRACTS.md section 3.
//
// Actions:
//   list                { child_session_token, date }
//   set_step_completed  { child_session_token, step_id, date, completed }
//
// No Deno or esm.sh imports here; index.ts wires the real dependencies and
// supabase/tests/routines_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import {
  isWithinCompletionWindow,
  parseRoutinesRequest,
  shapeRoutinesForDate,
  type RoutineRow,
} from "../_shared/routines.ts";
import { errorSummary } from "../_shared/errors.ts";

export interface ChildRoutinesStore {
  // All of the child's routines with steps, and each step's completions on `date`.
  listRoutines(childId: string, date: string): Promise<RoutineRow[]>;
  // True only if the step belongs to one of THIS child's routines.
  childOwnsStep(childId: string, stepId: string): Promise<boolean>;
  // Idempotent: completing twice or un-completing an open step is fine.
  setCompletion(stepId: string, date: string, completed: boolean): Promise<void>;
}

export interface RoutinesDeps {
  store: ChildRoutinesStore;
  verifyChildToken(token: string): Promise<string | null>;
  log(event: string, detail?: string): void;
  now?: () => Date;
}

export const MAX_BODY_BYTES = 4096;

export function createRoutinesHandler(deps: RoutinesDeps) {
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
      const parsed = parseRoutinesRequest(raw);
      if (!parsed.ok) return json({ error: parsed.error }, parsed.status);

      const childId = await deps.verifyChildToken(parsed.childSessionToken);
      if (!childId) return json({ error: "invalid_session" }, 401);

      const request = parsed.value;
      if (request.action === "list") {
        const rows = await deps.store.listRoutines(childId, request.date);
        return json({ routines: shapeRoutinesForDate(rows, request.date) });
      }

      // set_step_completed
      if (!isWithinCompletionWindow(request.date, now())) {
        return json({ error: "invalid_input" }, 400);
      }
      if (!(await deps.store.childOwnsStep(childId, request.stepId))) {
        return json({ error: "not_found" }, 404); // also for someone else's step
      }
      await deps.store.setCompletion(request.stepId, request.date, request.completed);
      return json({ stepId: request.stepId, date: request.date, completed: request.completed });
    } catch (e) {
      deps.log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
