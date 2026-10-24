/**
 * SafeSpace ADHD Focus Zone Test Suite
 * Sprint 3 Workstream B
 *
 * Verifies:
 * - Pure Focus Timer state machine (all transitions: start, pause, resume, reset, stop without penalty, tick)
 * - Pure Pomodoro cycle state machine (all transitions: focus -> shortBreak -> focus, long break after 4 cycles, skip, reset)
 * - Date-based drift correction calculation
 * - Formatting and coarse announcement helpers
 * - FocusStatsService aggregation & LocalDeviceStore persistence
 * - Component static markup rendering (FocusTimer, PomodoroTimer, FocusStats, AdhdFocusZone)
 */

import assert from "node:assert/strict";
import { setDeviceStoreOwner } from "../src/features/wellness-ui/store/LocalDeviceStore.ts";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  advancePomodoroPhase,
  calculateRemainingFromDrift,
  clampPomodoroConfig,
  formatTime,
  getCoarseTimerAnnouncement,
  getPhaseDurationSeconds,
  initFocusTimer,
  initPomodoro,
  pauseFocusTimer,
  pausePomodoro,
  resetFocusTimer,
  resetPomodoro,
  resumeFocusTimer,
  resumePomodoro,
  skipPomodoroPhase,
  startFocusTimer,
  startPomodoro,
  stopFocusTimerWithoutPenalty,
  tickFocusTimer,
  tickPomodoro,
} from "../src/features/conditions/adhd/lib/timerLogic";
import {
  FocusStatsService,
  LocalFocusStatsService,
  aggregateFocusStats,
} from "../src/features/conditions/adhd/services/focusStatsService";
import { LocalTaskService } from "../src/features/conditions/adhd/services/taskService";
import { LocalHabitService } from "../src/features/conditions/adhd/services/habitService";
import { LocalRewardService } from "../src/features/conditions/adhd/services/rewardService";
import {
  addTaskStep,
  calculateTaskProgress,
  createNewTaskItem,
  editTaskStep,
  removeTaskStep,
  reorderTaskSteps,
  toggleTaskStep,
} from "../src/features/conditions/adhd/lib/taskLogic";
import {
  calculateHabitWeeklyRate,
  getPast7Days,
  isHabitChecked,
  toggleHabitLog,
} from "../src/features/conditions/adhd/lib/habitLogic";
import {
  awardStarsIdempotent,
  buildRewardEventKey,
  calculateGoalProgress,
  redeemGoal,
  updateGoal,
} from "../src/features/conditions/adhd/lib/rewardLogic";
import type {
  FocusSessionRecord,
  HabitLog,
  PomodoroConfig,
  RewardState,
  TaskStep,
} from "../src/features/conditions/adhd/types";
import { FocusTimer } from "../src/features/conditions/adhd/components/FocusTimer";
import { PomodoroTimer } from "../src/features/conditions/adhd/components/PomodoroTimer";
import { FocusStats } from "../src/features/conditions/adhd/components/FocusStats";
import { TaskBreakdown } from "../src/features/conditions/adhd/components/TaskBreakdown";
import { HabitTracker } from "../src/features/conditions/adhd/components/HabitTracker";
import { RewardsProgress } from "../src/features/conditions/adhd/components/RewardsProgress";
import { AdhdFocusZone } from "../src/features/conditions/adhd/components/AdhdFocusZone";

// ─── Environment Setup ─────────────────────────────────────────────────────────

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const mockStorage = new MemoryStorage();

