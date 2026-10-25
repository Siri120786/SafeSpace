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
import {
  EMPTY_STATE,
  GENERAL_GUIDANCE,
  MEAL_IDEAS,
  addPlanItem,
  allCharacterLines,
  bestStreak,
  characterReaction,
  currentStreak,
  mealIdeasFor,
  refreshDay,
  removePlanItem,
  sanitizeState,
  starsForDay,
  toggleMeal,
  totalStars,
  type DietState,
} from "../src/features/wellness-modules/lib/dietPlan.ts";
import { EMPTY_ASSESSMENT, SUMMARY_NOTE, buildSummary, sanitizeAssessment, validateAssessment } from "../src/features/wellness-modules/lib/healthAssessment.ts";
import { MEDICINE_TITLES, REMINDER_PRIVACY_NOTE, buildMedicineReminder, describeSchedule, dueMedicineAlerts } from "../src/features/wellness-modules/lib/medicineReminders.ts";
import { readJson, writeJson, type KeyValueStore } from "../src/features/wellness-modules/lib/deviceStore.ts";
import {
  ABOUT,
  DIFFERENCES,
  MYTHS,
  TERMS_NOTE,
  allConditionTexts,
  foodFocusFor,
  moveFocusFor,
  mythsFor,
  sanitizeCondition,
  visitQuestionsFor,
} from "../src/features/wellness-modules/lib/condition.ts";
import {
  EMPTY_EXERCISE,
  addEntry,
  allExerciseLines,
  exerciseReaction,
  isLongDay,
  minutesOn,
  parseMinutes,
  planStatus,
  plannedMinutesPerWeek,
  removeEntry,
  sanitizeExercise,
  setPlanDay,
  setWeeklyGoal,
  summarizeWeek,
  weekDates,
  weekMessage,
  weekdayIndex,
  type ExerciseState,
} from "../src/features/wellness-modules/lib/exercise.ts";
import { FoodModule, PcosPcodHub, PhysicalExercise } from "../src/features/wellness-modules/components/PcosScreens.tsx";
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
test("modules: four modules listed and the PCOS / PCOD hub is adult-only", () => {
  assert.deepEqual(MODULES.map((m) => m.key), ["anxiety", "depression", "ptsd", "pcos_pcod"]);
  assert.equal(MODULES.find((m) => m.key === "pcos_pcod")?.path, "/modules/pcos-pcod");
  assert.equal(canOpenCycleCare("user"), true);
  assert.equal(canOpenCycleCare("caregiver"), false);
  assert.equal(canOpenCycleCare(null), false);
});

