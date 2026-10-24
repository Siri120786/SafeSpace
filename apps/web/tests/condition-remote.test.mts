/**
 * The ADHD and autism tools saving to the person's account (role-flow 8e):
 * the database-backed services behind Manju's factories, with a fake API,
 * and the child-only limits on screen.
 * Run with: tsx apps/web/tests/condition-remote.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RemoteFocusStatsService,
  RemoteHabitService,
  RemoteRewardService,
  RemoteTaskService,
  createFocusStatsService,
  createHabitService,
  LocalHabitService,
} from "../src/features/conditions/adhd/services/index.ts";
import { RewardsProgress } from "../src/features/conditions/adhd/components/RewardsProgress.tsx";
import {
  RemoteAacService,
  RemoteEmotionCardsService,
  RemoteTransitionService,
  createEmotionCardsService,
} from "../src/features/conditions/autism/services/index.ts";
import { EmotionCards } from "../src/features/conditions/autism/components/EmotionCards.tsx";
import { setToolsSession, getToolsSession } from "../src/features/conditions/toolsSession.ts";
import { isCloudSaving } from "../src/features/wellness-ui/store/LocalDeviceStore.ts";
import { DeviceOnlyNote } from "../src/features/wellness-ui/DeviceOnlyNote.tsx";

let passed = 0;
const tests: [string, () => void | Promise<void>][] = [];
const test = (name: string, fn: () => void | Promise<void>) => tests.push([name, fn]);

const ADULT: any = { kind: "auth_user", profile: { id: "p1" } };
const CHILD: any = { kind: "child", childSessionToken: "t", childId: "c1" };

function fakeApi() {
  const calls: [string, ...any[]][] = [];
  const state = {
    checks: [{ habitId: "h1", day: "2026-10-24" }] as { habitId: string; day: string }[],
    habits: [
      { id: "h1", title: "Water", icon: "💧", isArchived: false, createdAt: "2026-10-01T00:00:00Z" },
      { id: "h2", title: "Old", icon: null, isArchived: true, createdAt: "2026-10-01T00:00:00Z" },
    ],
    goal: null as any,
    choices: [
      { id: "e3", cardId: "calm", createdAt: "2026-10-24T10:03:00Z" },
      { id: "e2", cardId: "sad", createdAt: "2026-10-24T10:02:00Z" },
      { id: "e1", cardId: "calm", createdAt: "2026-10-24T10:01:00Z" },
    ],
    settings: { transitionPreset: null as any, aacLabels: { play: "Lego" } as Record<string, string> },
  };
  const api: any = {
    addFocusSession: async (_s: any, input: any) => (calls.push(["addFocusSession", input]),
      { id: "f1", endedAt: "2026-10-24T10:00:00Z", ...input, phase: input.phase, activityLabel: input.activityLabel }),
    listFocusSessions: async () => [
      { id: "f1", endedAt: new Date().toISOString(), durationSeconds: 1500, mode: "pomodoro", phase: "focus", completed: true, activityLabel: null },
    ],
    clearMyFocusSessions: async () => calls.push(["clearMyFocusSessions"]),
    listFocusTasks: async () => [],
    createFocusTask: async (_s: any, title: string, steps: any[]) => (calls.push(["createFocusTask", title, steps]),
      { id: "t1", title, steps, isArchived: false, createdAt: "2026-10-24T10:00:00Z", updatedAt: "" }),
    updateFocusTask: async (_s: any, t: any) => (calls.push(["updateFocusTask", t]), { ...t, createdAt: "2026-10-24T10:00:00Z", updatedAt: "" }),
    deleteFocusTask: async () => undefined,
    listHabits: async () => ({ habits: state.habits, checks: state.checks }),
    addHabit: async (_s: any, title: string, icon: string) => ({ id: "h3", title, icon, isArchived: false, createdAt: "2026-10-24T10:00:00Z" }),
    archiveHabit: async (_s: any, id: string) => calls.push(["archiveHabit", id]),
    setHabitCheck: async (_s: any, habitId: string, day: string, checked: boolean) => {
      calls.push(["setHabitCheck", habitId, day, checked]);
      state.checks = checked ? [...state.checks, { habitId, day }] : state.checks.filter((c) => !(c.habitId === habitId && c.day === day));
    },
    getStars: async () => ({ currentStars: 4, lifetimeStars: 9, goal: state.goal }),
    awardStars: async (_s: any, key: string, stars: number) => (calls.push(["awardStars", key, stars]), { awarded: true, currentStars: 5, lifetimeStars: 10 }),
    claimStarGoal: async () => ({ claimed: false, currentStars: 4 }),
    setMyStarGoal: async (_s: any, goal: any) => { calls.push(["setMyStarGoal", goal]); state.goal = goal; },
    listEmotionChoices: async () => state.choices,
    addEmotionChoice: async (_s: any, cardId: string) => ({ id: "e9", cardId, createdAt: "2026-10-24T11:00:00Z" }),
    clearMyEmotionChoices: async () => calls.push(["clearMyEmotionChoices"]),
    getToolSettings: async () => state.settings,
    saveMyToolSettings: async (_s: any, s: any) => calls.push(["saveMyToolSettings", s]),
  };
  return { api, calls, state };
}

test("focus sessions: saved with a sensible length; stats worked out from the account", async () => {
  const { api, calls } = fakeApi();
  const svc = new RemoteFocusStatsService(ADULT, api);
  const rec = await svc.recordSession({ durationSeconds: 0.2, mode: "simple", completed: true });
  assert.equal(calls[0][1].durationSeconds, 1);
  assert.equal(typeof rec.timestamp, "number");
  assert.equal(rec.phase, undefined);
  const summary = await svc.getStatsSummary();
  assert.equal(summary.sessionsToday, 1);
  assert.equal(summary.focusMinutesToday, 25);
});

test("tasks: new steps from labels; completedAt goes as null when not set", async () => {
  const { api, calls } = fakeApi();
  const svc = new RemoteTaskService(CHILD, api);
  const t = await svc.createTask("Homework", ["  Open book ", "", "Read"]);
  assert.deepEqual(t.steps.map((s) => s.label), ["Open book", "Read"]);
  assert.ok(t.steps.every((s) => s.id.length <= 64 && !s.isComplete));
  await svc.updateTask({ ...t, steps: [{ ...t.steps[0], isComplete: true }] });
  assert.equal(calls.at(-1)![1].steps[0].completedAt, null);
  assert.equal(calls.at(-1)![1].isArchived, false);
});

test("habits: removed ones are archived and not listed; a tick reads the current state first", async () => {
  const { api, calls } = fakeApi();
  const svc = new RemoteHabitService(CHILD, api);
  assert.deepEqual((await svc.listHabits()).map((h) => h.title), ["Water"]);
  const off = await svc.toggleDay("h1", "2026-10-24");
  assert.equal(off.isNowChecked, false);
  assert.deepEqual(calls.at(-1), ["setHabitCheck", "h1", "2026-10-24", false]);
  // A brand-new service (as every render makes) still sees the change.
  const on = await new RemoteHabitService(CHILD, api).toggleDay("h1", "2026-10-24");
  assert.equal(on.isNowChecked, true);
  assert.equal(on.updatedLog.h1["2026-10-24"], true);
  await svc.removeHabit("h1");
  assert.deepEqual(calls.at(-1), ["archiveHabit", "h1"]);
});

test("stars: Manju's event keys; no goal shows the default (as the database claims); adults set theirs", async () => {
  const { api, calls } = fakeApi();
  const svc = new RemoteRewardService(ADULT, api);
  const r = await svc.awardStars("habit_day", "h1", "2026-10-24");
  assert.deepEqual(calls[0], ["awardStars", "habit_day:h1:2026-10-24", 1]);
  assert.equal(r.wasAwarded, true);
  const s = await svc.getState();
  assert.equal(s.goal.targetStars, 10);
  assert.equal(s.currentStars, 4);
  await svc.setGoal({ targetStars: 6 });
  assert.equal(calls.at(-1)![1].targetStars, 6);
  assert.equal((await svc.getState()).goal.targetStars, 6);
  await assert.rejects(() => svc.reset());
});

test("feelings: newest first, one per card, labels from the cards; adults can clear", async () => {
  const { api, calls } = fakeApi();
  const svc = new RemoteEmotionCardsService(ADULT, api);
  const recent = await svc.getRecentSelections();
  assert.deepEqual(recent.map((r) => r.cardId), ["calm", "sad"]);
  assert.ok(recent[0].label && recent[0].emoji && recent[0].selectedAt === "2026-10-24T10:03:00Z");
  await svc.clearRecentSelections();
  assert.deepEqual(calls.at(-1), ["clearMyEmotionChoices"]);
});

test("countdown and sentence words: a child's preset isn't saved (a caregiver sets it); an adult's is, within limits", async () => {
  const child = fakeApi();
  await new RemoteTransitionService(CHILD, child.api).saveConfig({ activity: "Bath", totalSeconds: 120 });
  assert.equal(child.calls.length, 0);
  const adult = fakeApi();
  const t = new RemoteTransitionService(ADULT, adult.api);
  assert.equal((await t.getSavedConfig()).activity, "Quiet Reading");
  await t.saveConfig({ activity: "  Lunch ", totalSeconds: 99999 });
  assert.deepEqual(adult.calls.at(-1)![1].transitionPreset, { activity: "Lunch", totalSeconds: 3600 });
  assert.deepEqual((await new RemoteAacService(ADULT, adult.api).getConfig()).customLabels, { play: "Lego" });
});

test("the factories save to the account while someone is signed in, else this device", () => {
  setToolsSession(null);
  assert.ok(createHabitService() instanceof LocalHabitService);
  assert.equal(isCloudSaving(), false);
  setToolsSession(CHILD);
  assert.ok(createHabitService() instanceof RemoteHabitService);
  assert.ok(createFocusStatsService() instanceof RemoteFocusStatsService);
  assert.ok(createEmotionCardsService() instanceof RemoteEmotionCardsService);
  assert.equal(getToolsSession(), CHILD);
  assert.equal(isCloudSaving(), true);
});

test("'Saved on this device only' disappears once saving to the account", () => {
  setToolsSession(null);
  assert.match(renderToStaticMarkup(React.createElement(DeviceOnlyNote, { compact: true })), /this device/);
  setToolsSession(ADULT);
  assert.equal(renderToStaticMarkup(React.createElement(DeviceOnlyNote, { compact: true })), "");
});

test("on screen: a child gets the real 'I want a grown-up' and no Clear; an Individual has no grown-up button", () => {
  setToolsSession(CHILD);
  const child = renderToStaticMarkup(React.createElement(EmotionCards, { grownUp: { raise: async () => "a1" }, canClearHistory: false }));
  assert.match(child, /I want a grown-up/);
  assert.match(child, /Tell my grown-up I want them/);
  setToolsSession(ADULT);
  const adult = renderToStaticMarkup(React.createElement(EmotionCards, { grownUp: "hidden" }));
  assert.doesNotMatch(adult, /I want a grown-up/);
  const plain = renderToStaticMarkup(React.createElement(EmotionCards));
  assert.match(plain, /Show helpful note about asking a grown-up/);
});

test("on screen: a child can't change their star goal", () => {
  setToolsSession(CHILD);
  const child = renderToStaticMarkup(React.createElement(RewardsProgress, { canEditGoal: false }));
  assert.doesNotMatch(child, /Change Goal/);
  assert.match(child, /Your grown-up chooses your goal/);
  assert.match(renderToStaticMarkup(React.createElement(RewardsProgress)), /Change Goal/);
  setToolsSession(null);
});

for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (e) {
    console.log(`FAIL ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}
console.log(`${passed} condition-remote checks`);
