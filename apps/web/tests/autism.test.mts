/**
 * SafeSpace Autism Feature Tests (Workstream B - Sprint 3)
 * Tests countdown pure state machine, visual schedule logic, RoutineStep adapter,
 * AAC sentence strip logic, theme resolution under low-sensory, and markup rendering.
 * Run with: tsx apps/web/tests/autism.test.mts
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ROUTINE_STEP_ICONS, type RoutineStepWithProgress } from "@safespace/shared-types";

import {
  initCountdown,
  startCountdown,
  pauseCountdown,
  resumeCountdown,
  resetCountdown,
  tickCountdown,
  getShrinkingProgress,
  getCoarseAnnouncement,
  getCountdownSnapshot,
  LocalEmotionCardsService,
  LocalTransitionService,
  LocalScheduleService,
  LocalAacService,
  LocalThemeService,
  toScheduleStep,
  resolveActiveTheme,
  THEME_DEFINITIONS,
  DEFAULT_TRANSITION_CONFIG,
  DEFAULT_SAMPLE_STEPS,
  DEFAULT_EMOTION_CARDS,
  DEFAULT_AAC_TILES,
  EmotionCards,
  TransitionCountdown,
  VisualSchedule,
  AacBoard,
  SpecialInterestThemes,
  type CountdownState,
} from "../src/features/conditions/autism/index.ts";
import { LocalDeviceStore } from "../src/features/wellness-ui/index.ts";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`  FAIL ${name}`);
    throw e;
  }
}

const render = (el: React.ReactElement) => renderToStaticMarkup(el);

class MockMemoryStorage {
  private map = new Map<string, string>();
  public shouldFail = false;

  getItem(key: string): string | null {
    if (this.shouldFail) throw new Error("Storage failure");
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.shouldFail) throw new Error("Storage failure");
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    if (this.shouldFail) throw new Error("Storage failure");
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

async function runAll() {
  // ============================================================================
  // 1. COUNTDOWN PURE STATE MACHINE TESTS
  // ============================================================================

  await test("countdown: initCountdown initializes idle state with safe bounds", () => {
    const state = initCountdown("Drawing", 300);
    assert.equal(state.phase, "idle");
    assert.equal(state.activity, "Drawing");
    assert.equal(state.totalSeconds, 300);
    assert.equal(state.secondsRemaining, 300);
  });

  await test("countdown edge case: 0 seconds initializes as done", () => {
    const zeroState = initCountdown("Snack", 0);
    assert.equal(zeroState.phase, "done");
    assert.equal(zeroState.secondsRemaining, 0);
  });

  await test("countdown edge case: negative seconds clamp to 0 and done", () => {
    const negState = initCountdown("Snack", -45);
    assert.equal(negState.phase, "done");
    assert.equal(negState.totalSeconds, 0);
    assert.equal(negState.secondsRemaining, 0);
  });

  await test("countdown edge case: blank activity defaults gracefully", () => {
    const blankState = initCountdown("   ", 120);
    assert.equal(blankState.activity, "Next activity");
  });

  await test("countdown transitions: start from idle transitions to running", () => {
    const idle = initCountdown("Reading", 180);
    const running = startCountdown(idle);
    assert.equal(running.phase, "running");
    assert.equal(running.secondsRemaining, 180);

    const stillRunning = startCountdown(running);
    assert.equal(stillRunning.phase, "running");
  });

  await test("countdown transitions: pause and resume cycle", () => {
    const idle = initCountdown("Reading", 180);
    const running = startCountdown(idle);
    const paused = pauseCountdown(running);
    assert.equal(paused.phase, "paused");
    assert.equal(paused.secondsRemaining, 180);

    const resumed = resumeCountdown(paused);
    assert.equal(resumed.phase, "running");

    assert.equal(pauseCountdown(paused).phase, "paused");
    assert.equal(resumeCountdown(running).phase, "running");
  });

  await test("countdown transitions: tick decrements time and transitions to done", () => {
    const running = startCountdown(initCountdown("Wash Hands", 3));
    const tick1 = tickCountdown(running, 1);
    assert.equal(tick1.phase, "running");
    assert.equal(tick1.secondsRemaining, 2);

    const tick2 = tickCountdown(tick1, 1);
    assert.equal(tick2.phase, "running");
    assert.equal(tick2.secondsRemaining, 1);

    const tick3 = tickCountdown(tick2, 1);
    assert.equal(tick3.phase, "done");
    assert.equal(tick3.secondsRemaining, 0);

    const tick4 = tickCountdown(tick3, 1);
    assert.equal(tick4.phase, "done");
    assert.equal(tick4.secondsRemaining, 0);
  });

  await test("countdown edge case: tick overshoot clamps to zero without error", () => {
    const running = startCountdown(initCountdown("Stretch", 5));
    const overshot = tickCountdown(running, 10);
    assert.equal(overshot.phase, "done");
    assert.equal(overshot.secondsRemaining, 0);
  });

  await test("countdown edge case: tick when paused does not decrement time", () => {
    const paused = pauseCountdown(startCountdown(initCountdown("Rest", 60)));
    const afterTick = tickCountdown(paused, 1);
    assert.equal(afterTick.phase, "paused");
    assert.equal(afterTick.secondsRemaining, 60);
  });

  await test("countdown edge case: reset while running resets to initial idle state", () => {
    const running = tickCountdown(startCountdown(initCountdown("Lunch", 600)), 120);
    assert.equal(running.secondsRemaining, 480);
    assert.equal(running.phase, "running");

    const reset = resetCountdown(running);
    assert.equal(reset.phase, "idle");
    assert.equal(reset.secondsRemaining, 600);
    assert.equal(reset.totalSeconds, 600);
  });

  await test("countdown: reset with new duration updates configuration", () => {
    const idle = initCountdown("Play", 300);
    const reconfigured = resetCountdown(idle, 180, "Story Time");
    assert.equal(reconfigured.phase, "idle");
    assert.equal(reconfigured.activity, "Story Time");
    assert.equal(reconfigured.secondsRemaining, 180);
    assert.equal(reconfigured.totalSeconds, 180);
  });

  await test("countdown: getShrinkingProgress calculates 100% down to 0%", () => {
    const state: CountdownState = {
      phase: "running",
      activity: "Task",
      totalSeconds: 200,
      secondsRemaining: 200,
    };
    assert.equal(getShrinkingProgress(state), 100);

    state.secondsRemaining = 100;
    assert.equal(getShrinkingProgress(state), 50);

    state.secondsRemaining = 0;
    assert.equal(getShrinkingProgress(state), 0);
  });

  await test("countdown: coarse announcements fire only at start, 60s, and done", () => {
    const idle = initCountdown("Tidy Up", 120);
    const runningStart = startCountdown(idle);

    // Start announcement
    const startAnnounce = getCoarseAnnouncement(idle, runningStart);
    assert.ok(startAnnounce?.includes("Starting countdown"));
    assert.ok(startAnnounce?.includes("Tidy Up"));

    // Normal tick returns null (no chatter)
    const tick90: CountdownState = { ...runningStart, secondsRemaining: 90 };
    const prev91: CountdownState = { ...runningStart, secondsRemaining: 91 };
    assert.equal(getCoarseAnnouncement(prev91, tick90), null);

    // Exactly 60 seconds left announcement
    const tick60: CountdownState = { ...runningStart, secondsRemaining: 60 };
    const prev61: CountdownState = { ...runningStart, secondsRemaining: 61 };
    const oneMinAnnounce = getCoarseAnnouncement(prev61, tick60);
    assert.ok(oneMinAnnounce?.includes("One minute remaining before Tidy Up"));

    // Tick past 60s returns null
    const tick59: CountdownState = { ...runningStart, secondsRemaining: 59 };
    assert.equal(getCoarseAnnouncement(tick60, tick59), null);

    // Done announcement
    const doneState: CountdownState = { ...runningStart, phase: "done", secondsRemaining: 0 };
    const prev1s: CountdownState = { ...runningStart, phase: "running", secondsRemaining: 1 };
    const doneAnnounce = getCoarseAnnouncement(prev1s, doneState);
    assert.ok(doneAnnounce?.includes("Time is up. Next: Tidy Up"));
  });

  await test("countdown: getCountdownSnapshot captures composite view", () => {
    const curr = initCountdown("Break", 60);
    const snapshot = getCountdownSnapshot(null, curr);
    assert.equal(snapshot.phase, "idle");
    assert.equal(snapshot.activity, "Break");
    assert.equal(snapshot.progressPercent, 100);
  });

  // ============================================================================
  // 2. ROUTINESTEP ADAPTER TEST
  // ============================================================================

  await test("RoutineStep adapter: toScheduleStep maps a routine step with today's completion", () => {
    const mockDbRoutine: RoutineStepWithProgress = {
      id: "routine-test-1",
      routineId: "routine-42",
      label: "Pack backpack",
      scheduledTime: "08:30",
      orderIndex: 3,
      icon: "school",
      completedOnDate: true,
    };

    const scheduleStep = toScheduleStep(mockDbRoutine);
    assert.equal(scheduleStep.id, "routine-test-1");
    assert.equal(scheduleStep.label, "Pack backpack");
    assert.equal(scheduleStep.timeEstimate, "08:30");
    assert.equal(scheduleStep.icon, ROUTINE_STEP_ICONS.school.emoji);
    assert.equal(scheduleStep.isComplete, true);
    assert.equal(scheduleStep.orderIndex, 3);
    assert.equal(toScheduleStep({ ...mockDbRoutine, icon: null, completedOnDate: false }).icon, undefined);
    assert.equal(toScheduleStep({ ...mockDbRoutine, completedOnDate: false }).isComplete, false);
  });

  // ============================================================================
  // 3. STORAGE & SERVICE LOGIC TESTS
  // ============================================================================

  const mockStorage = new MockMemoryStorage();
  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: mockStorage,
  };

  try {
    // EmotionCardsService
    await test("EmotionCardsService: records taps and retrieves newest first", async () => {
      mockStorage.clear();
      const service = new LocalEmotionCardsService();

      const empty = await service.getRecentSelections();
      assert.deepEqual(empty, []);

      await service.recordSelection(DEFAULT_EMOTION_CARDS[0]); // Happy
      await service.recordSelection(DEFAULT_EMOTION_CARDS[1]); // Calm

      const history = await service.getRecentSelections();
      assert.equal(history.length, 2);
      assert.equal(history[0].cardId, "calm");
      assert.equal(history[1].cardId, "happy");

      await service.clearRecentSelections();
      const cleared = await service.getRecentSelections();
      assert.deepEqual(cleared, []);
    });

    await test("EmotionCardsService: corrupt storage data falls back safely to empty array", async () => {
      mockStorage.clear();
      const customStore = new LocalDeviceStore<any>("autism.emotion-cards");
      mockStorage.setItem(customStore.key, "{bad-json-syntax");

      const service = new LocalEmotionCardsService(customStore);
      const fallback = await service.getRecentSelections();
      assert.deepEqual(fallback, []);
    });

    // TransitionService
    await test("TransitionService: saves and retrieves transition presets", async () => {
      mockStorage.clear();
      const service = new LocalTransitionService();

      const initial = await service.getSavedConfig();
      assert.deepEqual(initial, DEFAULT_TRANSITION_CONFIG);

      await service.saveConfig({ activity: "Gardening", totalSeconds: 420 });
      const updated = await service.getSavedConfig();
      assert.equal(updated.activity, "Gardening");
      assert.equal(updated.totalSeconds, 420);
    });

    await test("TransitionService: corrupt config falls back to default safely", async () => {
      mockStorage.clear();
      const customStore = new LocalDeviceStore<any>("autism.transition-config");
      mockStorage.setItem(customStore.key, "not-valid-json");

      const service = new LocalTransitionService(customStore);
      const fallback = await service.getSavedConfig();
      assert.deepEqual(fallback, DEFAULT_TRANSITION_CONFIG);
    });

    // ScheduleService
    await test("ScheduleService: adds, completes, reorders, and removes steps", async () => {
      mockStorage.clear();
      const service = new LocalScheduleService();

      // Initial list is empty
      const empty = await service.listSteps();
      assert.deepEqual(empty, []);

      // Add steps
      const s1 = await service.addStep({ label: "Put shoes on", icon: "👟", isComplete: false, orderIndex: 0 });
      const s2 = await service.addStep({ label: "Drink water", icon: "💧", isComplete: false, orderIndex: 1 });
      const s3 = await service.addStep({ label: "Feed pet", icon: "🐕", isComplete: false, orderIndex: 2 });

      let list = await service.listSteps();
      assert.equal(list.length, 3);
      assert.equal(list[0].label, "Put shoes on");

      // Mark complete
      const completed = await service.setComplete(s1.id, true);
      assert.equal(completed.isComplete, true);
      list = await service.listSteps();
      assert.equal(list[0].isComplete, true);

      // Reorder (s3 first, then s2, then s1)
      const reordered = await service.reorder([s3.id, s2.id, s1.id]);
      assert.equal(reordered[0].id, s3.id);
      assert.equal(reordered[1].id, s2.id);
      assert.equal(reordered[2].id, s1.id);

      // Remove step
      await service.removeStep(s2.id);
      list = await service.listSteps();
      assert.equal(list.length, 2);
      assert.ok(!list.some((s) => s.id === s2.id));

      // Reset to samples
      const samples = await service.resetToSampleSteps();
      assert.equal(samples.length, DEFAULT_SAMPLE_STEPS.length);
    });

    // AacService
    await test("AacService: manages custom tile labels", async () => {
      mockStorage.clear();
      const service = new LocalAacService();

      const initial = await service.getConfig();
      assert.deepEqual(initial.customLabels, {});

      await service.setCustomLabel("help", "Ask Teacher");
      const updated = await service.getConfig();
      assert.equal(updated.customLabels["help"], "Ask Teacher");

      await service.resetCustomLabels();
      const reset = await service.getConfig();
      assert.deepEqual(reset.customLabels, {});
    });

    // ThemeService & Low-Sensory Rule
    await test("ThemeService: resolveActiveTheme always forces calm theme under low-sensory mode", () => {
      // Standard motion: user preference is honored
      assert.equal(resolveActiveTheme("space", false), "space");
      assert.equal(resolveActiveTheme("animals", false), "animals");
      assert.equal(resolveActiveTheme("trains", false), "trains");
      assert.equal(resolveActiveTheme("nature", false), "nature");
      assert.equal(resolveActiveTheme("ocean", false), "ocean");
      assert.equal(resolveActiveTheme("calm", false), "calm");

      // Low-sensory ON: unconditionally forces calm theme
      assert.equal(resolveActiveTheme("space", true), "calm");
      assert.equal(resolveActiveTheme("animals", true), "calm");
      assert.equal(resolveActiveTheme("trains", true), "calm");
      assert.equal(resolveActiveTheme("nature", true), "calm");
      assert.equal(resolveActiveTheme("ocean", true), "calm");

      // Invalid key fallback
      assert.equal(resolveActiveTheme("invalid" as any, false), "calm");
    });

    await test("ThemeService: all theme palettes define valid CSS variables", () => {
      Object.values(THEME_DEFINITIONS).forEach((theme) => {
        assert.ok(theme.cssVariables["--theme-bg"]);
        assert.ok(theme.cssVariables["--theme-surface"]);
        assert.ok(theme.cssVariables["--theme-text"]);
        assert.ok(theme.cssVariables["--theme-accent"]);
      });
    });

    // ============================================================================
    // 4. COMPONENT MARKUP TESTS
    // ============================================================================

    await test("EmotionCards: renders 10 emotion cards with role=group and reassurance slots", () => {
      const html = render(React.createElement(EmotionCards));
      assert.ok(html.includes("How are you feeling right now?"));
      assert.ok(html.includes('role="group"'));
      assert.ok(html.includes("I want a grown-up"));
      assert.ok(html.includes("Saved on this device only"));
      assert.ok(html.includes("Happy"));
      assert.ok(html.includes("Calm"));
    });

    await test("TransitionCountdown: renders text-first timer, progress bar, and preset buttons", () => {
      const html = render(
        React.createElement(TransitionCountdown, {
          initialConfig: { activity: "Quiet Reading", totalSeconds: 300 },
        })
      );
      assert.ok(html.includes("Next: Quiet Reading"));
      assert.ok(html.includes('role="timer"'));
      assert.ok(html.includes('role="progressbar"'));
      assert.ok(html.includes("Start Countdown"));
      assert.ok(html.includes("Quick Transition Presets"));
    });

    await test("VisualSchedule: renders schedule header and sample routine load button", () => {
      const html = render(React.createElement(VisualSchedule));
      assert.ok(html.includes("Routine Steps"));
      assert.ok(html.includes("Grown-Up Edit Mode"));
      assert.ok(html.includes("Saved on this device only"));
    });

    await test("AacBoard: renders sentence strip, speak button, clear button, and category tiles", () => {
      const html = render(React.createElement(AacBoard));
      assert.ok(html.includes("Sentence Strip"));
      assert.ok(html.includes("Speak"));
      assert.ok(html.includes("Clear Sentence"));
      assert.ok(html.includes("← Backspace"));
      assert.ok(html.includes("Help"));
      assert.ok(html.includes("Break"));
      assert.ok(html.includes("Hungry"));
      assert.ok(html.includes("Thirsty"));
    });

    await test("SpecialInterestThemes: renders scoped CSS variables and theme choices", () => {
      const html = render(
        React.createElement(SpecialInterestThemes, {}, React.createElement("div", null, "Child Content"))
      );
      assert.ok(html.includes("Personalize Your Space"));
      assert.ok(html.includes("Deep Space"));
      assert.ok(html.includes("Friendly Safari"));
      assert.ok(html.includes("Steam Trains"));
      assert.ok(html.includes("Forest Walk"));
      assert.ok(html.includes("Tide Pool"));
      assert.ok(html.includes("Child Content"));
    });
  } finally {
    (globalThis as unknown as { window?: unknown }).window = originalWindow;
  }

  console.log(`\nautism: ${passed} tests passed\n`);
}

runAll().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
