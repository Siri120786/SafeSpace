/**
 * SafeSpace Autism Feature Tests (Workstream B - Sprint 3)
 * Tests countdown pure state machine, edge cases, coarse announcements,
 * emotion cards service storage, transition service, and markup rendering.
 * Run with: tsx apps/web/tests/autism.test.mts
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
  DEFAULT_TRANSITION_CONFIG,
  DEFAULT_EMOTION_CARDS,
  EmotionCards,
  TransitionCountdown,
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

    // Calling start while already running returns state unchanged
    const stillRunning = startCountdown(running);
    assert.equal(stillRunning.phase, "running");
  });

  await test("countdown transitions: pause and resume cycle", () => {
    const idle = initCountdown("Reading", 180);
    const running = startCountdown(idle);
    const paused = pauseCountdown(running);
    assert.equal(paused.phase, "paused");
    assert.equal(paused.secondsRemaining, 180);

    // Resuming
    const resumed = resumeCountdown(paused);
    assert.equal(resumed.phase, "running");

    // Pausing when already paused does nothing
    assert.equal(pauseCountdown(paused).phase, "paused");
    // Resuming when already running does nothing
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

    // Completes on final second
    const tick3 = tickCountdown(tick2, 1);
    assert.equal(tick3.phase, "done");
    assert.equal(tick3.secondsRemaining, 0);

    // Further ticks when done do not go negative
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

    // 1. Start announcement
    const startAnnounce = getCoarseAnnouncement(idle, runningStart);
    assert.ok(startAnnounce?.includes("Starting countdown"));
    assert.ok(startAnnounce?.includes("Tidy Up"));

    // 2. Normal tick (e.g. 119s, 90s) returns null (no chatter)
    const tick90: CountdownState = { ...runningStart, secondsRemaining: 90 };
    const prev91: CountdownState = { ...runningStart, secondsRemaining: 91 };
    assert.equal(getCoarseAnnouncement(prev91, tick90), null);

    // 3. Exactly 60 seconds left announcement
    const tick60: CountdownState = { ...runningStart, secondsRemaining: 60 };
    const prev61: CountdownState = { ...runningStart, secondsRemaining: 61 };
    const oneMinAnnounce = getCoarseAnnouncement(prev61, tick60);
    assert.ok(oneMinAnnounce?.includes("One minute remaining before Tidy Up"));

    // 4. Tick past 60s (59s) returns null
    const tick59: CountdownState = { ...runningStart, secondsRemaining: 59 };
    assert.equal(getCoarseAnnouncement(tick60, tick59), null);

    // 5. Done announcement
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
  // 2. EMOTION CARDS & TRANSITION SERVICE STORAGE TESTS
  // ============================================================================

  const mockStorage = new MockMemoryStorage();
  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: mockStorage,
  };

  try {
    await test("EmotionCardsService: records taps and retrieves newest first", async () => {
      mockStorage.clear();
      const service = new LocalEmotionCardsService();

      const empty = await service.getRecentSelections();
      assert.deepEqual(empty, []);

      await service.recordSelection(DEFAULT_EMOTION_CARDS[0]); // Happy
      await service.recordSelection(DEFAULT_EMOTION_CARDS[1]); // Calm

      const history = await service.getRecentSelections();
      assert.equal(history.length, 2);
      assert.equal(history[0].cardId, "calm"); // newest first
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

    // ============================================================================
    // 3. COMPONENT MARKUP TESTS
    // ============================================================================

    await test("EmotionCards: renders 10 emotion cards with role=group and reassurance slots", () => {
      const html = render(React.createElement(EmotionCards));
      assert.ok(html.includes("How are you feeling right now?"));
      assert.ok(html.includes('role="group"'));
      assert.ok(html.includes("I want a grown-up"));
      assert.ok(html.includes("Saved on this device only"));

      // Checks representation of the 6 shared mood values + additional cards
      assert.ok(html.includes("Happy"));
      assert.ok(html.includes("Calm"));
      assert.ok(html.includes("Very Joyful"));
      assert.ok(html.includes("In-Between"));
      assert.ok(html.includes("Sad"));
      assert.ok(html.includes("Tired"));
      assert.ok(html.includes("A Bit Full"));
      assert.ok(html.includes("Too Much Noise"));
      assert.ok(html.includes("Proud"));
      assert.ok(html.includes("Curious"));
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
  } finally {
    // Clean restore
    (globalThis as unknown as { window?: unknown }).window = originalWindow;
  }

  console.log(`\nautism: ${passed} tests passed\n`);
}

runAll().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
