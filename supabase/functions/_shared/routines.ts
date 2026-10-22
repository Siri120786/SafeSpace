// supabase/functions/_shared/routines.ts
// Pure helpers for routines (Sprint 3): local-date validation, the weekday
// schedule rule, the completion window, request validation for the child
// `routines` Edge Function, and row -> contract shaping. No Deno APIs, so it
// runs under Node in supabase/tests/routines_handler.test.mts.
//
// The schedule and window rules mirror the database (20261024000000_routines)
// and packages/api-client/src/routines.ts; the tests pin them down.

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "YYYY-MM-DD" that is a real calendar date.
export function isValidLocalDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

// 0 = Sunday ... 6 = Saturday, for a valid local date.
export function dayOfWeek(localDate: string): number {
  const [y, mo, d] = localDate.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

// Empty daysOfWeek means every day.
export function isScheduledOn(daysOfWeek: number[], localDate: string): boolean {
  return daysOfWeek.length === 0 || daysOfWeek.includes(dayOfWeek(localDate));
}

// Same window as the database trigger: from 7 days before to 1 day after the
// current UTC date (local "today" can be a day ahead of or behind UTC).
export function isWithinCompletionWindow(localDate: string, now: Date = new Date()): boolean {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const [y, mo, d] = localDate.split("-").map(Number);
  const diffDays = (Date.UTC(y, mo - 1, d) - todayUtc) / 86_400_000;
  return diffDays >= -7 && diffDays <= 1;
}

export type RoutinesRequest =
  | { action: "list"; date: string }
  | { action: "set_step_completed"; stepId: string; date: string; completed: boolean };

export type RoutinesParse =
  | { ok: true; value: RoutinesRequest; childSessionToken: string }
  | { ok: false; status: 400 | 401; error: string };

export function parseRoutinesRequest(raw: unknown): RoutinesParse {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, status: 400, error: "invalid_request" };
  }
  const b = raw as Record<string, unknown>;
  if (typeof b.child_session_token !== "string" || !b.child_session_token) {
    return { ok: false, status: 401, error: "invalid_session" };
  }
  const token = b.child_session_token;
  if (!isValidLocalDate(b.date)) return { ok: false, status: 400, error: "invalid_input" };

  if (b.action === "list") return { ok: true, value: { action: "list", date: b.date }, childSessionToken: token };

  if (b.action === "set_step_completed") {
    if (typeof b.step_id !== "string" || !UUID_RE.test(b.step_id) || typeof b.completed !== "boolean") {
      return { ok: false, status: 400, error: "invalid_input" };
    }
    return {
      ok: true,
      value: { action: "set_step_completed", stepId: b.step_id, date: b.date, completed: b.completed },
      childSessionToken: token,
    };
  }
  return { ok: false, status: 400, error: "invalid_action" };
}

// ---------------------------------------------------------------------------
// Row -> contract shaping (RoutineWithSteps in packages/shared-types)
// ---------------------------------------------------------------------------
export interface RoutineRow {
  id: string;
  profile_id: string | null;
  child_id: string | null;
  module_key: string | null;
  title: string;
  days_of_week: number[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  routine_steps: StepRow[];
}
export interface StepRow {
  id: string;
  routine_id: string;
  label: string;
  scheduled_time: string | null;
  order_index: number;
  routine_step_completions?: { completed_on: string }[];
}

// "07:30:00" -> "07:30"
export function toHHMM(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

// Active routines scheduled on `date`, steps in order, each with
// completedOnDate for that date.
export function shapeRoutinesForDate(rows: RoutineRow[], date: string) {
  return rows
    .filter((r) => r.is_active && isScheduledOn(r.days_of_week ?? [], date))
    .map((r) => ({
      id: r.id,
      profileId: r.profile_id,
      childId: r.child_id,
      moduleKey: r.module_key,
      title: r.title,
      daysOfWeek: r.days_of_week ?? [],
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      steps: [...(r.routine_steps ?? [])]
        .sort((a, b) => a.order_index - b.order_index)
        .map((s) => ({
          id: s.id,
          routineId: s.routine_id,
          label: s.label,
          scheduledTime: toHHMM(s.scheduled_time),
          orderIndex: s.order_index,
          completedOnDate: (s.routine_step_completions ?? []).some((c) => c.completed_on === date),
        })),
    }));
}
