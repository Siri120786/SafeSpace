/**
 * The child's space: Now / Next, the sharing question, session end, reminders,
 * low-sensory (role-flow 5a). Run with:
 * tsx apps/web/tests/child-home.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import type { RoutineWithSteps } from "@safespace/shared-types";
import {
  childModuleKeys,
  clockTime,
  dayPlan,
  effectiveLowSensory,
  isSessionEnded,
  localDate,
  needsSharingQuestion,
  nowNext,
  openReminders,
  reminderWhen,
} from "../src/features/child-space/childHome.ts";
import { CHILD_THEME_LOOKS, childThemeLook, contrastRatio } from "../src/features/child-space/childThemes.ts";
import { CHILD_THEMES } from "@safespace/shared-types";

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

const routine = (id: string, steps: [string, string | null, boolean][]): RoutineWithSteps => ({
  id, profileId: null, childId: "c", moduleKey: null, title: id, daysOfWeek: [], isActive: true, createdAt: "", updatedAt: "",
  steps: steps.map(([label, time, done], i) => ({
    id: `${id}-${i}`, routineId: id, label, scheduledTime: time, orderIndex: i, icon: null, completedOnDate: done,
  })),
});
const at = (hhmm: string) => new Date(`2026-10-23T${hhmm}:00`);

const morning = routine("Morning", [["Wake up", "07:00", false], ["Teeth", null, false], ["Breakfast", "07:30", false]]);
const evening = routine("Evening", [["Bath", "19:00", false], ["Bed", "20:00", false]]);

test("untimed steps stay after the step before them; routines merge by time", () => {
  const plan = dayPlan([evening, morning]).map((s) => s.label);
  assert.deepEqual(plan, ["Wake up", "Teeth", "Breakfast", "Bath", "Bed"]);
  assert.equal(dayPlan([morning])[1].effectiveTime, "07:00");
});

test("before anything is due: no Now, Next is the first step", () => {
  const r = nowNext([morning, evening], at("06:30"));
  assert.equal(r.now, null);
  assert.equal(r.next?.label, "Wake up");
});

test("Now is the first unticked step whose time has come; Next follows it", () => {
  const r = nowNext([morning, evening], at("07:10"));
  assert.equal(r.now?.label, "Wake up");
  assert.equal(r.next?.label, "Teeth");
});

test("ticked steps are skipped", () => {
  const m = routine("Morning", [["Wake up", "07:00", true], ["Teeth", null, true], ["Breakfast", "07:30", false]]);
  const r = nowNext([m, evening], at("12:00"));
  assert.equal(r.now?.label, "Breakfast");
  assert.equal(r.next?.label, "Bath");
});

test("a missed step stays Now until it is ticked", () => {
  const r = nowNext([morning], at("21:00"));
  assert.equal(r.now?.label, "Wake up");
});

test("all done only when there were steps and every one is ticked", () => {
  const done = routine("Morning", [["Wake up", "07:00", true]]);
  assert.equal(nowNext([done], at("08:00")).allDone, true);
  assert.equal(nowNext([], at("08:00")).allDone, false);
  assert.equal(nowNext([], at("08:00")).next, null);
});

test("an untimed step with nothing before it is due from the start of the day", () => {
  const r = nowNext([routine("Any", [["Read", null, false]])], at("00:30"));
  assert.equal(r.now?.label, "Read");
});

test("the sharing question shows only at 15+ before they've answered", () => {
  assert.equal(needsSharingQuestion({ sharing: "not_asked", canChangeSharing: true }), true);
  assert.equal(needsSharingQuestion({ sharing: "shared", canChangeSharing: true }), false);
  assert.equal(needsSharingQuestion({ sharing: "not_shared", canChangeSharing: true }), false);
  assert.equal(needsSharingQuestion({ sharing: "under_15", canChangeSharing: false }), false);
  assert.equal(needsSharingQuestion(null), false);
});

test("session-ended errors are told apart from other failures", () => {
  assert.equal(isSessionEnded(new Error("invalid_session")), true);
  assert.equal(isSessionEnded(new Error("unauthorized")), true);
  assert.equal(isSessionEnded(new Error("internal_error")), false);
  assert.equal(isSessionEnded("invalid_session"), false);
});

test("open reminders exclude done ones, earliest first", () => {
  const d = (id: string, occursAt: string, acknowledged: boolean) =>
    ({ reminder: { id } as any, dueAt: occursAt, occursAt, occursOn: "2026-10-23", acknowledged });
  const list = openReminders([d("b", "2026-10-23T09:00:00Z", false), d("a", "2026-10-23T08:00:00Z", false), d("c", "2026-10-23T07:00:00Z", true)]);
  assert.deepEqual(list.map((x) => x.reminder.id), ["a", "b"]);
});

test("a heads-up says how long until the time; at or after it, Now", () => {
  const now = new Date("2026-10-23T08:50:00Z");
  assert.equal(reminderWhen({ occursAt: "2026-10-23T09:00:00Z" }, now), "In 10 minutes");
  assert.equal(reminderWhen({ occursAt: "2026-10-23T08:51:00Z" }, now), "In 1 minute");
  assert.equal(reminderWhen({ occursAt: "2026-10-23T08:40:00Z" }, now), "Now");
});

test("low-sensory: the child's own choice on this device wins over the default", () => {
  assert.equal(effectiveLowSensory(true, null), true);
  assert.equal(effectiveLowSensory(true, false), false);
  assert.equal(effectiveLowSensory(false, true), true);
});

test("local date and clock time", () => {
  const d = new Date(2026, 0, 5, 7, 4);
  assert.equal(localDate(d), "2026-01-05");
  assert.equal(clockTime(d), "07:04");
});

test("a child's spaces: only assigned modules with a child screen, never Cycle Care", () => {
  assert.deepEqual(childModuleKeys(["anxiety", "autism", "pcos_pcod", "ptsd"]), ["anxiety", "ptsd"]);
  assert.deepEqual(childModuleKeys(["pcos_pcod"]), []);
  assert.deepEqual(childModuleKeys([]), []);
});

test("themes (8d): every theme has a look; none, or low-sensory, gives the calm look", () => {
  assert.deepEqual(Object.keys(CHILD_THEME_LOOKS).sort(), [...CHILD_THEMES].sort());
  assert.ok(["calm", "animals", "nature"].every((t) => (CHILD_THEMES as readonly string[]).includes(t)));
  assert.equal(childThemeLook("space", false), CHILD_THEME_LOOKS.space);
  assert.equal(childThemeLook("space", true), CHILD_THEME_LOOKS.calm);
  assert.equal(childThemeLook(null, false), CHILD_THEME_LOOKS.calm);
});

test("themes stay readable: titles and body text meet WCAG AA on every background", () => {
  const TEXT = "#1C2826"; // charcoal, the child space's text colour
  for (const [name, look] of Object.entries(CHILD_THEME_LOOKS)) {
    assert.ok(contrastRatio(look.accent, look.background) >= 4.5, `${name} title ${contrastRatio(look.accent, look.background).toFixed(2)}`);
    assert.ok(contrastRatio(TEXT, look.background) >= 7, `${name} text ${contrastRatio(TEXT, look.background).toFixed(2)}`);
  }
  assert.ok(Math.abs(contrastRatio("#000000", "#FFFFFF") - 21) < 0.01);
});

console.log(`${passed} child-home checks`);