test("cycle care: caregivers are blocked; adults see the checklist and their own tracker, which never predicts", () => {
  const blocked = render(React.createElement(CycleCare, { ...common, role: "caregiver" }));
  assert.match(blocked, /adult accounts only/);
  assert.doesNotMatch(blocked, /type="checkbox"/);
  const ok = render(React.createElement(CycleCare, { ...common, role: "user" }));
  assert.match(ok, /type="checkbox"/);
  assert.match(ok, /My personal health tracker/);
  assert.match(ok, /does not predict periods or diagnose/);
  assert.match(ok, /only you can see it/);
  assert.match(ok, /href="\/modules\/pcos-pcod"[^>]*>Overview</);
  assert.match(ok, /Go to Exercise/);
  assert.doesNotMatch(ok, /next period (is|will)|predicted|fertile window|ovulation day/i);
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

test("cycle care screen has check-in, medicine notes and reminders and doctor prep, and nothing from the other modules", () => {
  const ok = render(React.createElement(CycleCare, { ...common, role: "user" }));
  assert.match(ok, /How are you today\?/);
  assert.match(ok, /medicine and supplement notes/);
  assert.match(ok, /Medicine and supplement reminders/);
  assert.match(ok, /Sign in with your adult account to set reminders/);
  assert.match(ok, /Doctor visit prep/);
  assert.match(ok, /What a check-up may include/);
  assert.match(ok, /does not set target weights, calorie targets or BMI scores/);
  assert.doesNotMatch(ok, /Diet plan and rewards|Water so far today|Movement for your energy|myths and facts|health profile/i);
  const blocked = render(React.createElement(CycleCare, { ...common, role: "caregiver" }));
  assert.doesNotMatch(blocked, /How are you today/);
});

const SHAMING = /lazy|failed|failure|bad|cheat|guilt|punish|fat|ugly|disappoint|should have|give up/i;
const planned = (): DietState => {
  let st: DietState = { ...EMPTY_STATE };
  for (const [m, t] of [["breakfast", "Oats upma"], ["lunch", "Roti and dal"], ["dinner", "Soup"]] as const) {
    const r = addPlanItem(st.plan, m, t);
    assert.ok(r.ok);
    if (r.ok) st = { ...st, plan: r.plan };
  }
  return refreshDay(st, "2026-10-24");
};

test("diet plan: items are trimmed and rejected when empty, duplicate, long or over the limit", () => {
  assert.equal(addPlanItem(EMPTY_STATE.plan, "lunch", "  ").ok, false);
  const a = addPlanItem(EMPTY_STATE.plan, "lunch", " Roti and dal ");
  assert.ok(a.ok && a.plan.lunch[0] === "Roti and dal");
  if (a.ok) assert.equal(addPlanItem(a.plan, "lunch", "roti AND dal").ok, false);
  assert.equal(addPlanItem(EMPTY_STATE.plan, "snack", "x".repeat(101)).ok, false);
  let plan = EMPTY_STATE.plan;
  for (let i = 0; i < 8; i++) {
    const r = addPlanItem(plan, "snack", `item ${i}`);
    assert.ok(r.ok);
    if (r.ok) plan = r.plan;
  }
  assert.equal(addPlanItem(plan, "snack", "one more").ok, false);
  assert.deepEqual(removePlanItem(plan, "snack", 0).snack.slice(0, 2), ["item 1", "item 2"]);
});

test("diet rewards: a star per ticked meal, a bonus for the whole plan, partial days still count", () => {
  const day = "2026-10-24";
  let st = planned();
  assert.equal(starsForDay(st.days[day]), 0);
  st = toggleMeal(st, "breakfast", day);
  assert.equal(starsForDay(st.days[day]), 1);
  st = toggleMeal(st, "lunch", day);
  st = toggleMeal(st, "dinner", day);
  assert.equal(starsForDay(st.days[day]), 4);
  st = toggleMeal(st, "dinner", day);
  assert.equal(starsForDay(st.days[day]), 2);
  assert.equal(toggleMeal(st, "snack", day), st);
});

test("diet rewards: streak counts complete days and an unfinished today does not erase yesterday", () => {
  const done = { planned: 3, done: 3 };
  const days = { "2026-10-21": done, "2026-10-22": done, "2026-10-23": done, "2026-10-24": { planned: 3, done: 1 } };
  assert.equal(currentStreak(days, "2026-10-24"), 3);
  assert.equal(currentStreak({ ...days, "2026-10-24": done }, "2026-10-24"), 4);
  assert.equal(currentStreak({ "2026-10-20": done }, "2026-10-24"), 0);
  assert.equal(bestStreak({ ...days, "2026-10-18": done, "2026-10-19": done }), 3);
  assert.equal(totalStars(days), 4 + 4 + 4 + 1);
});

test("diet character: celebrates, encourages and nudges kindly, and never shames or mentions the body", () => {
  assert.equal(characterReaction({ planned: 3, done: 3 }, 12, 0).stance, "celebrating");
  assert.match(characterReaction({ planned: 3, done: 3 }, 12, 0).text, /yayyy/i);
  assert.match(characterReaction({ planned: 3, done: 3 }, 12, 4).text, /4 days in a row/);
  assert.equal(characterReaction({ planned: 3, done: 1 }, 12, 0).stance, "happy");
  assert.match(characterReaction({ planned: 3, done: 0 }, 20, 0).text, /try to follow your plan/i);
  assert.match(characterReaction({ planned: 3, done: 0 }, 9, 0).text, /tick a meal/i);
  assert.match(characterReaction(undefined, 9, 0).text, /add a few meals/i);
  for (const line of allCharacterLines()) assert.doesNotMatch(line, SHAMING, line);
  for (const line of [...GENERAL_GUIDANCE, ...MEAL_IDEAS.map((i) => i.text)]) assert.doesNotMatch(line, /calor|BMI|target weight|lose weight|fat loss|slim/i, line);
});

test("diet plan: meal ideas follow the food preference", () => {
  const lunch = (pref: Parameters<typeof mealIdeasFor>[1]) => mealIdeasFor("lunch", pref).map((i) => i.text).join("|");
  assert.match(lunch(null), /fish or chicken/);
  assert.doesNotMatch(lunch("vegetarian"), /fish|chicken/);
  assert.doesNotMatch(mealIdeasFor("breakfast", "vegan").map((i) => i.text).join("|"), /Curd|omelette/);
  assert.match(mealIdeasFor("breakfast", "eggetarian").map((i) => i.text).join("|"), /omelette/);
});

test("device storage: reads and writes safely, even when storage is missing or broken", () => {
  const mem = new Map<string, string>();
  const store: KeyValueStore = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
  assert.equal(writeJson("k", { a: 1 }, store), true);
  assert.deepEqual(readJson("k", null, store), { a: 1 });
  mem.set("bad", "{not json");
  assert.deepEqual(readJson("bad", { ok: true }, store), { ok: true });
  assert.equal(writeJson("k", 1, null), false);
  assert.equal(readJson("k", "fallback", null), "fallback");
  const full: KeyValueStore = { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => {} };
  assert.equal(writeJson("k", 1, full), false);
});

test("diet storage: stored data is sanitised before use", () => {
  assert.deepEqual(sanitizeState("nonsense"), EMPTY_STATE);
  const st = sanitizeState({
    plan: { breakfast: ["Oats", 5, ""], lunch: "bad" },
    ticks: { "2026-10-24": ["breakfast", "dessert"], bad: ["lunch"] },
    days: { "2026-10-24": { planned: 2, done: 5 }, "2026-10-23": { planned: 2, done: 1 } },
    hideRewards: "yes",
  });
  assert.deepEqual(st.plan.breakfast, ["Oats"]);
  assert.deepEqual(st.plan.lunch, []);
  assert.deepEqual(st.ticks, { "2026-10-24": ["breakfast"] });
  assert.deepEqual(st.days, { "2026-10-23": { planned: 2, done: 1 } });
  assert.equal(st.hideRewards, false);
});

test("health profile: every field is optional, numbers are range-checked, and the summary lists only what was shared", () => {
  assert.deepEqual(validateAssessment(EMPTY_ASSESSMENT), []);
  assert.deepEqual(buildSummary(EMPTY_ASSESSMENT), []);
  assert.equal(validateAssessment({ ...EMPTY_ASSESSMENT, weightKg: "abc" }).length, 1);
  assert.equal(validateAssessment({ ...EMPTY_ASSESSMENT, hba1c: "40" }).length, 1);
  assert.equal(validateAssessment({ ...EMPTY_ASSESSMENT, weightKg: "62", waistCm: "78", fastingGlucose: "92", hba1c: "5.4" }).length, 0);
  const s = buildSummary({ ...EMPTY_ASSESSMENT, cycle: "irregular", history: ["thyroid"], weightKg: "62", preference: "vegetarian", goals: ["energy"], allergies: "peanuts" }).join(" ");
  assert.match(s, /Periods: irregular/);
  assert.match(s, /Thyroid condition/);
  assert.match(s, /Body weight: 62 kg/);
  assert.match(s, /Food preference: vegetarian/);
  assert.match(s, /Allergies: peanuts/);
  assert.doesNotMatch(s, /BMI|target|score|overweight|underweight|obese|normal range/i);
  assert.doesNotMatch(buildSummary({ ...EMPTY_ASSESSMENT, goals: ["energy"] }).join(" "), /weight/i);
  assert.match(SUMMARY_NOTE, /not a diagnosis/i);
  assert.deepEqual(sanitizeAssessment({ cycle: "weird", history: ["thyroid", "x"], weightKg: 5, preference: "vegan" }).history, ["thyroid"]);
  assert.equal(sanitizeAssessment({ cycle: "weird" }).cycle, null);
});

test("medicine reminders: the saved title is generic and input is validated", () => {
  const ok = buildMedicineReminder(MEDICINE_TITLES[0], "08:30", [3, 1, 1], "Asia/Kolkata");
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.input.kind, "medication");
    assert.deepEqual(ok.input.daysOfWeek, [1, 3]);
    assert.equal(ok.input.title, "Time for your medicine");
  }
  assert.equal(buildMedicineReminder("Take metformin 500mg", "08:30", [], "Asia/Kolkata").ok, false);
  assert.equal(buildMedicineReminder(MEDICINE_TITLES[0], "8:30", [], "Asia/Kolkata").ok, false);
  assert.equal(buildMedicineReminder(MEDICINE_TITLES[0], "08:30", [9], "Asia/Kolkata").ok, false);
  assert.equal(buildMedicineReminder(MEDICINE_TITLES[0], "08:30", [], "").ok, false);
  assert.equal(describeSchedule({ timeOfDay: "08:30", daysOfWeek: [] }), "08:30, every day");
  assert.equal(describeSchedule({ timeOfDay: "08:30", daysOfWeek: [1, 3] }), "08:30, Mon, Wed");
  assert.match(REMINDER_PRIVACY_NOTE, /never sent anywhere/);
  assert.match(REMINDER_PRIVACY_NOTE, /no phone notifications/);
});

