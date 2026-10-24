/**
 * The ADHD and autism tools from a caregiver's side (role-flow 8f): the
 * "Focus and feelings" card and the choices on a child's Tools page.
 * Run with: tsx apps/web/tests/caregiver-tools.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import {
  RENAMEABLE_WORDS,
  focusWeek,
  goalProgress,
  habitWeek,
  hasAnyToolActivity,
  openTasks,
  recentFeelings,
  validGoal,
  wordLabelsToSave,
} from "../src/features/conditions/caregiverTools.ts";

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

// Saturday 24 Oct 2026, mid-afternoon local time.
const NOW = new Date(2026, 9, 24, 15, 0).getTime();
const at = (daysAgo: number, hour = 10) => new Date(2026, 9, 24 - daysAgo, hour).toISOString();
const session = (daysAgo: number, minutes: number, completed = true) =>
  ({ id: `s${daysAgo}${minutes}`, endedAt: at(daysAgo), durationSeconds: minutes * 60, mode: "simple" as const, phase: null, completed, activityLabel: null });

test("focus this week: sessions, minutes and the day streak (unfinished ones don't count)", () => {
  const w = focusWeek({ sessions: [session(0, 25), session(0, 10, false), session(1, 15), session(2, 5), session(10, 25)] }, NOW);
  assert.deepEqual(w, { sessions: 3, minutes: 45, streakDays: 3 });
  assert.deepEqual(focusWeek({ sessions: [] }, NOW), { sessions: 0, minutes: 0, streakDays: 0 });
});

test("open tasks: unfinished only, newest first, up to three, with steps done", () => {
  const step = (done: boolean) => ({ id: Math.random().toString(36), label: "x", isComplete: done, orderIndex: 0 });
  const task = (id: string, steps: boolean[], archived = false) =>
    ({ id, title: id, steps: steps.map(step), isArchived: archived, createdAt: "", updatedAt: "" });
  const list = openTasks([task("a", [true, false, false]), task("done", [true, true]), task("b", []), task("old", [false], true), task("c", [false]), task("d", [false])]);
  assert.deepEqual(list.map((t) => `${t.title} ${t.done}/${t.total}`), ["a 1/3", "b 0/0", "c 0/1"]);
});

test("habits: each habit's last seven days, oldest first, ticks where they happened", () => {
  const habits = [
    { id: "h1", title: "Water", icon: "💧", isArchived: false, createdAt: "" },
    { id: "h2", title: "Gone", icon: null, isArchived: true, createdAt: "" },
  ];
  const week = habitWeek(habits, [{ habitId: "h1", day: "2026-10-24" }, { habitId: "h1", day: "2026-10-20" }, { habitId: "h1", day: "2026-10-01" }], NOW);
  assert.equal(week.length, 1);
  assert.equal(week[0].days.length, 7);
  assert.equal(week[0].days[6].dateKey, "2026-10-24");
  assert.deepEqual(week[0].days.map((d) => d.ticked), [false, false, true, false, false, false, true]);
});

test("stars: progress to the goal (capped at 100%); no goal shows the default", () => {
  const set = goalProgress({ currentStars: 3, lifetimeStars: 9, goal: { title: "Park trip", targetStars: 4, icon: "🛝" } });
  assert.deepEqual([set.title, set.current, set.target, set.percent, set.isDefault], ["Park trip", 3, 4, 75, false]);
  assert.equal(goalProgress({ currentStars: 9, lifetimeStars: 9, goal: { title: "x", targetStars: 4, icon: null } }).percent, 100);
  const none = goalProgress({ currentStars: 2, lifetimeStars: 2, goal: null });
  assert.equal(none.target, 10);
  assert.equal(none.isDefault, true);
});

test("feelings: the latest five, with each card's label and emoji", () => {
  const choices = ["overwhelmed", "calm", "sad", "proud", "happy", "tired"].map((cardId, i) => ({ id: `e${i}`, cardId, createdAt: at(i) }));
  const recent = recentFeelings(choices);
  assert.equal(recent.length, 5);
  assert.equal(recent[0].emoji.length > 0 && recent[0].label !== "overwhelmed", true);
  assert.equal(recent.find((r) => r.id === "e1")?.label, "Calm");
});

test("anything to show: false only when the child hasn't used the tools", () => {
  const empty = { sessions: [], tasks: [], habits: [], checks: [], feelings: [], stars: { currentStars: 0, lifetimeStars: 0, goal: null } };
  assert.equal(hasAnyToolActivity(empty), false);
  assert.equal(hasAnyToolActivity({ ...empty, stars: { currentStars: 0, lifetimeStars: 3, goal: null } }), true);
});

test("talk-board words: never 'help'; only real changes are saved, trimmed to 30", () => {
  assert.ok(!RENAMEABLE_WORDS.some((w) => w.id === "help"));
  const play = RENAMEABLE_WORDS.find((w) => w.id === "play")!;
  const saved = wordLabelsToSave({ play: "  Lego  ", hungry: "", yes: "Yes", thirsty: "x".repeat(40), help: "Call mum", nonsense: "x" });
  assert.deepEqual(Object.keys(saved).sort(), ["play", "thirsty"]);
  assert.equal(saved.play, "Lego");
  assert.equal(saved.thirsty.length, 30);
  assert.notEqual(play.label, "Lego");
});

test("a goal needs a name and 1 to 100 stars", () => {
  assert.equal(validGoal("Park trip", 5), null);
  assert.ok(validGoal("  ", 5));
  assert.ok(validGoal("x".repeat(61), 5));
  assert.ok(validGoal("Park", 0));
  assert.ok(validGoal("Park", 101));
  assert.ok(validGoal("Park", 2.5));
});

console.log(`${passed} caregiver-tools checks`);
