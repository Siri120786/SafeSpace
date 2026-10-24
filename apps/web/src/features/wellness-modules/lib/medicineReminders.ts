/**
 * Cycle Care: medicine and supplement reminders. Pure helpers around the shared Reminders feature
 * (packages/api-client/src/reminders.ts, docs/sprint-3/CONTRACTS.md section 4).
 *
 * Privacy: the reminder title is deliberately generic ("Time for your medicine"). Medicine names
 * are never sent to the server; the person's own notes stay on the page. Alerts are IN-APP only:
 * they show while SafeSpace is open. There is no push, SMS or email.
 */
import type { CreateReminderInput, DueReminder, Reminder } from "@safespace/shared-types";

export const MEDICINE_TITLES = ["Time for your medicine", "Time for your supplement"] as const;
export type MedicineTitle = (typeof MEDICINE_TITLES)[number];

export const REMINDER_PRIVACY_NOTE =
  "Reminders only say a generic line, like \"Time for your medicine\". The names in your notes are never sent anywhere. Alerts show while SafeSpace is open; there are no phone notifications yet.";

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type BuildResult = { ok: true; input: CreateReminderInput } | { ok: false; error: string };

export function buildMedicineReminder(title: string, time: string, days: number[], timezone: string): BuildResult {
  if (!MEDICINE_TITLES.includes(title as MedicineTitle)) return { ok: false, error: "Please pick a reminder line." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { ok: false, error: "Please choose a time." };
  if (!Array.isArray(days) || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return { ok: false, error: "Please check the days." };
  if (!timezone) return { ok: false, error: "Could not work out your time zone." };
  // An empty day list means every day.
  return { ok: true, input: { kind: "medication", title, timeOfDay: time, daysOfWeek: [...new Set(days)].sort(), timezone, isEnabled: true } };
}

export function describeSchedule(r: Pick<Reminder, "timeOfDay" | "daysOfWeek">): string {
  const days = r.daysOfWeek.length === 0 || r.daysOfWeek.length === 7 ? "every day" : r.daysOfWeek.map((d) => DAY_LABELS[d]).join(", ");
  return `${r.timeOfDay}, ${days}`;
}

/** Only medication reminders, since this screen manages those. */
export function medicationReminders(all: readonly Reminder[]): Reminder[] {
  return all.filter((r) => r.kind === "medication");
}

/** Medication alerts that are due and not yet marked done. */
export function dueMedicineAlerts(due: readonly DueReminder[]): DueReminder[] {
  return due.filter((d) => d.reminder.kind === "medication" && !d.acknowledged);
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}
