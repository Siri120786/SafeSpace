// supabase/functions/_shared/reminders.ts
// Pure helpers for reminders (Sprint 3): the in-app "what's due now" rule,
// timezone conversion, request validation for the child `reminders` Edge
// Function, and row -> contract shaping. No Deno APIs (Intl only), so it runs
// under Node in supabase/tests/reminders_handler.test.mts.
//
// packages/api-client/src/reminders.ts carries an identical computeDueReminders
// for web/Flutter; supabase/tests/reminders_handler.test.mts checks they agree.
//
// Due rule (contract section 4):
//   For an enabled reminder, today's occurrence is the current LOCAL date in
//   the reminder's own timezone. It exists if that weekday is in daysOfWeek
//   (or daysOfWeek is empty) and is due once the local time reaches timeOfDay.

export interface ReminderLike {
  id: string;
  timeOfDay: string;   // "HH:MM"
  daysOfWeek: number[];
  timezone: string;    // IANA
  isEnabled: boolean;
}

export interface AckLike {
  reminderId: string;
  occursOn: string;    // "YYYY-MM-DD"
}

export interface DueOccurrence<R extends ReminderLike> {
  reminder: R;
  dueAt: string;       // ISO instant of today's occurrence
  occursOn: string;    // local date in the reminder's timezone
  acknowledged: boolean;
}

interface LocalParts { year: number; month: number; day: number; hour: number; minute: number }

function localParts(instant: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") % 24, minute: get("minute") };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// The local calendar date ("YYYY-MM-DD") of `instant` in `timeZone`.
export function localDateIn(instant: Date, timeZone: string): string {
  const p = localParts(instant, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

// The UTC instant of a local wall-clock time in `timeZone` (DST-aware).
export function zonedTimeToUtc(localDate: string, hhmm: string, timeZone: string): Date {
  const [y, mo, d] = localDate.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (t: number) => {
    const p = localParts(new Date(t), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - t;
  };
  let guess = wall - offsetAt(wall);
  const second = wall - offsetAt(guess);
  if (second !== guess) guess = second;
  return new Date(guess);
}

export function computeDueReminders<R extends ReminderLike>(
  reminders: R[],
  acknowledgements: AckLike[],
  now: Date,
): DueOccurrence<R>[] {
  const acked = new Set(acknowledgements.map((a) => `${a.reminderId}|${a.occursOn}`));
  const due: DueOccurrence<R>[] = [];
  for (const r of reminders) {
    if (!r.isEnabled || !isValidTimeZone(r.timezone)) continue;
    const p = localParts(now, r.timezone);
    const occursOn = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
    const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
    if (r.daysOfWeek.length > 0 && !r.daysOfWeek.includes(dow)) continue;
    const [h, m] = r.timeOfDay.split(":").map(Number);
    if (p.hour * 60 + p.minute < h * 60 + m) continue;
    due.push({
      reminder: r,
      dueAt: zonedTimeToUtc(occursOn, r.timeOfDay, r.timezone).toISOString(),
      occursOn,
      acknowledged: acked.has(`${r.id}|${occursOn}`),
    });
  }
  return due.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

// ---------------------------------------------------------------------------
// Request validation for the child `reminders` Edge Function
// ---------------------------------------------------------------------------
const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidLocalDate(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = LOCAL_DATE_RE.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

// Same window as the database: 7 days before to 1 day after the UTC date.
export function isWithinAckWindow(localDate: string, now: Date): boolean {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const [y, mo, d] = localDate.split("-").map(Number);
  const diff = (Date.UTC(y, mo - 1, d) - today) / 86_400_000;
  return diff >= -7 && diff <= 1;
}

export type RemindersRequest =
  | { action: "list" }
  | { action: "list_due" }
  | { action: "acknowledge"; reminderId: string; occursOn: string };

export type RemindersParse =
  | { ok: true; value: RemindersRequest; childSessionToken: string }
  | { ok: false; status: 400 | 401; error: string };

export function parseRemindersRequest(raw: unknown): RemindersParse {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, status: 400, error: "invalid_request" };
  }
  const b = raw as Record<string, unknown>;
  if (typeof b.child_session_token !== "string" || !b.child_session_token) {
    return { ok: false, status: 401, error: "invalid_session" };
  }
  const token = b.child_session_token;
  if (b.action === "list") return { ok: true, value: { action: "list" }, childSessionToken: token };
  if (b.action === "list_due") return { ok: true, value: { action: "list_due" }, childSessionToken: token };
  if (b.action === "acknowledge") {
    if (typeof b.reminder_id !== "string" || !UUID_RE.test(b.reminder_id) || !isValidLocalDate(b.occurs_on)) {
      return { ok: false, status: 400, error: "invalid_input" };
    }
    return { ok: true, value: { action: "acknowledge", reminderId: b.reminder_id, occursOn: b.occurs_on }, childSessionToken: token };
  }
  return { ok: false, status: 400, error: "invalid_action" };
}

// ---------------------------------------------------------------------------
// Row -> contract shaping
// ---------------------------------------------------------------------------
export interface ReminderRow {
  id: string;
  profile_id: string | null;
  child_id: string | null;
  kind: string;
  title: string;
  routine_id: string | null;
  time_of_day: string;
  days_of_week: number[];
  timezone: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function toReminder(r: ReminderRow) {
  return {
    id: r.id,
    profileId: r.profile_id,
    childId: r.child_id,
    kind: r.kind,
    title: r.title,
    routineId: r.routine_id,
    timeOfDay: String(r.time_of_day).slice(0, 5),
    daysOfWeek: r.days_of_week ?? [],
    timezone: r.timezone,
    isEnabled: r.is_enabled,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