// Minimal window stub
const originalWindow = (globalThis as unknown as { window?: unknown }).window;
// Tool data belongs to the signed-in person (role-flow 8b).
setDeviceStoreOwner("p:test-user");
(globalThis as unknown as { window?: unknown }).window = {
  localStorage: mockStorage,
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  setInterval: (fn: () => void) => 1,
  clearInterval: () => {},
};

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL ${name}`);
    throw err;
  }
}

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

// ─── Test Runner ──────────────────────────────────────────────────────────────

async function runAll() {
  console.log("\nStarting ADHD Focus Zone tests...\n");

  try {
    // 1. Focus Timer: Initial State
    await test("FocusTimer: initFocusTimer initializes idle state with safe bounds", () => {
      const state = initFocusTimer(1500, "Math Homework");
      assert.equal(state.durationSeconds, 1500);
      assert.equal(state.remainingSeconds, 1500);
      assert.equal(state.status, "idle");
      assert.equal(state.activityLabel, "Math Homework");

      // Clamps invalid durations
      const zero = initFocusTimer(0);
      assert.equal(zero.durationSeconds, 1);
      assert.equal(zero.remainingSeconds, 1);
      assert.equal(zero.status, "idle");
    });

    // 2. Focus Timer: Transitions
    await test("FocusTimer: start, pause, resume lifecycle", () => {
      let state = initFocusTimer(300);
      assert.equal(state.status, "idle");

      state = startFocusTimer(state);
      assert.equal(state.status, "running");

      state = pauseFocusTimer(state);
      assert.equal(state.status, "paused");

      state = resumeFocusTimer(state);
      assert.equal(state.status, "running");
    });

    // 3. Focus Timer: Tick & Completion
    await test("FocusTimer: tick decrements time and completes at zero", () => {
      let state = initFocusTimer(10);
      state = startFocusTimer(state);

      state = tickFocusTimer(state, 4);
      assert.equal(state.remainingSeconds, 6);
      assert.equal(state.status, "running");

      // Overshoot tick clamps cleanly to 0
      state = tickFocusTimer(state, 10);
      assert.equal(state.remainingSeconds, 0);
      assert.equal(state.status, "completed");

      // Starting from completed resets remaining
      state = startFocusTimer(state);
      assert.equal(state.remainingSeconds, 10);
      assert.equal(state.status, "running");
    });

    // 4. Focus Timer: Reset & Stop Without Penalty
    await test("FocusTimer: reset mid-phase and stop without penalty", () => {
      let state = initFocusTimer(900);
      state = startFocusTimer(state);
      state = tickFocusTimer(state, 100);
      assert.equal(state.remainingSeconds, 800);

      // Stop without penalty
      state = stopFocusTimerWithoutPenalty(state);
      assert.equal(state.status, "idle");
      assert.equal(state.remainingSeconds, 900);

      // Reset with new duration
      state = resetFocusTimer(state, 600);
      assert.equal(state.durationSeconds, 600);
      assert.equal(state.remainingSeconds, 600);
      assert.equal(state.status, "idle");
    });

    // 5. Pomodoro: Config Clamping
    await test("Pomodoro: clampPomodoroConfig enforces safe ranges", () => {
      const clamped = clampPomodoroConfig({
        focusMinutes: 120, // max 60
        shortBreakMinutes: -5, // min 1
        longBreakMinutes: 1, // min 5
        cyclesBeforeLongBreak: 20, // max 10
      });
      assert.equal(clamped.focusMinutes, 60);
      assert.equal(clamped.shortBreakMinutes, 1);
      assert.equal(clamped.longBreakMinutes, 5);
      assert.equal(clamped.cyclesBeforeLongBreak, 10);
    });

    // 6. Pomodoro: Initial State
    await test("Pomodoro: initPomodoro initializes cycle 1 focus phase", () => {
      const state = initPomodoro({ focusMinutes: 25, shortBreakMinutes: 5 });
      assert.equal(state.currentPhase, "focus");
      assert.equal(state.currentCycle, 1);
      assert.equal(state.completedCycles, 0);
      assert.equal(state.phaseDurationSeconds, 1500);
      assert.equal(state.remainingSeconds, 1500);
      assert.equal(state.status, "idle");
    });

    // 7. Pomodoro: Start, Pause, Resume, Tick
    await test("Pomodoro: start, pause, resume, and tick to phaseCompleted", () => {
      let state = initPomodoro({ focusMinutes: 1 });
      state = startPomodoro(state);
      assert.equal(state.status, "running");

      state = pausePomodoro(state);
      assert.equal(state.status, "paused");

      state = resumePomodoro(state);
      assert.equal(state.status, "running");

      // Tick to completion
      state = tickPomodoro(state, 60);
      assert.equal(state.remainingSeconds, 0);
      assert.equal(state.status, "phaseCompleted");
    });

    // 8. Pomodoro: Cycle Progression (Focus -> Short Break -> Focus)
    await test("Pomodoro: standard cycle progression through short breaks", () => {
      let state = initPomodoro({
        focusMinutes: 20,
        shortBreakMinutes: 5,
        cyclesBeforeLongBreak: 4,
      });

      // Complete focus cycle 1
      state = advancePomodoroPhase(state);
      assert.equal(state.currentPhase, "shortBreak");
      assert.equal(state.currentCycle, 1);
      assert.equal(state.completedCycles, 1);
      assert.equal(state.phaseDurationSeconds, 300);
      assert.equal(state.remainingSeconds, 300);

      // Complete short break 1 -> transition to focus cycle 2
      state = advancePomodoroPhase(state);
      assert.equal(state.currentPhase, "focus");
      assert.equal(state.currentCycle, 2);
      assert.equal(state.completedCycles, 1);
      assert.equal(state.phaseDurationSeconds, 1200);
    });

    // 9. Pomodoro: Long Break Trigger after 4 Cycles
    await test("Pomodoro: triggers long break after configured 4 cycles", () => {
      let state = initPomodoro({
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        cyclesBeforeLongBreak: 4,
      });

      // Cycle 1: Focus -> Short Break
      state = advancePomodoroPhase(state); // shortBreak (completed: 1)
      state = advancePomodoroPhase(state); // focus (cycle 2)

      // Cycle 2: Focus -> Short Break
      state = advancePomodoroPhase(state); // shortBreak (completed: 2)
      state = advancePomodoroPhase(state); // focus (cycle 3)

      // Cycle 3: Focus -> Short Break
      state = advancePomodoroPhase(state); // shortBreak (completed: 3)
      state = advancePomodoroPhase(state); // focus (cycle 4)

      assert.equal(state.currentCycle, 4);
      assert.equal(state.currentPhase, "focus");

      // Cycle 4: Focus completes -> Must trigger Long Break!
      state = advancePomodoroPhase(state);
      assert.equal(state.currentPhase, "longBreak");
      assert.equal(state.completedCycles, 4);
      assert.equal(state.phaseDurationSeconds, 900); // 15 mins
      assert.equal(state.remainingSeconds, 900);

      // Completing Long Break resets back to Cycle 1 Focus!
      state = advancePomodoroPhase(state);
      assert.equal(state.currentPhase, "focus");
      assert.equal(state.currentCycle, 1);
    });

    // 10. Pomodoro: Skip Phase & Reset Mid-Phase
    await test("Pomodoro: skip phase and reset mid-phase", () => {
      let state = initPomodoro({ cyclesBeforeLongBreak: 4 });
      state = startPomodoro(state);
      state = tickPomodoro(state, 50);

      // Skip phase mid-way
      state = skipPomodoroPhase(state);
      assert.equal(state.currentPhase, "shortBreak");
      assert.equal(state.completedCycles, 1);

      // Reset mid-phase
      state = resetPomodoro(state);
      assert.equal(state.currentPhase, "focus");
      assert.equal(state.currentCycle, 1);
      assert.equal(state.completedCycles, 0);
      assert.equal(state.status, "idle");
    });

    // 11. Drift Correction Function
    await test("Drift Correction: calculateRemainingFromDrift computes accurate seconds without drift", () => {
      const now = 1000000;
      const targetEnd = now + 65 * 1000; // 65 seconds in future

      // Exactly on target
      assert.equal(calculateRemainingFromDrift(targetEnd, now), 65);

      // 30 seconds have elapsed
      assert.equal(calculateRemainingFromDrift(targetEnd, now + 30000), 35);

      // Fractional milliseconds rounds up safely
      assert.equal(calculateRemainingFromDrift(targetEnd, now + 30200), 35);

      // Past target clamps to zero
      assert.equal(calculateRemainingFromDrift(targetEnd, now + 70000), 0);
    });

    // 12. Display Formatters & Coarse Announcements
    await test("Formatters: formatTime and coarse announcement fire at key moments only", () => {
      const f1 = formatTime(1500);
      assert.equal(f1.digital, "25:00");
      assert.equal(f1.verbal, "25 minutes remaining");

      const f2 = formatTime(65);
      assert.equal(f2.digital, "1:05");
      assert.equal(f2.verbal, "1 minute and 5 seconds remaining");

      const f3 = formatTime(40);
      assert.equal(f3.digital, "0:40");
      assert.equal(f3.verbal, "40 seconds remaining");

      // Coarse announcements: only start, 60s, and 0s
      assert.ok(getCoarseTimerAnnouncement(300, 300, "Focus")?.includes("started"));
      assert.ok(getCoarseTimerAnnouncement(60, 300, "Focus")?.includes("One minute remaining"));
      assert.ok(getCoarseTimerAnnouncement(0, 300, "Focus")?.includes("complete"));
      assert.equal(getCoarseTimerAnnouncement(120, 300, "Focus"), null);
      assert.equal(getCoarseTimerAnnouncement(299, 300, "Focus"), null);
    });

    // 13. Focus Stats Aggregation
    await test("Stats: aggregateFocusStats calculates sessions today, this week, and streak", () => {
      const fixedNow = new Date("2026-10-22T14:00:00Z").getTime();
      const oneHourAgo = fixedNow - 3600 * 1000;
      const yesterday = fixedNow - 24 * 3600 * 1000;
      const twoDaysAgo = fixedNow - 2 * 24 * 3600 * 1000;
      const tenDaysAgo = fixedNow - 10 * 24 * 3600 * 1000;

      const sessions: FocusSessionRecord[] = [
        {
          id: "s1",
          timestamp: oneHourAgo,
          durationSeconds: 1500, // 25 mins
          mode: "simple",
          completed: true,
        },
        {
          id: "s2",
          timestamp: yesterday,
          durationSeconds: 1500, // 25 mins
          mode: "pomodoro",
          completed: true,
        },
        {
          id: "s3",
          timestamp: twoDaysAgo,
          durationSeconds: 600, // 10 mins
          mode: "simple",
          completed: true,
        },
        {
          id: "s4",
          timestamp: tenDaysAgo, // outside this week
          durationSeconds: 1500,
          mode: "simple",
          completed: true,
        },
        {
          id: "s5",
          timestamp: oneHourAgo,
          durationSeconds: 300,
          mode: "simple",
          completed: false, // Incomplete session ignored
        },
      ];

      const summary = aggregateFocusStats(sessions, fixedNow);
      assert.equal(summary.sessionsToday, 1);
      assert.equal(summary.focusMinutesToday, 25);
      assert.equal(summary.sessionsThisWeek, 3);
      assert.equal(summary.focusMinutesThisWeek, 60); // 25 + 25 + 10
      assert.equal(summary.streakDays, 3); // today, yesterday, 2 days ago
    });

    // 14. FocusStatsService Local Persistence
    await test("FocusStatsService: records sessions, retrieves summary, and clears", () => {
      mockStorage.clear();
      const service = new LocalFocusStatsService();

      const empty = service.getStatsSummary();
      assert.ok(empty instanceof Promise);

      return service.getStatsSummary().then(async (initial) => {
        assert.equal(initial.sessionsToday, 0);

        await service.recordSession({
          durationSeconds: 1500,
          mode: "simple",
          completed: true,
          activityLabel: "Science Reading",
        });

        const list = await service.listSessions();
        assert.equal(list.length, 1);
        assert.equal(list[0].activityLabel, "Science Reading");

        const updated = await service.getStatsSummary();
        assert.equal(updated.sessionsToday, 1);
        assert.equal(updated.focusMinutesToday, 25);

        await service.clearStats();
        const cleared = await service.listSessions();
        assert.equal(cleared.length, 0);
      });
    });

    // 15. Component Rendering: FocusTimer
    await test("FocusTimer: renders preset buttons, digital time, progress bar, and controls", () => {
      const html = render(
        React.createElement(FocusTimer, { defaultDurationSeconds: 1500 })
      );
      assert.ok(html.includes("Focus Timer"));
      assert.ok(html.includes("25:00"));
      assert.ok(html.includes("5 min"));
      assert.ok(html.includes("10 min"));
      assert.ok(html.includes("15 min"));
      assert.ok(html.includes("25 min"));
      assert.ok(html.includes("Start Focus"));
      assert.ok(html.includes("Saved on this device only"));
    });

    // 16. Component Rendering: PomodoroTimer
    await test("PomodoroTimer: renders phase label, cycle indicator, and timer controls", () => {
      const html = render(
        React.createElement(PomodoroTimer, {
          initialConfig: { focusMinutes: 25, shortBreakMinutes: 5 },
        })
      );
      assert.ok(html.includes("Focus &amp; Break Cycles") || html.includes("Focus & Break Cycles"));
      assert.ok(html.includes("Focus Time"));
      assert.ok(html.includes("25:00"));
      assert.ok(html.includes("Cycle Progress:"));
      assert.ok(html.includes("Start Focus Time"));
      assert.ok(html.includes("Timer Settings"));
    });

    // 17. Component Rendering: FocusStats
    await test("FocusStats: renders today and this week metric cards with encouraging note", () => {
      const html = render(React.createElement(FocusStats));
      assert.ok(html.includes("Focus Activity"));
      assert.ok(html.includes("Today"));
      assert.ok(html.includes("This Week"));
      assert.ok(html.includes("Streak"));
      assert.ok(html.includes("Saved on this device only"));
    });

    // 18. Component Rendering: AdhdFocusZone
    await test("AdhdFocusZone: renders top banner, mode switch tabs, and stats section", () => {
      const html = render(React.createElement(AdhdFocusZone));
      assert.ok(html.includes("ADHD Focus Zone"));
      assert.ok(html.includes("Gentle Focus Space") || html.includes("Calm Focus Space"));
      assert.ok(html.includes("Timers"));
      assert.ok(html.includes("Step Breakdown"));
      assert.ok(html.includes("Daily Habits"));
      assert.ok(html.includes("Star Bank"));
    });

    // 19. Task Breakdown: addTaskStep and calculateTaskProgress
    await test("TaskBreakdown: addTaskStep and calculateTaskProgress", () => {
      let steps: TaskStep[] = [];
      assert.deepEqual(calculateTaskProgress(steps), { completed: 0, total: 0, percent: 0 });

      steps = addTaskStep(steps, "First step");
      steps = addTaskStep(steps, "Second step");
      steps = addTaskStep(steps, "Third step");
      assert.equal(steps.length, 3);
      assert.equal(steps[0].label, "First step");
      assert.equal(steps[0].orderIndex, 0);

      // Blank label ignored
      steps = addTaskStep(steps, "   ");
      assert.equal(steps.length, 3);

      let prog = calculateTaskProgress(steps);
      assert.equal(prog.total, 3);
      assert.equal(prog.completed, 0);
      assert.equal(prog.percent, 0);

      // Toggle step 0
      const { updatedSteps } = toggleTaskStep(steps, steps[0].id);
      steps = updatedSteps;
      prog = calculateTaskProgress(steps);
      assert.equal(prog.completed, 1);
      assert.equal(prog.percent, 33);
    });

    // 20. Task Breakdown: reorderTaskSteps
    await test("TaskBreakdown: reorderTaskSteps moves items and safely handles out of bounds", () => {
      let steps: TaskStep[] = [
        { id: "s1", label: "A", isComplete: false, orderIndex: 0 },
        { id: "s2", label: "B", isComplete: false, orderIndex: 1 },
        { id: "s3", label: "C", isComplete: false, orderIndex: 2 },
      ];

      // Move index 2 ("C") to index 0 -> C, A, B
      steps = reorderTaskSteps(steps, 2, 0);
      assert.equal(steps[0].label, "C");
      assert.equal(steps[0].orderIndex, 0);
      assert.equal(steps[1].label, "A");
      assert.equal(steps[1].orderIndex, 1);
      assert.equal(steps[2].label, "B");
      assert.equal(steps[2].orderIndex, 2);

      // Out of bounds indices return unchanged array
      const unchanged = reorderTaskSteps(steps, -1, 5);
      assert.equal(unchanged[0].label, "C");
      assert.equal(unchanged[2].label, "B");
    });

    // 21. Task Breakdown: toggleTaskStep, editTaskStep, removeTaskStep
    await test("TaskBreakdown: toggleTaskStep, editTaskStep, and removeTaskStep", () => {
      let steps: TaskStep[] = [
        { id: "s1", label: "Original Label", isComplete: false, orderIndex: 0 },
        { id: "s2", label: "Keep Step", isComplete: false, orderIndex: 1 },
      ];

      // Edit
      steps = editTaskStep(steps, "s1", "Updated Label");
      assert.equal(steps[0].label, "Updated Label");

      // Toggle Complete
      const { updatedSteps, justCompleted } = toggleTaskStep(steps, "s1");
      steps = updatedSteps;
      assert.equal(steps[0].isComplete, true);
      assert.equal(justCompleted, true);
      assert.ok(typeof steps[0].completedAt === "number");

      // Toggle Incomplete
      const uncomplete = toggleTaskStep(steps, "s1");
      steps = uncomplete.updatedSteps;
      assert.equal(steps[0].isComplete, false);
      assert.equal(uncomplete.justCompleted, false);

      // Remove
      steps = removeTaskStep(steps, "s1");
      assert.equal(steps.length, 1);
      assert.equal(steps[0].label, "Keep Step");
      assert.equal(steps[0].orderIndex, 0);
    });

    // 22. Habit Tracker: getPast7Days date math across month boundaries
    await test("HabitTracker: getPast7Days spans calendar dates across month boundaries cleanly", () => {
      // Fixed time: November 2, 2026 12:00:00 UTC
      const fixedNovDate = new Date("2026-11-02T12:00:00Z").getTime();
      const past7 = getPast7Days(fixedNovDate);

      assert.equal(past7.length, 7);
      // Day 0 (6 days ago): Oct 27
      assert.equal(past7[0].dateKey, "2026-10-27");
      assert.equal(past7[0].isToday, false);

      // Day 4: Oct 31
      assert.equal(past7[4].dateKey, "2026-10-31");

      // Day 5: Nov 01 (Month boundary crossed smoothly!)
      assert.equal(past7[5].dateKey, "2026-11-01");

      // Day 6: Nov 02 (Today!)
      assert.equal(past7[6].dateKey, "2026-11-02");
      assert.equal(past7[6].isToday, true);

      // Test leap year boundary: March 2, 2024
      const leapYearDate = new Date("2024-03-02T12:00:00Z").getTime();
      const leapDays = getPast7Days(leapYearDate);
      assert.equal(leapDays.length, 7);
      // Feb 29, 2024 must exist in the week!
      assert.ok(leapDays.some((d) => d.dateKey === "2024-02-29"));
    });

    // 23. Habit Tracker: toggleHabitLog and calculateHabitWeeklyRate
    await test("HabitTracker: toggleHabitLog updates daily checks and computes weekly rate", () => {
      let log: HabitLog = {};
      const habitId = "water-habit";
      const dateKey = "2026-10-22";

      assert.equal(isHabitChecked(log, habitId, dateKey), false);

      const check1 = toggleHabitLog(log, habitId, dateKey);
      log = check1.updatedLog;
      assert.equal(check1.isNowChecked, true);
      assert.equal(isHabitChecked(log, habitId, dateKey), true);

      // Uncheck
      const check2 = toggleHabitLog(log, habitId, dateKey);
      log = check2.updatedLog;
      assert.equal(check2.isNowChecked, false);
      assert.equal(isHabitChecked(log, habitId, dateKey), false);

      // Re-check
      log = toggleHabitLog(log, habitId, dateKey).updatedLog;

      const dummyWeek = [
        { dateKey: "2026-10-21", dayLabel: "Wed", dayNumber: 21, isToday: false },
        { dateKey: "2026-10-22", dayLabel: "Thu", dayNumber: 22, isToday: true },
      ];
      const rate = calculateHabitWeeklyRate(log, habitId, dummyWeek);
      assert.equal(rate.completedCount, 1);
      assert.equal(rate.totalDays, 2);
    });

    // 24. Rewards: awardStarsIdempotent strictly prevents star farming
    await test("Rewards: awardStarsIdempotent awards stars once and prevents un-tick/re-tick farming", () => {
      let state: RewardState = {
        currentStars: 0,
        lifetimeStars: 0,
        goal: { id: "g1", title: "Game Night", targetStars: 10 },
        awardedEventKeys: [],
      };

      // 1. First completion: awards 1 star
      const firstAward = awardStarsIdempotent(
        state,
        "task_step",
        "step-math-1",
        "2026-10-22",
        1
      );
      state = firstAward.updatedState;
      assert.equal(firstAward.wasAwarded, true);
      assert.equal(state.currentStars, 1);
      assert.equal(state.lifetimeStars, 1);
      assert.equal(state.awardedEventKeys.length, 1);

      // 2. User un-ticks step in UI, then re-ticks it (attempts to farm stars):
      // The idempotency key ("task_step:step-math-1:2026-10-22") is already in awardedEventKeys!
      const farmAttempt = awardStarsIdempotent(
        state,
        "task_step",
        "step-math-1",
        "2026-10-22",
        1
      );
      assert.equal(farmAttempt.wasAwarded, false);
      // Critical check: currentStars is STILL 1, lifetimeStars is STILL 1!
      assert.equal(farmAttempt.updatedState.currentStars, 1);
      assert.equal(farmAttempt.updatedState.lifetimeStars, 1);

      // 3. Different step awards normally
      const nextStepAward = awardStarsIdempotent(
        state,
        "task_step",
        "step-math-2",
        "2026-10-22",
        1
      );
      assert.equal(nextStepAward.wasAwarded, true);
      assert.equal(nextStepAward.updatedState.currentStars, 2);
    });

    // 25. Rewards: calculateGoalProgress and redeemGoal
    await test("Rewards: calculateGoalProgress and redeemGoal updates currentStars and retains lifetime", () => {
      let state: RewardState = {
        currentStars: 10,
        lifetimeStars: 10,
        goal: { id: "g1", title: "Fun Outing", targetStars: 10 },
        awardedEventKeys: ["event-1", "event-2"],
      };

      let prog = calculateGoalProgress(state);
      assert.equal(prog.current, 10);
      assert.equal(prog.target, 10);
      assert.equal(prog.percent, 100);
      assert.equal(prog.isGoalReached, true);

      // Redeem goal
      const redeemed = redeemGoal(state);
      assert.equal(redeemed.success, true);
      state = redeemed.updatedState;
      assert.equal(state.currentStars, 0);
      assert.equal(state.lifetimeStars, 10); // Lifetime stars preserved!
      assert.equal(state.awardedEventKeys.length, 2); // Event keys preserved!

      // Cannot redeem again without enough stars
      const failedRedeem = redeemGoal(state);
      assert.equal(failedRedeem.success, false);
      assert.equal(failedRedeem.updatedState.currentStars, 0);
    });

    // 26. LocalTaskService: CRUD persistence
    await test("LocalTaskService: creates, retrieves, updates, and deletes tasks", async () => {
      mockStorage.clear();
      const service = new LocalTaskService();

      const task = await service.createTask("Homework", ["Open book", "Read page 1"]);
      assert.equal(task.title, "Homework");
      assert.equal(task.steps.length, 2);

      const list = await service.listTasks();
      assert.equal(list.length, 1);
      assert.equal(list[0].id, task.id);

      // Update task
      task.steps[0].isComplete = true;
      await service.updateTask(task);
      const fetched = await service.getTask(task.id);
      assert.equal(fetched?.steps[0].isComplete, true);

      // Delete task
      await service.deleteTask(task.id);
      const afterDelete = await service.listTasks();
      assert.equal(afterDelete.length, 0);
    });

    // 27. LocalHabitService: habits and log persistence
    await test("LocalHabitService: manages habits and persists 7-day checks", async () => {
      mockStorage.clear();
      const service = new LocalHabitService();

      const habits = await service.listHabits();
      assert.ok(habits.length > 0);

      const custom = await service.addHabit("Take deep breath", "🧘");
      const list = await service.listHabits();
      assert.ok(list.some((h) => h.id === custom.id));

      const { updatedLog, isNowChecked } = await service.toggleDay(custom.id, "2026-10-22");
      assert.equal(isNowChecked, true);
      assert.equal(updatedLog[custom.id]["2026-10-22"], true);

      const fetchedLog = await service.getLog();
      assert.equal(fetchedLog[custom.id]["2026-10-22"], true);
    });

    // 28. LocalRewardService: star bank and goal updates
    await test("LocalRewardService: manages stars and goals idempotently", async () => {
      mockStorage.clear();
      const service = new LocalRewardService();

      const initial = await service.getState();
      assert.equal(initial.currentStars, 0);

      // Award 2 stars
      const res1 = await service.awardStars("habit_day", "h1", "2026-10-22", 2);
      assert.equal(res1.wasAwarded, true);
      assert.equal(res1.updatedState.currentStars, 2);

      // Award same again -> rejected
      const res2 = await service.awardStars("habit_day", "h1", "2026-10-22", 2);
      assert.equal(res2.wasAwarded, false);
      assert.equal(res2.updatedState.currentStars, 2);

      // Update goal
      const updated = await service.setGoal({ title: "Read Book", targetStars: 5 });
      assert.equal(updated.goal.title, "Read Book");
      assert.equal(updated.goal.targetStars, 5);
    });

    // 29. Component Rendering: TaskBreakdown
    await test("TaskBreakdown: renders step breakdown header and actions", () => {
      const html = render(React.createElement(TaskBreakdown));
      assert.ok(html.includes("Task Breakdown"));
      assert.ok(html.includes("Bite-Sized Steps"));
      assert.ok(html.includes("Saved on this device only"));
    });

    // 30. Component Rendering: HabitTracker
    await test("HabitTracker: renders 7-day grid and daily habits", () => {
      const html = render(React.createElement(HabitTracker));
      assert.ok(html.includes("Daily Habits"));
      assert.ok(html.includes("Small Daily Rhythms"));
      assert.ok(html.includes("Saved on this device only"));
    });

    // 31. Component Rendering: RewardsProgress
    await test("RewardsProgress: renders Star Bank, target goal, and DeviceOnlyNote", () => {
      const html = render(React.createElement(RewardsProgress));
      assert.ok(html.includes("Star Bank"));
      assert.ok(html.includes("Rewards &amp; Progress") || html.includes("Rewards & Progress"));
      assert.ok(html.includes("stars available"));
      assert.ok(html.includes("Saved on this device only"));
    });
  } finally {
    (globalThis as unknown as { window?: unknown }).window = originalWindow;
  }

  console.log(`\nadhd: ${passed} tests passed\n`);
}

runAll().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
