/**
 * Calm tools tests. Run with: tsx apps/web/tests/calm-tools.test.mts (part of `pnpm test`).
 * Pure logic is tested directly; screens are rendered to static HTML to check
 * controls, keyboard-friendly markup, reduced motion and exit buttons.
 * No DOM library is needed, so no new dependencies were added.
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import {
  DEFAULT_PATTERN,
  getBreathingState,
  totalSeconds,
} from "../src/features/calm-tools/lib/breathing.ts";
import {
  GROUNDING_STEPS,
  isLastStep,
  nextStepIndex,
  prevStepIndex,
} from "../src/features/calm-tools/lib/grounding.ts";
import { isExitKey, resolveLowSensory } from "../src/features/calm-tools/lib/lowSensory.ts";
import { BreathingExercise } from "../src/features/calm-tools/components/BreathingExercise.tsx";
import { GroundingExercise } from "../src/features/calm-tools/components/GroundingExercise.tsx";
import { CalmToolsHome } from "../src/features/calm-tools/components/CalmToolsHome.tsx";

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

const noop = () => {};
const render = (el: React.ReactElement) => renderToStaticMarkup(React.createElement(StaticRouter, { location: "/" }, el));

// ---- breathing timer ----
test("breathing: phases follow inhale 4 / hold 4 / exhale 6", () => {
  assert.equal(getBreathingState(0).phase, "inhale");
  assert.equal(getBreathingState(3999).phase, "inhale");
  assert.equal(getBreathingState(4000).phase, "hold");
  assert.equal(getBreathingState(7999).phase, "hold");
  assert.equal(getBreathingState(8000).phase, "exhale");
  assert.equal(getBreathingState(13999).phase, "exhale");
  assert.equal(getBreathingState(14000).phase, "inhale");
  assert.equal(getBreathingState(14000).cycle, 2);
});

test("breathing: countdown seconds are accurate", () => {
  assert.equal(getBreathingState(0).secondsLeft, 4);
  assert.equal(getBreathingState(1000).secondsLeft, 3);
  assert.equal(getBreathingState(3500).secondsLeft, 1);
  assert.equal(getBreathingState(8000).secondsLeft, 6);
  assert.equal(getBreathingState(13500).secondsLeft, 1);
});

test("breathing: finishes after the set number of cycles", () => {
  const total = totalSeconds(DEFAULT_PATTERN) * 1000;
  assert.equal(total, 70000);
  assert.equal(getBreathingState(total - 1).finished, false);
  assert.equal(getBreathingState(total).finished, true);
  assert.equal(getBreathingState(total + 5000).finished, true);
});

test("breathing: negative elapsed time is treated as zero", () => {
  assert.equal(getBreathingState(-50).phase, "inhale");
});

// ---- grounding navigation ----
test("grounding: next and back stay inside the steps", () => {
  const n = GROUNDING_STEPS.length;
  assert.equal(n, 5);
  assert.equal(prevStepIndex(0), 0);
  assert.equal(nextStepIndex(n - 1), n - 1);
  assert.equal(nextStepIndex(0), 1);
  assert.equal(prevStepIndex(3), 2);
  assert.equal(isLastStep(n - 1), true);
  assert.equal(isLastStep(0), false);
});

test("grounding: steps count down 5 to 1 with readable instructions", () => {
  assert.deepEqual(GROUNDING_STEPS.map((s) => s.count), [5, 4, 3, 2, 1]);
  for (const s of GROUNDING_STEPS) assert.ok(s.instruction.length > 20);
});

// ---- low sensory / reduced motion ----
test("low sensory: OS setting alone or saved preference alone turns it on", () => {
  assert.equal(resolveLowSensory(false, false), false);
  assert.equal(resolveLowSensory(true, false), true);
  assert.equal(resolveLowSensory(false, true), true);
  assert.equal(resolveLowSensory(true, true), true);
});

test("breathing screen: animation is removed in low-sensory mode", () => {
  const calm = render(React.createElement(BreathingExercise, { lowSensory: true, onExit: noop }));
  assert.match(calm, /data-low-sensory="true"/);
  assert.match(calm, /transition:none/);
  const normal = render(React.createElement(BreathingExercise, { lowSensory: false, onExit: noop }));
  assert.match(normal, /data-low-sensory="false"/);
  assert.match(normal, /transition:transform/);
});

// ---- controls, keyboard and exit ----
test("breathing screen: Start, Reset and Exit are real buttons; Reset disabled before start", () => {
  const html = render(React.createElement(BreathingExercise, { lowSensory: false, onExit: noop }));
  assert.match(html, /<button[^>]*>Start<\/button>/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Reset<\/button>/);
  assert.match(html, /<button[^>]*>Exit<\/button>/);
  assert.match(html, /breathe in for 4, hold for 4, and breathe out for 6/i);
});

test("grounding screen: Back disabled on first step, Next and Exit present, text shown", () => {
  const html = render(React.createElement(GroundingExercise, { lowSensory: false, onExit: noop }));
  assert.match(html, /<button[^>]*disabled=""[^>]*>Back<\/button>/);
  assert.match(html, /<button[^>]*>Next<\/button>/);
  assert.match(html, /<button[^>]*>Exit<\/button>/);
  assert.match(html, /5 things you can see/);
  assert.match(html, /Step 1 of 5/);
});

test("calm tools home: both tools are links and Exit is present", () => {
  const html = render(React.createElement(CalmToolsHome, { lowSensory: false, onExit: noop }));
  assert.match(html, /href="\/calm-tools\/breathing"/);
  assert.match(html, /href="\/calm-tools\/grounding"/);
  assert.match(html, /<button[^>]*>Exit<\/button>/);
});

test("exit: Escape is the exit key, other keys are not", () => {
  assert.equal(isExitKey("Escape"), true);
  assert.equal(isExitKey("Enter"), false);
  assert.equal(isExitKey(" "), false);
});

test("no autoplay audio on any calm-tool screen", () => {
  for (const html of [
    render(React.createElement(BreathingExercise, { lowSensory: false, onExit: noop })),
    render(React.createElement(GroundingExercise, { lowSensory: false, onExit: noop })),
    render(React.createElement(CalmToolsHome, { lowSensory: false, onExit: noop })),
  ]) {
    assert.doesNotMatch(html, /<audio|<video|autoplay/i);
  }
});

test("a visible notice is shown when the saved preference could not load", () => {
  const html = render(React.createElement(GroundingExercise, { lowSensory: false, onExit: noop, notice: "Could not load" }));
  assert.match(html, /Could not load/);
});

console.log(`\ncalm-tools: ${passed} tests passed`);
