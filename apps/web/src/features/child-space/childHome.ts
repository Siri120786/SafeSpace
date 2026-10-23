// Pure rules for the child's space (docs/role-flow/CONTRACT.md sections 3 and
// 10, P1 and P2). No React or network, so apps/web/tests/child-home.test.mts
// can check them.
import type { ChildSettings, DueReminder, RoutineStepIcon, RoutineWithSteps } from "@safespace/shared-types";

export interface DayStep {
  stepId: string;
  routineId: string;
  routineTitle: string;
  label: string;
  icon: RoutineStepIcon | null;
  time: string | null;      // the step's own "HH:MM", if any
  effectiveTime: string;    // its time, or the time of the step before it in the routine
  done: boolean;
}

export interface NowNext {
  now: DayStep | null;
  next: DayStep | null;
  allDone: boolean;   // there were steps today and every one is ticked
  steps: DayStep[];   // today's steps in time order
}

// "HH:MM" in local time.
export function clockTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// "YYYY-MM-DD" in local time.
export function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Today's steps in time order. A step without a time follows the step before
// it in the same routine (or the start of the day), so routine order is kept.
export function dayPlan(routines: RoutineWithSteps[]): DayStep[] {
  const rows: (DayStep & { r: number; o: number })[] = [];
  routines.forEach((routine, r) => {
    let carried = "00:00";
    routine.steps.forEach((s, o) => {
      if (s.scheduledTime) carried = s.scheduledTime;
      rows.push({
        stepId: s.id,
        routineId: routine.id,
        routineTitle: routine.title,
        label: s.label,
        icon: s.icon ?? null,
        time: s.scheduledTime,
        effectiveTime: carried,
        done: s.completedOnDate,
        r,
        o,
      });
    });
  });
  rows.sort((a, b) => a.effectiveTime.localeCompare(b.effectiveTime) || a.r - b.r || a.o - b.o);
  return rows.map(({ r: _r, o: _o, ...step }) => step);
}

// Now: the first unticked step whose time has come (or that has no time).
// Next: the unticked step after it; if nothing is due yet, the first one coming up.
export function nowNext(routines: RoutineWithSteps[], now: Date): NowNext {
  const steps = dayPlan(routines);
  const t = clockTime(now);
  const open = steps.filter((s) => !s.done);
  const nowIdx = open.findIndex((s) => s.effectiveTime <= t);
  const current = nowIdx === -1 ? null : open[nowIdx];
  const next = current ? open[nowIdx + 1] ?? null : open[0] ?? null;
  return { now: current, next, allDone: steps.length > 0 && open.length === 0, steps };
}

// Ask the 15+ question once, before home, until they answer (contract section 10).
export function needsSharingQuestion(settings: Pick<ChildSettings, "sharing" | "canChangeSharing"> | null): boolean {
  return !!settings && settings.canChangeSharing && settings.sharing === "not_asked";
}

// Errors meaning the child's session is over (signed out elsewhere, PIN reset).
const ENDED = new Set(["invalid_session", "unauthorized", "unsupported_session"]);
export function isSessionEnded(err: unknown): boolean {
  return err instanceof Error && ENDED.has(err.message);
}

// Reminders still to do, earliest first.
export function openReminders(due: DueReminder[]): DueReminder[] {
  return due.filter((d) => !d.acknowledged).sort((a, b) => a.occursAt.localeCompare(b.occursAt));
}

// "Now" once its time has come; during a heads-up, "In 5 minutes".
export function reminderWhen(d: Pick<DueReminder, "occursAt">, now: Date): string {
  const mins = Math.ceil((new Date(d.occursAt).getTime() - now.getTime()) / 60_000);
  if (mins <= 0) return "Now";
  return mins === 1 ? "In 1 minute" : `In ${mins} minutes`;
}

// The caregiver's low-sensory default, unless the child changed it on this device.
export function effectiveLowSensory(caregiverDefault: boolean, deviceChoice: boolean | null): boolean {
  return deviceChoice ?? caregiverDefault;
}
