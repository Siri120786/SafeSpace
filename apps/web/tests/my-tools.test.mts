/**
 * Shared "my tools" rules: days to tick, journal checks, who can read the
 * journal, reminders later today (role-flow 5b). Run with:
 * tsx apps/web/tests/my-tools.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import type { DueReminder, Reminder, RoutineWithSteps } from "@safespace/shared-types";
import {
  journalVisibilityNote,
  laterToday,
  recentDays,
  todaySummary,
  validateJournal,
  zonedClock,
} from "../src/features/my-tools/toolsLogic.ts";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (e) {
    console.log(`FAIL ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

test("recent days: today, yesterday, then five more, newest first", () => {
  const days = recentDays(new Date(2026, 9, 23, 10, 0));
  assert.equal(days.length, 7);
  assert.deepEqual(days.slice(0, 2), [{ date: "2026-10-23", label: "Today" }, { date: "2026-10-22", label: "Yesterday" }]);
  assert.equal(days[6].date, "2026-10-17");
});

test("recent days cross month ends correctly", () => {
  assert.equal(recentDays(new Date(2026, 10, 1, 9))[1].date, "2026-10-31");
});

test("a journal entry can't be empty or over 5000 characters", () => {
  assert.equal(validateJournal("   "), "Write something first.");
  assert.match(validateJournal("x".repeat(5001))!, /5000/);
  assert.equal(validateJournal("Today was good"), null);
});

test("a child is told who can read their journal; adults get no note", () => {
  assert.equal(journalVisibilityNote("under_15"), "Your grown-ups can read your journal.");
  assert.equal(journalVisibilityNote("not_asked"), "Your grown-ups can read your journal.");
  assert.equal(journalVisibilityNote("shared"), "Your grown-ups can read your journal.");
  assert.equal(journalVisibilityNote("not_shared"), "Only you can read your journal.");
  assert.equal(journalVisibilityNote(null), null);
});

test("zoned clock reads weekday and time in the reminder's own time zone", () => {
  const now = new Date("2026-10-23T20:30:00Z"); // Friday
  assert.deepEqual(zonedClock("UTC", now), { weekday: 5, time: "20:30" });
  assert.deepEqual(zonedClock("Asia/Kolkata", now), { weekday: 6, time: "02:00" });
});

const rem = (id: string, timeOfDay: string, over: Partial<Reminder> = {}): Reminder => ({
  id, profileId: null, childId: "c", kind: "custom", title: id, routineId: null, timeOfDay, daysOfWeek: [],
  timezone: "UTC", isEnabled: true, leadMinutes: 0, createdAt: "", updatedAt: "", ...over,
} as Reminder);

test("later today: enabled, scheduled today, after now, not already due; earliest first", () => {
  const now = new Date("2026-10-23T12:00:00Z"); // Friday
  const due = [{ reminder: rem("due", "13:00") } as DueReminder];
  const list = laterToday([
    rem("past", "09:00"),
    rem("late", "20:00"),
    rem("soon", "15:00"),
    rem("off", "16:00", { isEnabled: false }),
    rem("monday", "17:00", { daysOfWeek: [1] }),
    rem("due", "13:00"),
  ], due, now);
  assert.deepEqual(list.map((r) => r.id), ["soon", "late"]);
});

const routine = (steps: [string, string | null, boolean][]): RoutineWithSteps => ({
  id: "r", profileId: "p", childId: null, moduleKey: null, title: "Morning", daysOfWeek: [], isActive: true, createdAt: "", updatedAt: "",
  steps: steps.map(([label, time, done], i) => ({ id: `s${i}`, routineId: "r", label, scheduledTime: time, orderIndex: i, icon: null, completedOnDate: done })),
});

test("today summary: the current step, steps left and reminders due", () => {
  const due = [{ acknowledged: false }, { acknowledged: true }] as DueReminder[];
  const s = todaySummary([routine([["Stretch", "07:00", true], ["Water", null, false], ["Walk", "18:00", false]])], due, new Date(2026, 9, 23, 9));
  assert.equal(s.current?.label, "Water");
  assert.equal(s.stepsLeft, 2);
  assert.equal(s.remindersDue, 1);
  assert.equal(s.hasRoutines, true);
  assert.equal(s.allDone, false);
});

test("today summary: no routines, and all done", () => {
  assert.deepEqual(todaySummary([], [], new Date()), { current: null, stepsLeft: 0, allDone: false, hasRoutines: false, remindersDue: 0 });
  assert.equal(todaySummary([routine([["Stretch", "07:00", true]])], [], new Date(2026, 9, 23, 9)).allDone, true);
});

console.log(`${passed} my-tools checks`);
