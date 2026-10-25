/**
 * Bright Days (depression): the night garden where small steps let the light
 * in. Run with: tsx apps/web/tests/bright-days.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { BrightDays } from "../src/features/wellness-modules/components/ModuleScreens.tsx";
import { FULL_LIGHT_STEPS, doorTime, lightFor, lightLine } from "../src/features/conditions/depression/door/BrightDaysRoom.tsx";

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
const render = (el: React.ReactElement) => renderToStaticMarkup(React.createElement(StaticRouter, { location: "/" }, el));

test("the light grows with each small step and stops at full", () => {
  assert.equal(lightFor(0), 0);
  assert.equal(lightFor(-2), 0);
  assert.equal(lightFor(Number.NaN), 0);
  assert.ok(lightFor(1) > 0 && lightFor(1) < lightFor(2));
  assert.equal(lightFor(FULL_LIGHT_STEPS), 1);
  assert.equal(lightFor(FULL_LIGHT_STEPS + 4), 1);
});

test("the door's place in the video follows the light, and keeps the last frame", () => {
  assert.equal(doorTime(0, 10), 0);
  assert.equal(doorTime(0.5, 10), 4.975);
  assert.equal(doorTime(1, 10), 9.95);
  assert.equal(doorTime(2, 10), 9.95);
  assert.equal(doorTime(0.5, Number.NaN), 0);
});

test("the light's words are gentle and never count misses", () => {
  assert.match(lightLine(0), /little light in/);
  assert.match(lightLine(1), /1 small step today/);
  assert.match(lightLine(3), /3 small steps today/);
  assert.match(lightLine(FULL_LIGHT_STEPS), /door is open/);
  for (let n = 0; n <= FULL_LIGHT_STEPS + 1; n++) assert.doesNotMatch(lightLine(n), /missed|failed|only|streak|should/i);
});

test("the page: muted videos that never loop or autoplay, the door starts closed, and the goals and notes are there", () => {
  const html = render(React.createElement(BrightDays, { lowSensory: false, onExit: () => {} }));
  const videos = html.match(/<video[^>]*>/g) ?? [];
  assert.equal(videos.length, 2);
  for (const v of videos) {
    assert.match(v, /muted/);
    assert.doesNotMatch(v, /loop|autoplay|controls/i);
  }
  assert.doesNotMatch(html, /<audio/i);
  assert.match(html, /--bd-light:0/);
  for (const t of ["My small goals", "Gratitude notes", "Hobby ideas", "TODAY&#x27;S LIGHT", "not saved yet"]) assert.ok(html.includes(t), t);
});

console.log(`\n${passed} Bright Days tests passed.`);
