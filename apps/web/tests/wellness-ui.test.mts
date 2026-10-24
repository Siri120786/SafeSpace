/**
 * SafeSpace Wellness UI Component & Reduced Motion Tests.
 * Run with: tsx apps/web/tests/wellness-ui.test.mts
 * Following calm-tools.test.mts style using node:assert and renderToStaticMarkup.
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  resolveLowSensory,
  WellnessCard,
  BigButton,
  SoftBadge,
  ProgressBar,
  CountdownDisplay,
  formatTimeDigits,
  formatVerbalTime,
  EmptyState,
  ErrorState,
  LoadingState,
  DeviceOnlyNote,
  LocalDeviceStore,
  createLocalDeviceStore,
} from "../src/features/wellness-ui/index.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`  FAIL ${name}`);
    throw e;
  }
}

const render = (el: React.ReactElement) => renderToStaticMarkup(el);

// ---- reduced motion / low-sensory pure rule ----
test("reduced motion: either OS setting or saved preference activates it", () => {
  assert.equal(resolveLowSensory(false, false), false);
  assert.equal(resolveLowSensory(true, false), true);
  assert.equal(resolveLowSensory(false, true), true);
  assert.equal(resolveLowSensory(true, true), true);
});

// ---- WellnessCard ----
test("WellnessCard: renders title, subtitle, and accessible role", () => {
  const html = render(
    React.createElement(WellnessCard, {
      title: "Gentle Morning Routine",
      subtitle: "Take your time with each step",
    })
  );
  assert.ok(html.includes("Gentle Morning Routine"));
  assert.ok(html.includes("Take your time with each step"));
  assert.ok(html.includes('role="region"'));
});

test("WellnessCard: interactive card has role=button and tabIndex=0", () => {
  const html = render(
    React.createElement(WellnessCard, {
      title: "Interactive Card",
      onClick: () => {},
    })
  );
  assert.ok(html.includes('role="button"'));
  assert.ok(html.includes('tabindex="0"'));
  assert.ok(html.includes("cursor-pointer"));
});

test("WellnessCard: decorative card adds data-decorative attribute", () => {
  const html = render(
    React.createElement(WellnessCard, {
      dataDecorative: true,
      children: "Decorative Content",
    })
  );
  assert.ok(html.includes('data-decorative="true"'));
});

// ---- BigButton ----
test("BigButton: enforces 48px+ touch target and focus visibility", () => {
  const html = render(
    React.createElement(BigButton, { onClick: () => {} }, "Start Pause")
  );
  assert.ok(html.includes("min-h-[48px]"));
  assert.ok(html.includes("min-w-[48px]"));
  assert.ok(html.includes("focus-visible:ring-2"));
  assert.ok(html.includes("Start Pause"));
});

test("BigButton: disabled button sets aria-disabled and disabled attribute", () => {
  const html = render(
    React.createElement(BigButton, { disabled: true }, "Unavailable")
  );
  assert.ok(html.includes("disabled"));
  assert.ok(html.includes('aria-disabled="true"'));
  assert.ok(html.includes("opacity-50"));
});

// ---- SoftBadge ----
test("SoftBadge: renders gentle non-clinical status pill", () => {
  const html = render(
    React.createElement(SoftBadge, { variant: "success", icon: "🌱" }, "In Progress")
  );
  assert.ok(html.includes("In Progress"));
  assert.ok(html.includes("🌱"));
  assert.ok(html.includes("rounded-full"));
});

// ---- ProgressBar ----
test("ProgressBar: disables animation and transition when reduced motion is true", () => {
  const htmlReduced = render(
    React.createElement(ProgressBar, {
      value: 60,
      max: 100,
      label: "Routine Completion",
      reducedMotion: true,
    })
  );
  assert.ok(htmlReduced.includes('role="progressbar"'));
  assert.ok(htmlReduced.includes('aria-valuenow="60"'));
  assert.ok(htmlReduced.includes('aria-valuemax="100"'));
  assert.ok(htmlReduced.includes("transition-none"));
  assert.ok(!htmlReduced.includes("transition-[width]"));
});

test("ProgressBar: enables transition when reduced motion is false", () => {
  const htmlAnimated = render(
    React.createElement(ProgressBar, {
      value: 60,
      max: 100,
      reducedMotion: false,
    })
  );
  assert.ok(htmlAnimated.includes("transition-[width]"));
  assert.ok(!htmlAnimated.includes("transition-none"));
});

// ---- CountdownDisplay ----
test("CountdownDisplay: format helpers compute digital and verbal formats", () => {
  assert.equal(formatTimeDigits(270), "04:30");
  assert.equal(formatTimeDigits(0), "00:00");
  assert.equal(formatVerbalTime(270), "4 minutes and 30 seconds remaining");
  assert.equal(formatVerbalTime(60), "1 minute remaining");
  assert.equal(formatVerbalTime(45), "45 seconds remaining");
  assert.equal(formatVerbalTime(0), "Time is complete — take a gentle pause");
});

test("CountdownDisplay: renders timer with aria-live and verbal text first", () => {
  const html = render(
    React.createElement(CountdownDisplay, {
      secondsRemaining: 150,
      label: "Focus Window",
    })
  );
  assert.ok(html.includes('role="timer"'));
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(html.includes("Focus Window"));
  assert.ok(html.includes("02:30"));
  assert.ok(html.includes("2 minutes and 30 seconds remaining"));
});

// ---- EmptyState ----
test("EmptyState: reassuring message with role=status and decorative icon", () => {
  const html = render(
    React.createElement(EmptyState, {
      title: "No tasks scheduled for now",
      description: "Enjoy a restful moment, or add a gentle step when ready.",
      icon: "🌸",
    })
  );
  assert.ok(html.includes('role="status"'));
  assert.ok(html.includes("No tasks scheduled for now"));
  assert.ok(html.includes('data-decorative="true"'));
});

// ---- ErrorState ----
test("ErrorState: gentle wording with accessible retry button", () => {
  const html = render(
    React.createElement(ErrorState, {
      title: "Take a breath",
      message: "We could not load your comfort settings right now.",
      onRetry: () => {},
      retryLabel: "Try again gently",
    })
  );
  assert.ok(html.includes('role="alert"'));
  assert.ok(html.includes("Take a breath"));
  assert.ok(html.includes("We could not load your comfort settings right now."));
  assert.ok(html.includes("Try again gently"));
  assert.ok(html.includes("min-h-[48px]")); // Retry button is a BigButton
});

// ---- LoadingState ----
test("LoadingState: replaces animation with static element when reduced motion is true", () => {
  const htmlReduced = render(
    React.createElement(LoadingState, {
      message: "Preparing your quiet space...",
      reducedMotion: true,
    })
  );
  assert.ok(htmlReduced.includes('role="status"'));
  assert.ok(htmlReduced.includes("Preparing your quiet space..."));
  assert.ok(htmlReduced.includes("🌱"));
  assert.ok(!htmlReduced.includes("animate-spin"));
});

test("LoadingState: renders gentle spinner when motion is welcomed", () => {
  const htmlAnimated = render(
    React.createElement(LoadingState, {
      message: "Preparing your quiet space...",
      reducedMotion: false,
    })
  );
  assert.ok(htmlAnimated.includes("animate-spin"));
});

// ---- DeviceOnlyNote ----
test("DeviceOnlyNote: renders gentle local-device privacy notice with role=note", () => {
  const html = render(
    React.createElement(DeviceOnlyNote, {
      featureName: "Focus Routine",
    })
  );
  assert.ok(html.includes('role="note"'));
  assert.ok(html.includes("Saved on this device only"));
  assert.ok(html.includes("Focus Routine"));
  assert.ok(html.includes("not saved to the cloud yet"));
});

test("DeviceOnlyNote: compact mode renders inline badge style", () => {
  const html = render(
    React.createElement(DeviceOnlyNote, {
      compact: true,
    })
  );
  assert.ok(html.includes('role="note"'));
  assert.ok(html.includes("Saved on this device only"));
  assert.ok(html.includes("inline-flex"));
});

// ---- LocalDeviceStore ----
// Mock environment storage harness for testing Node.js execution
class MockStorage {
  private map = new Map<string, string>();
  public shouldThrow = false;

  getItem(key: string): string | null {
    if (this.shouldThrow) throw new Error("SecurityError: Access Denied");
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.shouldThrow) throw new Error("QuotaExceededError");
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    if (this.shouldThrow) throw new Error("SecurityError: Access Denied");
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

const mockStorage = new MockStorage();
const originalWindow = (globalThis as unknown as { window?: unknown }).window;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: mockStorage,
};

test("LocalDeviceStore: uses namespace prefix safespace.ws-b.", () => {
  const store = createLocalDeviceStore<string[]>("test.routines");
  assert.equal(store.key, "safespace.ws-b.test.routines");
});

test("LocalDeviceStore: returns default value on missing key", () => {
  mockStorage.clear();
  const store = createLocalDeviceStore<{ count: number }>("test.missing");
  const result = store.get({ count: 10 });
  assert.deepEqual(result, { count: 10 });
});

test("LocalDeviceStore: set, get, and remove work cleanly", () => {
  mockStorage.clear();
  const store = createLocalDeviceStore<string[]>("test.items");
  const success = store.set(["Breathe", "Walk"]);
  assert.equal(success, true);

  const fetched = store.get([]);
  assert.deepEqual(fetched, ["Breathe", "Walk"]);

  const removed = store.remove();
  assert.equal(removed, true);
  const afterRemove = store.get(["Default"]);
  assert.deepEqual(afterRemove, ["Default"]);
});

test("LocalDeviceStore: corrupt JSON falls back to default safely without throwing", () => {
  mockStorage.clear();
  const store = createLocalDeviceStore<number[]>("test.corrupt");
  mockStorage.setItem(store.key, "{corrupt-invalid-json");

  const result = store.get([1, 2, 3]);
  assert.deepEqual(result, [1, 2, 3]);
});

test("LocalDeviceStore: custom validator filters invalid payload", () => {
  mockStorage.clear();
  interface Step {
    id: string;
    label: string;
  }
  const store = new LocalDeviceStore<Step[]>("test.validated", {
    validator: (d): d is Step[] =>
      Array.isArray(d) && d.every((i) => typeof i?.id === "string" && typeof i?.label === "string"),
  });

  // Storing valid payload
  store.set([{ id: "1", label: "Check in" }]);
  assert.deepEqual(store.get([]), [{ id: "1", label: "Check in" }]);

  // Tampering with invalid structure
  mockStorage.setItem(store.key, JSON.stringify([{ badField: 123 }]));
  assert.deepEqual(store.get([]), []);
});

test("LocalDeviceStore: unavailable storage fails safely without throwing", () => {
  mockStorage.shouldThrow = true;
  const store = createLocalDeviceStore<string>("test.throws");

  assert.equal(store.isAvailable(), false);
  assert.equal(store.get("safe_fallback"), "safe_fallback");
  assert.equal(store.set("will_fail"), false);
  assert.equal(store.remove(), false);

  mockStorage.shouldThrow = false;
});

// Restore global window
(globalThis as unknown as { window?: unknown }).window = originalWindow;

console.log(`\nwellness-ui: ${passed} tests passed\n`);
