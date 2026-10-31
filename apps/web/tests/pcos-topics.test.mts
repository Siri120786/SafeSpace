/**
 * PCOS / PCOD topics and the personal health tracker: tracker rules (dates,
 * limits, no predictions), the topic wording, and the rendered topics.
 * Run with: tsx apps/web/tests/pcos-topics.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import {
  EMPTY_TRACKER,
  MAX_DAYS,
  MAX_PERIOD_DAYS,
  addQuestion,
  daysBetween,
  describeDay,
  endPeriod,
  isDateKey,
  periodSummary,
  recentSummary,
  removeDay,
  removePeriod,
  sanitizeTracker,
  saveDay,
  startPeriod,
  type TrackerState,
} from "../src/features/wellness-modules/lib/tracker.ts";
import { allTopicTexts, SIGNS } from "../src/features/wellness-modules/lib/topics.ts";
import { isBodyNeutral } from "../src/features/wellness-modules/lib/cycleCare.ts";
import { DoctorTopic, MythsTopic, SleepTopic, SymptomsTopic, TrackerTopic, WellbeingTopic } from "../src/features/wellness-modules/components/PcosTopics.tsx";
import { PcosPcodHub } from "../src/features/wellness-modules/components/PcosScreens.tsx";
import { CycleCare } from "../src/features/wellness-modules/components/ModuleScreens.tsx";

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
const TODAY = "2026-10-25";
const must = (r: { ok: true; state: TrackerState } | { ok: false; error: string }): TrackerState => {
  assert.ok(r.ok, r.ok ? "" : r.error);
  return r.state;
};

// ---- tracker rules ----
test("tracker: dates must be real days, not in the future", () => {
  assert.equal(isDateKey("2026-02-30"), false);
  assert.equal(isDateKey("2026-10-01"), true);
  assert.equal(daysBetween("2026-10-01", "2026-10-29"), 28);
  assert.equal(startPeriod(EMPTY_TRACKER, "2026-10-26", TODAY).ok, false);
  assert.equal(startPeriod(EMPTY_TRACKER, "not a day", TODAY).ok, false);
});

test("tracker: a period opens, closes, and can't overlap or be left open twice", () => {
  let s = must(startPeriod(EMPTY_TRACKER, "2026-09-01", TODAY));
  assert.match(startPeriod(s, "2026-09-20", TODAY).ok ? "" : (startPeriod(s, "2026-09-20", TODAY) as { error: string }).error, /still open/);
  assert.equal(endPeriod(s, "2026-09-01", "2026-08-30", TODAY).ok, false);
  assert.equal(endPeriod(s, "2026-09-01", "2026-10-10", TODAY).ok, false, `more than ${MAX_PERIOD_DAYS} days`);
  s = must(endPeriod(s, "2026-09-01", "2026-09-05", TODAY));
  assert.equal(startPeriod(s, "2026-09-03", TODAY).ok, false);
  s = must(startPeriod(s, "2026-10-01", TODAY));
  assert.deepEqual(s.periods.map((p) => p.start), ["2026-10-01", "2026-09-01"]);
  assert.equal(removePeriod(s, "2026-10-01").periods.length, 1);
});

test("tracker: the summary looks back gently and never predicts", () => {
  assert.match(periodSummary(EMPTY_TRACKER, TODAY), /No periods added yet/);
  let s = must(startPeriod(EMPTY_TRACKER, "2026-08-01", TODAY));
  s = must(endPeriod(s, "2026-08-01", "2026-08-05", TODAY));
  s = must(startPeriod(s, "2026-08-29", TODAY));
  s = must(endPeriod(s, "2026-08-29", "2026-09-02", TODAY));
  s = must(startPeriod(s, "2026-10-12", TODAY));
  const text = periodSummary(s, TODAY);
  assert.match(text, /current period started 13 days ago/);
  assert.match(text, /between 28 and 44 days apart/);
  assert.match(text, /worth mentioning to your doctor/);
  assert.doesNotMatch(text, /next period|expect|predict|late|due/i);
});

test("tracker: a day's notes save, replace, clear and summarise without ranking", () => {
  let s = must(saveDay(EMPTY_TRACKER, TODAY, { mood: "low" }, ["cramps"], TODAY));
  s = must(saveDay(s, TODAY, { mood: "okay", sleep: "good" }, ["cramps", "bloating"], TODAY));
  assert.equal(s.days.length, 1);
  assert.match(describeDay(s.days[0]), /Mood: mixed · Last night's sleep: restful · Cramps · Bloating/);
  assert.match(recentSummary(s, TODAY), /notes on 1 day.*cramps \(1 day\)/);
  assert.doesNotMatch(recentSummary(s, TODAY), /streak|best|worst|score/i);
  assert.equal(must(saveDay(s, TODAY, {}, [], TODAY)).days.length, 0, "an empty day removes it");
  assert.equal(saveDay(s, "2026-11-01", { mood: "low" }, [], TODAY).ok, false);
  assert.equal(removeDay(s, TODAY).days.length, 0);
});

test("tracker: questions use the note rules, and bad saved data is cleaned", () => {
  const s = must(addQuestion(EMPTY_TRACKER, "  Which tests do I need?  "));
  assert.deepEqual(s.questions, ["Which tests do I need?"]);
  assert.equal(addQuestion(s, "which tests do i need?").ok, false);
  const clean = sanitizeTracker({
    periods: [{ start: "2026-10-01", end: "2026-09-01" }, { start: "bad" }, { start: "2026-09-01", end: "2026-09-04" }],
    days: [{ date: "2026-10-02", checkIn: { mood: "awful", sleep: "good" }, symptoms: ["cramps", "unknown"] }],
    questions: ["ok", 5, "ok"],
  });
  assert.deepEqual(clean.periods, [{ start: "2026-10-01", end: null }, { start: "2026-09-01", end: "2026-09-04" }]);
  assert.deepEqual(clean.days[0], { date: "2026-10-02", checkIn: { sleep: "good" }, symptoms: ["cramps"] });
  assert.deepEqual(clean.questions, ["ok"]);
  assert.deepEqual(sanitizeTracker("nonsense"), EMPTY_TRACKER);
  const many = { days: Array.from({ length: MAX_DAYS + 5 }, (_, i) => ({ date: `2025-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`, checkIn: {}, symptoms: ["acne"] })) };
  assert.ok(sanitizeTracker(many).days.length <= MAX_DAYS);
});

// ---- wording ----
test("topics: every line is body-neutral and never blames or shames", () => {
  const SHAMING = /lazy|failed|failure|cheat|guilt|fat|ugly|disappoint|should have|give up/i;
  for (const t of allTopicTexts()) {
    assert.ok(isBodyNeutral(t), `not body-neutral: ${t}`);
    assert.doesNotMatch(t, SHAMING, t);
  }
  assert.ok(SIGNS.length >= 6);
});

// ---- rendered ----
test("topics render with their banners, closed by default except the tracker", () => {
  const myths = render(React.createElement(MythsTopic, { condition: null }));
  assert.match(myths, /What&#x27;s true, and what isn&#x27;t/);
  assert.match(myths, /aria-expanded="false"/);
  assert.match(myths, /Myth: PCOD is a serious disease/);
  assert.match(render(React.createElement(SymptomsTopic)), /Not everyone has all of these/);
  assert.match(render(React.createElement(WellbeingTopic, { base: "/modules" })), /href="\/modules\/calm-space\/breathing"/);
  assert.match(render(React.createElement(SleepTopic, { base: "/modules" })), /Tonight&#x27;s wind-down/);
  assert.match(render(React.createElement(DoctorTopic, {})), /What a check-up may include/);
  const tracker = render(React.createElement(TrackerTopic));
  assert.match(tracker, /aria-expanded="true"/);
  assert.match(tracker, /type="date"/);
  assert.match(tracker, /role="tablist"/);
});

test("the Overview has the four learning topics; Cycle Care has doctor visits and the tracker", () => {
  const hub = render(React.createElement(PcosPcodHub, { lowSensory: false, onExit: () => {}, role: "user" }));
  for (const t of ["Myths and facts", "Understanding symptoms", "Emotional wellbeing", "Sleep and rest"]) assert.match(hub, new RegExp(t));
  assert.doesNotMatch(hub, /My personal health tracker|type="date"/);
  const care = render(React.createElement(CycleCare, { lowSensory: false, onExit: () => {}, role: "user" }));
  for (const t of ["Doctor visits and treatment", "My personal health tracker"]) assert.match(care, new RegExp(t));
  assert.doesNotMatch(care, /Understanding symptoms|Myths and facts/);
});

console.log(`\n${passed} PCOS topic tests passed.`);
