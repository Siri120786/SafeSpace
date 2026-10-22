// supabase/functions/reminders/handler.ts
// Child-facing reminders (Sprint 3, in-app delivery). Verifies the signed
// child-session token, derives the child_id, and reads/acknowledges ONLY that
// child's reminders with the service role. Children can't create or edit
// reminders (their caregiver manages them under RLS).
// Contract: docs/sprint-3/CONTRACTS.md section 4.
//
// Actions:
//   list         { child_session_token }
//   list_due     { child_session_token }                   (server clock)
//   acknowledge  { child_session_token, reminder_id, occurs_on }
//
// No Deno or esm.sh imports; index.ts wires the real dependencies and
// supabase/tests/reminders_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";
import {
  computeDueReminders,
  isWithinAckWindow,
  parseRemindersRequest,
  toReminder,
  type ReminderRow,
} from "../_shared/reminders.ts";

export interface ChildRemindersStore {
  listReminders(childId: string): Promise<ReminderRow[]>;
  // Acknowledgements of these reminders for dates in [fromDate, toDate].
  listAcknowledgements(reminderIds: string[], fromDate: string, toDate: string): Promise<{ reminder_id: string; occurs_on: string }[]>;
  childOwnsReminder(childId: string, reminderId: string): Promise<boolean>;
  // Idempotent.
  acknowledge(reminderId: string, occursOn: string): Promise<void>;
}

export interface RemindersDeps {
  store: ChildRemindersStore;
  verifyChildToken(token: string): Promise<string | null>;
  log(event: string, detail?: string): void;
  now?: () => Date;
}

export const MAX_BODY_BYTES = 2048;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function createRemindersHandler(deps: RemindersDeps) {
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
      const parsed = parseRemindersRequest(raw);
      if (!parsed.ok) return json({ error: parsed.error }, parsed.status);

      const childId = await deps.verifyChildToken(parsed.childSessionToken);
      if (!childId) return json({ error: "invalid_session" }, 401);

      const request = parsed.value;
      if (request.action === "list") {
        const rows = await deps.store.listReminders(childId);
        return json({ reminders: rows.map(toReminder) });
      }

      if (request.action === "list_due") {
        const at = now();
        const rows = await deps.store.listReminders(childId);
        const reminders = rows.map(toReminder);
        // Local "today" can be a day either side of the UTC date.
        const from = isoDate(new Date(at.getTime() - 86_400_000));
        const to = isoDate(new Date(at.getTime() + 86_400_000));
        const acks = reminders.length
          ? await deps.store.listAcknowledgements(reminders.map((r) => r.id), from, to)
          : [];
        const due = computeDueReminders(
          reminders,
          acks.map((a) => ({ reminderId: a.reminder_id, occursOn: a.occurs_on })),
          at,
        );
        return json({ due });
      }

      // acknowledge
      if (!isWithinAckWindow(request.occursOn, now())) return json({ error: "invalid_input" }, 400);
      if (!(await deps.store.childOwnsReminder(childId, request.reminderId))) {
        return json({ error: "not_found" }, 404); // also for another child's reminder
      }
      await deps.store.acknowledge(request.reminderId, request.occursOn);
      return json({ reminderId: request.reminderId, occursOn: request.occursOn, acknowledged: true });
    } catch (e) {
      deps.log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
