/**
 * The ADHD and autism tools: who sees which first (role-flow 8c).
 * Run with: tsx apps/web/tests/condition-tools.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import {
  CONDITION_TOOLS,
  childToolPath,
  findConditionTool,
  individualToolPath,
  scheduleFromRoutines,
  splitConditionTools,
} from "../src/features/conditions/conditionTools.ts";

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

const keys = (list: { key: string }[]) => list.map((t) => t.key).join(",");

test("ADHD puts Focus Zone first; the autism tools go under More tools", () => {
  const { mine, more } = splitConditionTools(["adhd"]);
  assert.equal(keys(mine), "focus");
  assert.equal(keys(more), "schedule,feelings,countdown");
});

test("autism puts Schedule, Feelings and Countdown first", () => {
  const { mine, more } = splitConditionTools(["autism", "anxiety"]);
  assert.equal(keys(mine), "schedule,feelings,countdown");
  assert.equal(keys(more), "focus");
});

test("both modules: everything is theirs; neither: everything is under More tools", () => {
  assert.equal(splitConditionTools(["adhd", "autism"]).more.length, 0);
  const none = splitConditionTools(["pcos_pcod"]);
  assert.equal(none.mine.length, 0);
  assert.equal(none.more.length, CONDITION_TOOLS.length);
  assert.equal(splitConditionTools([]).more.length, CONDITION_TOOLS.length);
});

test("nothing is ever hidden: mine + more is always every tool, once", () => {
  for (const m of [[], ["adhd"], ["autism"], ["adhd", "autism"], ["depression"]] as const) {
    const { mine, more } = splitConditionTools([...m]);
    assert.equal([...mine, ...more].map((t) => t.key).sort().join(), CONDITION_TOOLS.map((t) => t.key).sort().join());
  }
});

test("paths and lookups", () => {
  assert.equal(childToolPath("focus"), "/child/tools/focus");
  assert.equal(individualToolPath("countdown"), "/tools/countdown");
  assert.equal(findConditionTool("feelings")?.module, "autism");
  assert.equal(findConditionTool("nope"), null);
  assert.equal(findConditionTool(undefined), null);
});

const routine = (id: string, title: string, steps: [string, string | null, boolean, any?][]) => ({
  id, title, profileId: null, childId: "c1", moduleKey: null, daysOfWeek: [], isActive: true, createdAt: "", updatedAt: "",
  steps: steps.map(([label, time, done, icon], i) => ({
    id: `${id}-${i}`, routineId: id, label, scheduledTime: time, orderIndex: i, icon: icon ?? null, completedOnDate: done,
  })),
}) as any;

test("the schedule shows today's routine steps in time order, ticks and icons included", () => {
  const steps = scheduleFromRoutines([
    routine("eve", "Evening", [["Bath", "19:00", false, "bath"], ["Story", null, false]]),
    routine("morn", "Morning", [["Wake up", "07:00", true, "wake"], ["Brush teeth", null, false, "brush_teeth"]]),
  ]);
  assert.deepEqual(steps.map((s) => s.label), ["Wake up", "Brush teeth", "Bath", "Story"]);
  assert.deepEqual(steps.map((s) => s.isComplete), [true, false, false, false]);
  assert.deepEqual(steps.map((s) => s.orderIndex), [0, 1, 2, 3]);
  assert.equal(steps[0].icon, "⏰");
  assert.equal(steps[3].icon, undefined);
  assert.equal(steps[0].timeEstimate, "07:00");
  assert.equal(steps[1].timeEstimate, undefined);
  assert.equal(steps[1].id, "morn-1");
  assert.deepEqual(scheduleFromRoutines([]), []);
});

console.log(`${passed} condition-tools checks`);
