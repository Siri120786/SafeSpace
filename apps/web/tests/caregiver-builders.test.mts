/**
 * Caregiver routine and reminder builder rules (role-flow 4c). Run with:
 * tsx apps/web/tests/caregiver-builders.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import {
  daysLabel,
  deviceTimeZone,
  iconEmoji,
  leadLabel,
  moveStep,
  toggleDay,
  validateReminder,
  validateRoutine,
  validateStep,
  type ReminderDraft,
} from "../src/features/caregiver/builders.ts";

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

test("days read as every day, weekdays, weekends, or a Monday-first list", () => {
  assert.equal(daysLabel([]), "Every day");
  assert.equal(daysLabel([0, 1, 2, 3, 4, 5, 6]), "Every day");
  assert.equal(daysLabel([1, 2, 3, 4, 5]), "Weekdays");
  assert.equal(daysLabel([6, 0]), "Weekends");
  assert.equal(daysLabel([0, 3, 1]), "Mon, Wed, Sun");
});

test("toggling a day adds or removes it, kept sorted", () => {
  assert.deepEqual(toggleDay([1, 5], 3), [1, 3, 5]);
  assert.deepEqual(toggleDay([1, 3, 5], 3), [1, 5]);
});

test("moving a step swaps it with its neighbour, never past the ends", () => {
  assert.deepEqual(moveStep(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
  assert.deepEqual(moveStep(["a", "b", "c"], 1, 1), ["a", "c", "b"]);
  assert.equal(moveStep(["a", "b"], 0, -1), null);
  assert.equal(moveStep(["a", "b"], 1, 1), null);
});

test("icons map to an emoji; none is null", () => {
  assert.equal(iconEmoji("brush_teeth"), "🪥");
  assert.equal(iconEmoji(null), null);
});

test("a step needs a name; the time is optional but must be HH:MM", () => {
  assert.equal(validateStep({ label: "  ", scheduledTime: "", icon: null }), "Give the step a name.");
  assert.equal(validateStep({ label: "Teeth", scheduledTime: "", icon: null }), null);
  assert.equal(validateStep({ label: "Teeth", scheduledTime: "7:30", icon: null }), "Pick a time like 07:30.");
  assert.match(validateStep({ label: "x".repeat(121), scheduledTime: "", icon: null })!, /120/);
});

test("a routine needs a name and at least one valid step; errors say which step", () => {
  assert.equal(validateRoutine({ title: "", daysOfWeek: [], steps: [] }), "Give the routine a name.");
  assert.equal(validateRoutine({ title: "Morning", daysOfWeek: [], steps: [] }), "Add at least one step.");
  assert.equal(
    validateRoutine({ title: "Morning", daysOfWeek: [], steps: [{ label: "a", scheduledTime: "", icon: null }, { label: "", scheduledTime: "", icon: null }] }),
    "Step 2: Give the step a name.",
  );
  assert.equal(validateRoutine({ title: "Morning", daysOfWeek: [1], steps: [{ label: "a", scheduledTime: "07:00", icon: "wake" }] }), null);
});

const reminder = (over: Partial<ReminderDraft> = {}): ReminderDraft => ({
  kind: "water", title: "Water", routineId: null, timeOfDay: "08:00", daysOfWeek: [], timezone: "Asia/Kolkata", leadMinutes: 0, ...over,
});

test("a reminder needs a name, a HH:MM time and a time zone", () => {
  assert.equal(validateReminder(reminder()), null);
  assert.equal(validateReminder(reminder({ title: " " })), "Give the reminder a name.");
  assert.equal(validateReminder(reminder({ timeOfDay: "8am" })), "Pick a time like 08:00.");
  assert.equal(validateReminder(reminder({ timezone: "" })), "Choose a time zone.");
});

test("a routine reminder must name its routine", () => {
  assert.equal(validateReminder(reminder({ kind: "routine" })), "Choose which routine this reminds them about.");
  assert.equal(validateReminder(reminder({ kind: "routine", routineId: "r1" })), null);
});

test("the heads-up is 0 to 120 minutes and reads naturally", () => {
  assert.match(validateReminder(reminder({ leadMinutes: 121 }))!, /0 to 120/);
  assert.equal(leadLabel(0), null);
  assert.equal(leadLabel(15), "15 min heads-up");
  assert.equal(leadLabel(60), "1 h heads-up");
});

test("new reminders default to this device's time zone", () => {
  assert.ok(deviceTimeZone().length > 0);
});

console.log(`${passed} caregiver-builder checks`);
