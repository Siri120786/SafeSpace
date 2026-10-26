// Pure rules for the day-strip timelines: day counts in, rows with
// plain-language sentences out. No React or network here, so
// apps/web/tests/timelines.test.mts can check them. Sentences describe what
// happened ("Checked in on 5 of 7 days"); never a score, label or judgement.
import type { JournalDay, MoodValue, WellnessDay } from "@safespace/shared-types";
import type { StripRow } from "../../components/ui/DayStrip";
import { formatStripDate } from "../../components/ui/DayStrip";

export const MOOD_LOOK: Record<MoodValue, { label: string; color: string }> = {
  ecstatic: { label: "Ecstatic", color: "#F7C948" },
  happy: { label: "Happy", color: "#8DA568" },
  neutral: { label: "Okay", color: "#C7BCA5" },
  sad: { label: "Down", color: "#6D9EEB" },
  stressed: { label: "Stressed", color: "#B4A7D6" },
  overwhelmed: { label: "Overwhelmed", color: "#E69138" },
};

// Routine days: how much of the day's plan was done.
export const STEP_COLORS = { none: "#E4ECDC", some: "#A9C98F", all: "#4F8A3C" } as const;
export const JOURNAL_COLOR = "#5BA4A4";
export const GRATITUDE_COLOR = "#F2B84B";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const pct = (done: number, total: number) => Math.round((done / total) * 100);

function moodRow(days: WellnessDay[]): StripRow {
  const withCheckin = days.filter((d) => d.checkins > 0).length;
  return {
    label: "Mood check-ins",
    summary: withCheckin === 0 ? "No check-ins yet" : `Checked in on ${withCheckin} of ${days.length} days`,
    days: days.map((d) => ({
      date: d.date,
      color: d.mood ? MOOD_LOOK[d.mood].color : null,
      detail: `${formatStripDate(d.date)}: ${d.mood ? `felt ${MOOD_LOOK[d.mood].label.toLowerCase()}` : "no check-in"}`,
    })),
  };
}

function routineRow(days: WellnessDay[]): StripRow {
  const planned = days.reduce((n, d) => n + d.stepsScheduled, 0);
  const done = days.reduce((n, d) => n + Math.min(d.stepsDone, d.stepsScheduled || d.stepsDone), 0);
  return {
    label: "Routine steps",
    summary: planned === 0 ? "No routine steps were planned" : `Did ${done} of ${plural(planned, "step")} (${pct(done, planned)}%)`,
    days: days.map((d) => {
      const color = d.stepsScheduled === 0
        ? null
        : d.stepsDone >= d.stepsScheduled ? STEP_COLORS.all : d.stepsDone > 0 ? STEP_COLORS.some : STEP_COLORS.none;
      const what = d.stepsScheduled === 0 ? "nothing planned" : `${d.stepsDone} of ${plural(d.stepsScheduled, "step")} done`;
      return { date: d.date, color, detail: `${formatStripDate(d.date)}: ${what}` };
    }),
  };
}

function journalRow(days: { date: string; entries: number }[]): StripRow {
  const wrote = days.filter((d) => d.entries > 0).length;
  return {
    label: "Journal",
    summary: wrote === 0 ? "Nothing written yet" : `Wrote on ${wrote} of ${days.length} days`,
    days: days.map((d) => ({
      date: d.date,
      color: d.entries > 0 ? JOURNAL_COLOR : null,
      detail: `${formatStripDate(d.date)}: ${d.entries > 0 ? plural(d.entries, "entry", "entries") : "nothing written"}`,
    })),
  };
}

/** The caregiver's "Recent activity" rows for a child. */
export function activityRows(days: WellnessDay[]): StripRow[] {
  if (days.length === 0) return [];
  return [moodRow(days), routineRow(days), journalRow(days.map((d) => ({ date: d.date, entries: d.journalEntries })))];
}

/** The colour key for the moods that actually appear, plus the routine shades when used. */
export function activityLegend(days: WellnessDay[]): { color: string; label: string }[] {
  const moods = (Object.keys(MOOD_LOOK) as MoodValue[]).filter((m) => days.some((d) => d.mood === m));
  const legend = moods.map((m) => ({ color: MOOD_LOOK[m].color, label: MOOD_LOOK[m].label }));
  if (days.some((d) => d.stepsScheduled > 0)) {
    legend.push({ color: STEP_COLORS.all, label: "All steps done" }, { color: STEP_COLORS.some, label: "Some done" });
  }
  return legend;
}

/** "Felt happy most often" from the days' moods, or null with no check-ins. */
export function mostFeltMood(days: WellnessDay[]): string | null {
  const counts = new Map<MoodValue, number>();
  for (const d of days) if (d.mood) counts.set(d.mood, (counts.get(d.mood) ?? 0) + 1);
  if (counts.size === 0) return null;
  const top = Math.max(...counts.values());
  const tied = (Object.keys(MOOD_LOOK) as MoodValue[]).filter((m) => counts.get(m) === top);
  const words = tied.map((m) => MOOD_LOOK[m].label.toLowerCase());
  return `Felt ${words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : words[0]} most often`;
}

/** The journal card's rows: days written and days with gratitude. */
export function journalRows(timeline: JournalDay[]): StripRow[] {
  if (timeline.length === 0) return [];
  const grateful = timeline.filter((d) => d.gratitude > 0).length;
  return [
    journalRow(timeline),
    {
      label: "Gratitude",
      summary: grateful === 0 ? "No gratitude entries yet" : `Grateful on ${grateful} of ${timeline.length} days`,
      days: timeline.map((d) => ({
        date: d.date,
        color: d.gratitude > 0 ? GRATITUDE_COLOR : null,
        detail: `${formatStripDate(d.date)}: ${d.gratitude > 0 ? plural(d.gratitude, "gratitude entry", "gratitude entries") : "no gratitude entry"}`,
      })),
    },
  ];
}
