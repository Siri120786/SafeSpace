// Pure rules for the caregiver routine and reminder builders (role-flow 4c).
// No React or network, so apps/web/tests/caregiver-builders.test.mts can check
// them. The api-client and database validate again; these give friendly
// messages before anything is sent.
import {
  REMINDER_LEAD_MAX_MINUTES,
  REMINDER_TITLE_MAX_LENGTH,
  ROUTINE_STEP_ICONS,
  type ReminderKind,
  type RoutineStepIcon,
} from "@safespace/shared-types";

export const ROUTINE_TITLE_MAX = 80;
export const STEP_LABEL_MAX = 120;
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
// Monday first, as most people read a week.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const LEAD_OPTIONS = [0, 5, 10, 15, 30, 60] as const;

export interface StepDraft {
  label: string;
  scheduledTime: string; // "" = no time
  icon: RoutineStepIcon | null;
}

export interface RoutineDraft {
  title: string;
  daysOfWeek: number[]; // empty = every day
  steps: StepDraft[];
}

export interface ReminderDraft {
  kind: ReminderKind;
  title: string;
  routineId: string | null;
  timeOfDay: string;
  daysOfWeek: number[];
  timezone: string;
  leadMinutes: number;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function daysLabel(days: number[]): string {
  if (days.length === 0 || days.length === 7) return "Every day";
  const set = new Set(days);
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  return WEEK_ORDER.filter((d) => set.has(d)).map((d) => DAY_SHORT[d]).join(", ");
}

export function toggleDay(days: number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b);
}

// The new order of step ids after moving one up (-1) or down (+1); null when it can't move.
export function moveStep(ids: string[], index: number, direction: -1 | 1): string[] | null {
  const to = index + direction;
  if (index < 0 || index >= ids.length || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export function iconEmoji(icon: RoutineStepIcon | null | undefined): string | null {
  return icon ? ROUTINE_STEP_ICONS[icon]?.emoji ?? null : null;
}

export function validateStep(step: StepDraft): string | null {
  const label = step.label.trim();
  if (!label) return "Give the step a name.";
  if (label.length > STEP_LABEL_MAX) return `Step names can be up to ${STEP_LABEL_MAX} characters.`;
  if (step.scheduledTime && !TIME_RE.test(step.scheduledTime)) return "Pick a time like 07:30.";
  return null;
}

export function validateRoutine(draft: RoutineDraft): string | null {
  const title = draft.title.trim();
  if (!title) return "Give the routine a name.";
  if (title.length > ROUTINE_TITLE_MAX) return `Routine names can be up to ${ROUTINE_TITLE_MAX} characters.`;
  if (draft.steps.length === 0) return "Add at least one step.";
  for (const [i, s] of draft.steps.entries()) {
    const e = validateStep(s);
    if (e) return `Step ${i + 1}: ${e}`;
  }
  return null;
}

export function validateReminder(draft: ReminderDraft): string | null {
  const title = draft.title.trim();
  if (!title) return "Give the reminder a name.";
  if (title.length > REMINDER_TITLE_MAX_LENGTH) return `Reminder names can be up to ${REMINDER_TITLE_MAX_LENGTH} characters.`;
  if (!TIME_RE.test(draft.timeOfDay)) return "Pick a time like 08:00.";
  if (draft.kind === "routine" && !draft.routineId) return "Choose which routine this reminds them about.";
  if (!Number.isInteger(draft.leadMinutes) || draft.leadMinutes < 0 || draft.leadMinutes > REMINDER_LEAD_MAX_MINUTES) {
    return `The heads-up can be 0 to ${REMINDER_LEAD_MAX_MINUTES} minutes.`;
  }
  if (!draft.timezone) return "Choose a time zone.";
  return null;
}

// "15 min heads-up", or null for none.
export function leadLabel(minutes: number): string | null {
  if (minutes <= 0) return null;
  return minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} h heads-up` : `${minutes} min heads-up`;
}

// The caregiver's own device time zone, the default for new reminders.
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
