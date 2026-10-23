// Pure rules for the "my tools" screens shared by children and Individuals:
// routines, journal and reminders (role-flow 5b, reused in step 7). No React
// or network, so apps/web/tests/my-tools.test.mts can check them.
import {
  JOURNAL_CONTENT_MAX_LENGTH,
  type ChildSharingStatus,
  type DueReminder,
  type Reminder,
  type RoutineWithSteps,
} from "@safespace/shared-types";
import { nowNext, type DayStep } from "../child-space/childHome";

// The last `count` local days, newest first: completions can be ticked up to 6 days back.
export function recentDays(now: Date, count = 7): { date: string; label: string }[] {
  const p = (n: number) => String(n).padStart(2, "0");
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const label = i === 0 ? "Today" : i === 1 ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
    return { date, label };
  });
}

export function validateJournal(content: string): string | null {
  const t = content.trim();
  if (!t) return "Write something first.";
  if (t.length > JOURNAL_CONTENT_MAX_LENGTH) return `That's a bit long: up to ${JOURNAL_CONTENT_MAX_LENGTH} characters.`;
  return null;
}

// For a child: who can read what they write (contract section 5). Null for adults.
export function journalVisibilityNote(sharing: ChildSharingStatus | null): string | null {
  if (!sharing) return null;
  return sharing === "not_shared"
    ? "Only you can read your journal."
    : "Your grown-ups can read your journal.";
}

// Weekday (0 = Sunday) and "HH:MM" right now in an IANA time zone.
export function zonedClock(timeZone: string, now: Date): { weekday: number; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(now);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { weekday, time: `${get("hour")}:${get("minute")}` };
}

// Reminders still to come later today (in each reminder's own time zone),
// not yet due or in their heads-up, earliest first.
export function laterToday(reminders: Reminder[], due: DueReminder[], now: Date): Reminder[] {
  const dueIds = new Set(due.map((d) => d.reminder.id));
  return reminders
    .filter((r) => {
      if (!r.isEnabled || dueIds.has(r.id)) return false;
      const { weekday, time } = zonedClock(r.timezone, now);
      const today = r.daysOfWeek.length === 0 || r.daysOfWeek.includes(weekday);
      return today && r.timeOfDay > time;
    })
    .sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));
}

export interface TodaySummary {
  current: DayStep | null;  // the step to do now (same rule as the child's Now card)
  stepsLeft: number;
  allDone: boolean;
  hasRoutines: boolean;
  remindersDue: number;     // due now or in their heads-up, not yet done
}

// One line of "today" for the Individual dashboard card.
export function todaySummary(routines: RoutineWithSteps[], due: DueReminder[], now: Date): TodaySummary {
  const plan = nowNext(routines, now);
  return {
    current: plan.now,
    stepsLeft: plan.steps.filter((s) => !s.done).length,
    allDone: plan.allDone,
    hasRoutines: plan.steps.length > 0,
    remindersDue: due.filter((d) => !d.acknowledged).length,
  };
}
