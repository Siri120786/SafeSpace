/**
 * Day-strip timeline rules (features/wellness-ui/timelines.ts). Run with:
 * tsx apps/web/tests/timelines.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import {
  GRATITUDE_COLOR,
  JOURNAL_COLOR,
  MOOD_LOOK,
  STEP_COLORS,
  activityLegend,
  activityRows,
  journalRows,
  mostFeltMood,
} from "../src/features/wellness-ui/timelines.ts";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (e) {
    console.log(`FAIL ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

const day = (date: string, o: Partial<{ mood: any; checkins: number; stepsScheduled: number; stepsDone: number; journalEntries: number }> = {}) => ({
  date, mood: o.mood ?? null, checkins: o.checkins ?? (o.mood ? 1 : 0),
  stepsScheduled: o.stepsScheduled ?? 0, stepsDone: o.stepsDone ?? 0, journalEntries: o.journalEntries ?? 0,
});
const week = [
  day("2026-10-20", { mood: "happy", stepsScheduled: 3, stepsDone: 3, journalEntries: 1 }),
  day("2026-10-21", { stepsScheduled: 3, stepsDone: 1 }),
  day("2026-10-22", { mood: "sad", stepsScheduled: 3 }),
  day("2026-10-23", { mood: "happy", stepsScheduled: 3, stepsDone: 3 }),
  day("2026-10-24", {}),
  day("2026-10-25", { mood: "stressed", journalEntries: 2 }),
  day("2026-10-26", { stepsScheduled: 3, stepsDone: 2 }),
];

test("three rows: moods, routine steps, journal, one square per day", () => {
  const rows = activityRows(week);
  assert.deepEqual(rows.map((r) => r.label), ["Mood check-ins", "Routine steps", "Journal"]);
  assert.ok(rows.every((r) => r.days.length === 7 && r.days[0].date === "2026-10-20" && r.days[6].date === "2026-10-26"));
});

test("plain sentences, no scores", () => {
  const [mood, steps, journal] = activityRows(week);
  assert.equal(mood.summary, "Checked in on 4 of 7 days");
  assert.equal(steps.summary, "Did 9 of 15 steps (60%)");
  assert.equal(journal.summary, "Wrote on 2 of 7 days");
});

test("mood days take the mood's colour; empty days stay empty", () => {
  const [mood] = activityRows(week);
  assert.equal(mood.days[0].color, MOOD_LOOK.happy.color);
  assert.equal(mood.days[1].color, null);
  assert.match(mood.days[2].detail, /felt down/);
  assert.match(mood.days[1].detail, /no check-in/);
});

test("routine days shade by how much of the plan was done", () => {
  const [, steps] = activityRows(week);
  assert.equal(steps.days[0].color, STEP_COLORS.all);
  assert.equal(steps.days[1].color, STEP_COLORS.some);
  assert.equal(steps.days[2].color, STEP_COLORS.none);
  assert.equal(steps.days[4].color, null);
  assert.match(steps.days[1].detail, /1 of 3 steps done/);
  assert.match(steps.days[4].detail, /nothing planned/);
});

test("journal days are filled when something was written", () => {
  const [, , journal] = activityRows(week);
  assert.equal(journal.days[5].color, JOURNAL_COLOR);
  assert.match(journal.days[5].detail, /2 entries/);
  assert.match(journal.days[0].detail, /1 entry/);
});

test("an empty period reads kindly, never as zero scores", () => {
  const quiet = ["2026-10-24", "2026-10-25", "2026-10-26"].map((d) => day(d));
  const [mood, steps, journal] = activityRows(quiet);
  assert.equal(mood.summary, "No check-ins yet");
  assert.equal(steps.summary, "No routine steps were planned");
  assert.equal(journal.summary, "Nothing written yet");
  assert.equal(mostFeltMood(quiet), null);
  assert.deepEqual(activityLegend(quiet), []);
  assert.deepEqual(activityRows([]), []);
});

test("most-felt mood, with ties named together", () => {
  assert.equal(mostFeltMood(week), "Felt happy most often");
  assert.equal(mostFeltMood([day("a", { mood: "sad" }), day("b", { mood: "happy" })]), "Felt happy and down most often");
});

test("the colour key lists only moods that appear, plus routine shades when used", () => {
  const labels = activityLegend(week).map((l) => l.label);
  assert.deepEqual(labels, ["Happy", "Down", "Stressed", "All steps done", "Some done"]);
});

test("journal card rows: days written and gratitude days", () => {
  const timeline = [
    { date: "2026-10-24", entries: 0, gratitude: 0 },
    { date: "2026-10-25", entries: 2, gratitude: 1 },
    { date: "2026-10-26", entries: 1, gratitude: 0 },
  ];
  const [wrote, grateful] = journalRows(timeline);
  assert.equal(wrote.summary, "Wrote on 2 of 3 days");
  assert.equal(grateful.summary, "Grateful on 1 of 3 days");
  assert.equal(grateful.days[1].color, GRATITUDE_COLOR);
  assert.equal(grateful.days[2].color, null);
  assert.deepEqual(journalRows([]), []);
});

test("nothing diagnostic in any sentence", () => {
  const text = JSON.stringify([activityRows(week), journalRows([{ date: "2026-10-26", entries: 1, gratitude: 1 }]), mostFeltMood(week)]).toLowerCase();
  assert.doesNotMatch(text, /depress|anxiety|symptom|diagnos|risk|score|disorder|bad day|failed/);
});

console.log(`${passed} timeline checks`);