test("medicine reminders: only unacknowledged medication alerts are shown", () => {
  const mk = (kind: string, acknowledged: boolean) => ({ reminder: { id: kind + acknowledged, kind } as never, dueAt: "", occursOn: "2026-10-24", acknowledged });
  assert.equal(dueMedicineAlerts([mk("medication", false), mk("medication", true), mk("water", false)]).length, 1);
});

test("food module: diet plan, rewards, character and water, for adults only", () => {
  const ok = render(React.createElement(FoodModule, { ...common, role: "user" }));
  assert.match(ok, /Diet plan and rewards/);
  assert.match(ok, /General eating tips/);
  assert.match(ok, /Crash diets and skipping meals are not recommended/);
  assert.match(ok, /Write the plan your doctor or dietitian gave you/);
  assert.match(ok, /stars today/);
  assert.match(ok, /Hide stars and streaks/);
  assert.match(ok, /Add a few meals to your plan/);
  assert.match(ok, /Water so far today/);
  assert.match(ok, /saved to your account, so you can come back to them on any device. Only you can see them/);
  assert.doesNotMatch(ok, /<audio|autoplay/i);
  assert.doesNotMatch(render(React.createElement(FoodModule, { ...common, role: "caregiver" })), /Diet plan/);
});

test("pcos / pcod hub: label choice, about, differences, care spaces, health profile and myths, adults only", () => {
  const ok = render(React.createElement(PcosPcodHub, { ...common, role: "user" }));
  assert.match(ok, /What does your doctor call it\?/);
  for (const l of ["PCOS", "PCOD", "Not sure yet"]) assert.match(ok, new RegExp(l));
  assert.match(ok, /About PCOS/);
  assert.match(ok, /About PCOD/);
  assert.match(ok, /PCOD and PCOS at a glance/);
  assert.match(ok, /Ask your doctor which one applies|ask your doctor which one applies/i);
  for (const href of ["/modules/pcos-pcod/cycle-care", "/modules/pcos-pcod/exercise", "/modules/pcos-pcod/food"]) assert.match(ok, new RegExp(`href="${href}"`));
  assert.match(ok, /My health profile/);
  for (const t of ["Menstrual cycle patterns", "Health and medical history", "Body weight", "Fasting blood glucose", "Current eating habits", "Nutritional requirements", "Food preferences", "Individual health goals"]) assert.match(ok, new RegExp(t));
  assert.match(ok, /Show my private summary/);
  assert.match(ok, /does not work out BMI, set a target weight/);
  assert.match(ok, /PCOS and PCOD myths and facts/);
  assert.match(ok, /Myth: PCOD is a serious disease/);
  assert.match(ok, /Myth: Everyone with PCOS has the same symptoms/);
  assert.match(ok, /not medical advice/);
  assert.match(ok, /Clear all my PCOS \/ PCOD data/);
  assert.doesNotMatch(ok, /log (your )?period|last period|cycle day|type="date"/i);
  assert.match(render(React.createElement(PcosPcodHub, { ...common, role: "caregiver" })), /adult accounts only/);
});

