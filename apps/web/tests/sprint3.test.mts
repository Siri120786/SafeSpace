/**
 * Sprint 3 (Thrisha) tests: story workflow rules, module content rules and
 * rendered screens. Run with: tsx apps/web/tests/sprint3.test.mts (part of `pnpm test`).
 * Also includes cross-feature regression checks for the calm tools.
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import {
  approveStory,
  canRead,
  createDraft,
  rejectStory,
  submitForApproval,
  validateStory,
} from "../src/features/story-workflow/lib/storyWorkflow.ts";
import { MODULES, PCOS_MYTHS, canOpenCycleCare, SUPPORT_TEXT } from "../src/features/wellness-modules/lib/content.ts";
import { StoryWorkflow } from "../src/features/story-workflow/components/StoryWorkflow.tsx";
import {
  BODY_KINDNESS_TEXT,
  CYCLE_CARE_TEXTS,
  MAX_ITEMS,
  MAX_ITEM_LENGTH,
  MAX_WATER,
  MOVEMENT_BY_ENERGY,
  addNote,
  bumpWater,
  describeCheckIn,
  isBodyNeutral,
  removeNote,
  summarizeCheckIns,
} from "../src/features/wellness-modules/lib/cycleCare.ts";
import { BrightDays, CalmSpace, CycleCare, ModulesHome, SafeHarbor } from "../src/features/wellness-modules/components/ModuleScreens.tsx";
import { BreathingExercise } from "../src/features/calm-tools/components/BreathingExercise.tsx";
import { GroundingExercise } from "../src/features/calm-tools/components/GroundingExercise.tsx";

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
const common = { lowSensory: false, onExit: noop };
const GOOD_BODY = "Once there was a small bird who learned to wait for the rain to stop. Then it flew home.";

// ---- story workflow ----
test("story: valid draft passes, empty or short ones are rejected with a clear message", () => {
  assert.deepEqual(validateStory("A kind day", GOOD_BODY), []);
  assert.match(validateStory("", GOOD_BODY)[0], /title/i);
  assert.match(validateStory("Title", "too short")[0], /at least/i);
});

test("story: flagged wording blocks sending for approval", () => {
  const issues = validateStory("Title", GOOD_BODY + " I hate yourself.".replace("I hate yourself", "You should hurt yourself"));
  assert.ok(issues.some((i) => /gentler/.test(i)));
});

test("story: full path draft -> pending -> approved -> readable", () => {
  const draft = createDraft("s1", "A kind day", GOOD_BODY);
  assert.equal(canRead(draft), false);
  const sent = submitForApproval(draft);
  assert.ok(sent.ok && sent.story.status === "pending_approval");
  if (!sent.ok) return;
  const approved = approveStory(sent.story, true);
  assert.ok(approved.ok && approved.story.status === "approved" && canRead(approved.story));
});

test("story: only a caregiver can approve or reject", () => {
  const sent = submitForApproval(createDraft("s1", "A kind day", GOOD_BODY));
  assert.ok(sent.ok);
  if (!sent.ok) return;
  assert.equal(approveStory(sent.story, false).ok, false);
  assert.equal(rejectStory(sent.story, false, "Change it").ok, false);
});

test("story: cannot skip approval, and rejecting needs a reason", () => {
  const draft = createDraft("s1", "A kind day", GOOD_BODY);
  assert.equal(approveStory(draft, true).ok, false);
  const sent = submitForApproval(draft);
  assert.ok(sent.ok);
  if (!sent.ok) return;
  assert.equal(rejectStory(sent.story, true, "   ").ok, false);
  const rej = rejectStory(sent.story, true, "Make it shorter");
  assert.ok(rej.ok && rej.story.status === "rejected" && rej.story.rejectionReason === "Make it shorter");
  if (!rej.ok) return;
  assert.equal(canRead(rej.story), false);
  assert.ok(submitForApproval(rej.story).ok);
});

test("story screen: non-caregivers cannot write or approve", () => {
  const html = render(React.createElement(StoryWorkflow, { ...common, isCaregiver: false }));
  assert.match(html, /is for caregivers/);
  assert.doesNotMatch(html, /Save draft/);
});

test("story screen: caregiver sees the form, the not-saved warning and Exit", () => {
  const html = render(React.createElement(StoryWorkflow, { ...common, isCaregiver: true }));
  assert.match(html, /Save draft/);
  assert.match(html, /not saved yet/);
  assert.match(html, /<button[^>]*>Exit<\/button>/);
});

// ---- modules ----
test("modules: four modules listed and Cycle Care is adult-only", () => {
  assert.deepEqual(MODULES.map((m) => m.key), ["anxiety", "depression", "ptsd", "pcos_pcod"]);
  assert.equal(canOpenCycleCare("user"), true);
  assert.equal(canOpenCycleCare("caregiver"), false);
  assert.equal(canOpenCycleCare(null), false);
});

test("cycle care: caregivers are blocked, adults see the checklist and no cycle tracking", () => {
  const blocked = render(React.createElement(CycleCare, { ...common, role: "caregiver" }));
  assert.match(blocked, /adult accounts only/);
  assert.doesNotMatch(blocked, /type="checkbox"/);
  const ok = render(React.createElement(CycleCare, { ...common, role: "user" }));
  assert.match(ok, /type="checkbox"/);
  assert.match(ok, /no cycle tracking/i);
  assert.match(ok, /PCOS myths and facts/);
  assert.match(ok, /Myth: .*cysts/);
  assert.match(ok, /not medical advice/);
  assert.ok(PCOS_MYTHS.length >= 5 && PCOS_MYTHS.every((m) => m.myth && m.fact));
  assert.doesNotMatch(ok, /log (your )?period|last period|cycle day|type="date"/i);
});

test("cycle care extras: check-in wording is gentle and the summary never ranks or streaks", () => {
  assert.match(describeCheckIn({}), /skipping is always fine/i);
  assert.match(describeCheckIn({ energy: "low", sleep: "good" }), /energy: running low.*restful/i);
  assert.match(summarizeCheckIns([]), /no check-ins yet/i);
  assert.match(summarizeCheckIns([{ energy: "good" }]), /1 time /);
  assert.match(summarizeCheckIns([{ comfort: "low" }, { comfort: "low" }]), /mention it to your doctor/i);
  assert.doesNotMatch(summarizeCheckIns([{ mood: "good" }, { mood: "good" }]), /streak|best|worst|score|goal/i);
  for (const lv of ["low", "okay", "good"] as const) assert.ok(MOVEMENT_BY_ENERGY[lv].length >= 3);
});

test("cycle care extras: note lists trim, reject empty, duplicates, long text and full lists", () => {
  assert.deepEqual(addNote([], "  Ask about tests  "), { ok: true, items: ["Ask about tests"] });
  assert.equal(addNote([], "   ").ok, false);
  assert.equal(addNote(["Vitamin D"], "vitamin d").ok, false);
  assert.equal(addNote([], "x".repeat(MAX_ITEM_LENGTH + 1)).ok, false);
  const full = Array.from({ length: MAX_ITEMS }, (_, i) => `n${i}`);
  assert.equal(addNote(full, "one more").ok, false);
  assert.deepEqual(removeNote(["a", "b", "c"], 1), ["a", "c"]);
});

test("cycle care extras: water tally has no target, never goes below 0 and stops at a sane limit", () => {
  assert.equal(bumpWater(0, -1), 0);
  assert.equal(bumpWater(2, 1), 3);
  assert.equal(bumpWater(MAX_WATER, 1), MAX_WATER);
});

test("cycle care extras: wording is body-neutral (no weight, calories, diets or streaks)", () => {
  for (const text of CYCLE_CARE_TEXTS) assert.ok(isBodyNeutral(text), `not body-neutral: ${text}`);
  assert.equal(isBodyNeutral("Track your calories"), false);
  assert.equal(isBodyNeutral("Keep your streak going"), false);
  assert.equal(isBodyNeutral(BODY_KINDNESS_TEXT), true);
});

test("cycle care screen shows the new adult features and still has no cycle tracking", () => {
  const ok = render(React.createElement(CycleCare, { ...common, role: "user" }));
  assert.match(ok, /How are you today\?/);
  assert.match(ok, /Movement for your energy/);
  assert.match(ok, /Water so far today/);
  assert.match(ok, /medicine and supplement notes/);
  assert.match(ok, /Doctor visit prep/);
  assert.match(ok, /does not track weight, calories or body size/);
  assert.match(ok, /no goal to reach/i);
  assert.doesNotMatch(ok, /log (your )?period|last period|cycle day|type="date"|streak/i);
  const blocked = render(React.createElement(CycleCare, { ...common, role: "caregiver" }));
  assert.doesNotMatch(blocked, /How are you today/);
});

test("every module screen has Exit, the review notice and the not-saved warning", () => {
  const screens = [
    render(React.createElement(CalmSpace, common)),
    render(React.createElement(BrightDays, common)),
    render(React.createElement(SafeHarbor, common)),
    render(React.createElement(CycleCare, { ...common, role: "user" })),
  ];
  for (const html of screens) {
    assert.match(html, /<button[^>]*>Exit<\/button>/);
    assert.match(html, /waiting for a professional review/);
    assert.match(html, /not saved yet/);
    assert.match(html, /trusted adult/);
  }
});

test("safe harbor is always low-sensory, even when the setting is off", () => {
  const html = render(React.createElement(SafeHarbor, { ...common, lowSensory: false }));
  assert.match(html, /data-low-sensory="true"/);
});

test("modules home lists all modules and the story workflow", () => {
  const html = render(React.createElement(ModulesHome, common));
  for (const m of MODULES) assert.ok(html.includes(`href="${m.path}"`));
  assert.match(html, /href="\/story-workflow"/);
});

test("no module screen claims an alert was sent or uses audio", () => {
  const all = [
    render(React.createElement(CalmSpace, common)),
    render(React.createElement(BrightDays, common)),
    render(React.createElement(SafeHarbor, common)),
    render(React.createElement(CycleCare, { ...common, role: "user" })),
    render(React.createElement(StoryWorkflow, { ...common, isCaregiver: true })),
  ].join("\n");
  assert.doesNotMatch(all, /<audio|<video|autoplay/i);
  assert.doesNotMatch(all, /alert (was )?sent|notified your/i);
  assert.match(SUPPORT_TEXT, /cannot call anyone/);
});

// ---- regression: Sprint 2 calm tools still behave ----
test("regression: calm tools still render with Exit and no audio", () => {
  const b = render(React.createElement(BreathingExercise, common));
  const g = render(React.createElement(GroundingExercise, common));
  for (const html of [b, g]) {
    assert.match(html, /<button[^>]*>Exit<\/button>/);
    assert.doesNotMatch(html, /<audio|autoplay/i);
  }
  assert.match(b, /<button[^>]*>Start<\/button>/);
});

console.log(`\nsprint3: ${passed} tests passed`);