test("physical exercise screen: log, yoga, weekly plan and week summary, for adults only", () => {
  const ok = render(React.createElement(PhysicalExercise, { ...common, role: "user" }));
  assert.match(ok, /Movement for your condition/);
  assert.match(ok, /Movement for your energy/);
  assert.match(ok, /Today&#x27;s movement/);
  assert.match(ok, /Add to today/);
  assert.match(ok, /Yoga time/);
  assert.match(ok, /10 min yoga/);
  assert.match(ok, /My weekly workout plan/);
  for (const d of ["Monday", "Wednesday", "Sunday"]) assert.match(ok, new RegExp(d));
  assert.match(ok, /Rest days are part of a healthy week/);
  assert.match(ok, /This week/);
  assert.match(ok, /My own weekly minutes goal \(optional/);
  assert.match(ok, /does not count calories burned/);
  assert.match(ok, /Go to Food/);
  assert.doesNotMatch(ok, /<audio|autoplay/i);
  assert.match(render(React.createElement(PhysicalExercise, { ...common, role: "caregiver" })), /adult accounts only/);
});

test("condition content: PCOS and PCOD each get their own wording, and both get every feature", () => {
  assert.match(ABOUT.pcos.points.join(" "), /hormonal/);
  assert.match(ABOUT.pcod.points.join(" "), /milder/);
  assert.match(TERMS_NOTE, /ask your doctor which one applies/i);
  assert.ok(DIFFERENCES.length >= 4 && DIFFERENCES.every((d) => d.pcos && d.pcod));
  assert.match(visitQuestionsFor("pcos").join(" "), /insulin resistance/);
  assert.doesNotMatch(visitQuestionsFor("pcod").join(" "), /insulin resistance/);
  assert.match(visitQuestionsFor("pcod").join(" "), /periods are becoming more regular/);
  assert.match(visitQuestionsFor(null).join(" "), /Which one applies to me/);
  assert.notDeepEqual(visitQuestionsFor("pcos"), visitQuestionsFor("pcod"));
  assert.notDeepEqual(foodFocusFor("pcos"), foodFocusFor("pcod"));
  assert.match(foodFocusFor("pcos").join(" "), /insulin/);
  assert.notDeepEqual(moveFocusFor("pcos"), moveFocusFor("pcod"));
  assert.match(moveFocusFor("pcos").join(" "), /muscle-strengthening/);
  assert.match(moveFocusFor("pcod").join(" "), /yoga/i);
  // The same set of features for both: every label has questions, food tips and movement tips.
  for (const c of ["pcos", "pcod", "unsure"] as const) {
    assert.ok(visitQuestionsFor(c).length >= 4 && foodFocusFor(c).length >= 2 && moveFocusFor(c).length >= 2 && mythsFor(c).length >= 6);
  }
  assert.equal(sanitizeCondition("pcod"), "pcod");
  assert.equal(sanitizeCondition("other"), null);
});

test("condition myths: shared myths for everyone, PCOD-only and PCOS-only ones only for that label", () => {
  const pcos = mythsFor("pcos").map((m) => m.myth).join("|");
  const pcod = mythsFor("pcod").map((m) => m.myth).join("|");
  assert.match(pcos, /Everyone with PCOS has the same symptoms/);
  assert.doesNotMatch(pcos, /PCOD is a serious disease/);
  assert.match(pcod, /PCOD is a serious disease/);
  assert.doesNotMatch(pcod, /Everyone with PCOS has the same symptoms/);
  assert.equal(mythsFor("unsure").length, MYTHS.length);
  assert.ok(MYTHS.every((m) => m.myth && m.fact));
  assert.ok(PCOS_MYTHS.length >= 5);
});

test("condition wording: never shames, never talks about weight loss or calories, and never diagnoses", () => {
  for (const t of allConditionTexts()) {
    assert.doesNotMatch(t, /calor|BMI|target weight|lose weight|weight loss|fat loss|slim down|diagnos(e|ed) you|you have (PCOS|PCOD)/i, t);
  }
});

test("exercise: logging validates minutes and activity, and sums per day and per week (Monday to Sunday)", () => {
  const mon = "2026-10-26";
  assert.equal(parseMinutes(" 25 "), 25);
  assert.equal(parseMinutes("0"), null);
  assert.equal(parseMinutes("301"), null);
  assert.equal(parseMinutes("abc"), null);
  assert.equal(addEntry(EMPTY_EXERCISE, mon, "walk", 0).ok, false);
  assert.equal(addEntry(EMPTY_EXERCISE, mon, "swim" as never, 10).ok, false);
  let st: ExerciseState = EMPTY_EXERCISE;
  for (const [d, t, m] of [[mon, "walk", 20], [mon, "yoga", 30], ["2026-10-28", "yoga", 20], ["2026-11-01", "strength", 15], ["2026-11-02", "walk", 60]] as const) {
    const r = addEntry(st, d, t, m);
    assert.ok(r.ok);
    if (r.ok) st = r.state;
  }
  assert.equal(weekdayIndex("2026-10-26"), 0);
  assert.equal(weekdayIndex("2026-11-01"), 6);
  assert.deepEqual(weekDates("2026-10-29")[0], "2026-10-26");
  assert.deepEqual(weekDates("2026-10-29")[6], "2026-11-01");
  assert.equal(minutesOn(st, mon), 50);
  assert.equal(minutesOn(st, mon, "yoga"), 30);
  const w = summarizeWeek(st, "2026-10-29");
  assert.equal(w.totalMinutes, 85);
  assert.equal(w.yogaMinutes, 50);
  assert.equal(w.daysActive, 3);
  assert.equal(summarizeWeek(st, "2026-11-02").totalMinutes, 60);
  assert.equal(removeEntry(st, 0).log.length, 4);
});

test("exercise: weekly plan, rest days and the plan status follow what was logged", () => {
  const mon = "2026-10-26";
  const tue = "2026-10-27";
  const planned = setPlanDay(EMPTY_EXERCISE, 0, { type: "walk", minutes: 20 });
  assert.ok(planned.ok);
  if (!planned.ok) return;
  assert.equal(setPlanDay(planned.state, 9, null).ok, false);
  assert.equal(setPlanDay(planned.state, 1, { type: "walk", minutes: 0 }).ok, false);
  assert.equal(planStatus(planned.state, mon), "todo");
  assert.equal(planStatus(planned.state, tue), "rest");
  const part = addEntry(planned.state, mon, "walk", 10);
  assert.ok(part.ok);
  if (!part.ok) return;
  assert.equal(planStatus(part.state, mon), "partly");
  const other = addEntry(part.state, mon, "yoga", 40);
  assert.ok(other.ok);
  if (other.ok) assert.equal(planStatus(other.state, mon), "partly");
  const done = addEntry(part.state, mon, "walk", 10);
  assert.ok(done.ok);
  if (done.ok) {
    assert.equal(planStatus(done.state, mon), "done");
    assert.equal(plannedMinutesPerWeek(done.state.plan), 20);
    assert.equal(setPlanDay(done.state, 0, null).ok && planStatus((setPlanDay(done.state, 0, null) as { state: ExerciseState }).state, mon), "rest");
  }
});

test("exercise: weekly goal is optional and validated, and messages never rank, shame or mention the body", () => {
  assert.deepEqual(setWeeklyGoal(EMPTY_EXERCISE, "").ok && (setWeeklyGoal(EMPTY_EXERCISE, "") as { state: ExerciseState }).state.weeklyGoal, null);
  assert.equal(setWeeklyGoal(EMPTY_EXERCISE, "150").ok, true);
  assert.equal(setWeeklyGoal(EMPTY_EXERCISE, "5").ok, false);
  assert.equal(setWeeklyGoal(EMPTY_EXERCISE, "99999").ok, false);
  assert.equal(setWeeklyGoal(EMPTY_EXERCISE, "abc").ok, false);
  const mon = "2026-10-26";
  assert.match(weekMessage(EMPTY_EXERCISE, mon), /even a short stretch counts/i);
  assert.match(weekMessage({ log: [{ date: mon, type: "yoga", minutes: 30 }], plan: {}, weeklyGoal: 30 }, mon), /reached the goal you set/);
  assert.match(weekMessage({ log: [{ date: mon, type: "yoga", minutes: 30 }], plan: {}, weeklyGoal: 100 }, mon), /30 of those were yoga/);
  assert.match(exerciseReaction({ log: [{ date: mon, type: "walk", minutes: 20 }], plan: { 0: { type: "walk", minutes: 20 } }, weeklyGoal: null }, mon, 12).text, /yayyy/i);
  assert.equal(exerciseReaction({ log: [{ date: mon, type: "walk", minutes: 20 }], plan: { 0: { type: "walk", minutes: 20 } }, weeklyGoal: null }, mon, 12).stance, "celebrating");
  assert.match(exerciseReaction({ log: [], plan: {}, weeklyGoal: null }, mon, 10).text, /rest day/i);
  assert.match(exerciseReaction({ log: [{ date: mon, type: "walk", minutes: 250 }], plan: {}, weeklyGoal: null }, mon, 12).text, /rest/i);
  assert.equal(isLongDay({ log: [{ date: mon, type: "walk", minutes: 181 }], plan: {}, weeklyGoal: null }, mon), true);
  for (const line of allExerciseLines()) assert.doesNotMatch(line, /lazy|failed|failure|bad|cheat|guilt|punish|fat|ugly|disappoint|behind|should have|give up|calor|weight|BMI|burn/i, line);
});

test("exercise: stored data is sanitised before use", () => {
  assert.deepEqual(sanitizeExercise("nonsense"), EMPTY_EXERCISE);
  const st = sanitizeExercise({
    log: [{ date: "2026-10-26", type: "yoga", minutes: 30 }, { date: "bad", type: "yoga", minutes: 30 }, { date: "2026-10-26", type: "swim", minutes: 30 }, { date: "2026-10-26", type: "walk", minutes: 9999 }],
    plan: { 0: { type: "walk", minutes: 20 }, 9: { type: "walk", minutes: 20 }, 1: { type: "bad", minutes: 20 } },
    weeklyGoal: 5,
  });
  assert.equal(st.log.length, 1);
  assert.deepEqual(Object.keys(st.plan), ["0"]);
  assert.equal(st.weeklyGoal, null);
  assert.equal(sanitizeExercise({ weeklyGoal: 150 }).weeklyGoal, 150);
});

test("every module screen has Exit, the review notice and the not-saved warning", () => {
  const screens = [
    render(React.createElement(CalmSpace, common)),
    render(React.createElement(BrightDays, common)),
    render(React.createElement(SafeHarbor, common)),
    render(React.createElement(CycleCare, { ...common, role: "user" })),
    render(React.createElement(PhysicalExercise, { ...common, role: "user" })),
    render(React.createElement(FoodModule, { ...common, role: "user" })),
    render(React.createElement(PcosPcodHub, { ...common, role: "user" })),
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

test("modules home lists all modules and links caregivers to Stories", () => {
  const html = render(React.createElement(ModulesHome, common));
  for (const m of MODULES) assert.ok(html.includes(`href="${m.path}"`));
  assert.match(html, /href="\/caregiver\/stories"/);
});

test("no module screen claims an alert was sent or uses audio", () => {
  const all = [
    render(React.createElement(CalmSpace, common)),
    render(React.createElement(BrightDays, common)),
    render(React.createElement(SafeHarbor, common)),
    render(React.createElement(CycleCare, { ...common, role: "user" })),
    render(React.createElement(PcosPcodHub, { ...common, role: "user" })),
    render(React.createElement(PhysicalExercise, { ...common, role: "user" })),
    render(React.createElement(FoodModule, { ...common, role: "user" })),
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
