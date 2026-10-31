// My personal health tracker (Cycle Care): period start and end dates,
// optional notes for a day (the check-in levels plus symptoms) and questions
// to take to appointments. Saved to the person's account as the "tracker"
// part (migration 20261030100000); only they can see it.
//
// It records and looks back. It does not predict periods, diagnose, rank
// days or keep streaks.

import { CHECKIN_FIELDS, LEVELS, addNote, removeNote, type CheckIn, type Level } from "./cycleCare";
import { dateKey } from "./exercise";

export interface Period {
  start: string; // YYYY-MM-DD
  end: string | null; // null while it is still going
}

export type SymptomId = "cramps" | "bloating" | "acne" | "headache" | "tiredness" | "mood" | "heavy" | "spotting" | "cravings";

export const SYMPTOMS: readonly { id: SymptomId; label: string }[] = [
  { id: "cramps", label: "Cramps" },
  { id: "bloating", label: "Bloating" },
  { id: "acne", label: "Skin breakouts" },
  { id: "headache", label: "Headache" },
  { id: "tiredness", label: "Tiredness" },
  { id: "mood", label: "Mood changes" },
  { id: "heavy", label: "Heavy flow" },
  { id: "spotting", label: "Spotting" },
  { id: "cravings", label: "Cravings" },
];

export interface DayNote {
  date: string;
  checkIn: CheckIn;
  symptoms: SymptomId[];
}

export interface TrackerState {
  periods: Period[]; // newest first
  days: DayNote[]; // newest first
  questions: string[];
}

export const EMPTY_TRACKER: TrackerState = { periods: [], days: [], questions: [] };

// Enough for several years of periods and a year of notes; the oldest go first.
export const MAX_PERIODS = 60;
export const MAX_DAYS = 370;
// A period longer than this is almost certainly a typing slip.
export const MAX_PERIOD_DAYS = 30;

export type TrackerResult = { ok: true; state: TrackerState } | { ok: false; error: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date in YYYY-MM-DD form. */
export function isDateKey(s: unknown): s is string {
  if (typeof s !== "string" || !DATE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Whole days from a to b (b later is positive). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

const newestFirst = <T extends { start?: string; date?: string }>(a: T, b: T) =>
  (b.start ?? b.date ?? "").localeCompare(a.start ?? a.date ?? "");

/** Adds a period that started on `start` (today or earlier). */
export function startPeriod(state: TrackerState, start: string, today: string = dateKey()): TrackerResult {
  if (!isDateKey(start)) return { ok: false, error: "Please choose the day it started." };
  if (start > today) return { ok: false, error: "That day hasn't happened yet." };
  if (state.periods.some((p) => p.end === null)) return { ok: false, error: "Your last period is still open. Add the day it ended first." };
  if (state.periods.some((p) => p.start === start)) return { ok: false, error: "That start day is already in your tracker." };
  if (state.periods.some((p) => p.end && start >= p.start && start <= p.end)) {
    return { ok: false, error: "That day is inside a period you already added." };
  }
  const periods = [{ start, end: null }, ...state.periods].sort(newestFirst).slice(0, MAX_PERIODS);
  return { ok: true, state: { ...state, periods } };
}

/** Closes the open period (or corrects an end day). */
export function endPeriod(state: TrackerState, start: string, end: string, today: string = dateKey()): TrackerResult {
  const i = state.periods.findIndex((p) => p.start === start);
  if (i < 0) return { ok: false, error: "That period isn't in your tracker." };
  if (!isDateKey(end)) return { ok: false, error: "Please choose the day it ended." };
  if (end > today) return { ok: false, error: "That day hasn't happened yet." };
  if (end < start) return { ok: false, error: "The end can't be before the start." };
  if (daysBetween(start, end) + 1 > MAX_PERIOD_DAYS) return { ok: false, error: `Please check the dates: that is more than ${MAX_PERIOD_DAYS} days.` };
  const periods = state.periods.map((p, j) => (j === i ? { ...p, end } : p));
  return { ok: true, state: { ...state, periods } };
}

export function removePeriod(state: TrackerState, start: string): TrackerState {
  return { ...state, periods: state.periods.filter((p) => p.start !== start) };
}

/** Saves the notes for a day, replacing any already saved for it. An empty note removes the day. */
export function saveDay(state: TrackerState, date: string, checkIn: CheckIn, symptoms: readonly SymptomId[], today: string = dateKey()): TrackerResult {
  if (!isDateKey(date)) return { ok: false, error: "Please choose a day." };
  if (date > today) return { ok: false, error: "That day hasn't happened yet." };
  const clean = cleanCheckIn(checkIn);
  const syms = SYMPTOMS.map((s) => s.id).filter((id) => symptoms.includes(id));
  const others = state.days.filter((d) => d.date !== date);
  if (Object.keys(clean).length === 0 && syms.length === 0) return { ok: true, state: { ...state, days: others } };
  const days = [{ date, checkIn: clean, symptoms: syms }, ...others].sort(newestFirst).slice(0, MAX_DAYS);
  return { ok: true, state: { ...state, days } };
}

export function removeDay(state: TrackerState, date: string): TrackerState {
  return { ...state, days: state.days.filter((d) => d.date !== date) };
}

export function addQuestion(state: TrackerState, text: string): TrackerResult {
  const r = addNote(state.questions, text);
  return r.ok ? { ok: true, state: { ...state, questions: r.items } } : r;
}

export function removeQuestion(state: TrackerState, index: number): TrackerState {
  return { ...state, questions: removeNote(state.questions, index) };
}

export function dayNoteFor(state: TrackerState, date: string): DayNote | undefined {
  return state.days.find((d) => d.date === date);
}

export function symptomLabel(id: SymptomId): string {
  return SYMPTOMS.find((s) => s.id === id)?.label ?? id;
}

/** "Energy: steady · Cramps" for one saved day. */
export function describeDay(d: DayNote): string {
  const levels = CHECKIN_FIELDS.filter((f) => d.checkIn[f.id]).map((f) => `${f.label}: ${f.options[LEVELS.indexOf(d.checkIn[f.id] as Level)].toLowerCase()}`);
  return [...levels, ...d.symptoms.map(symptomLabel)].join(" · ");
}

/**
 * A gentle look back at the period dates: how long ago the last one started
 * and how far apart recent ones began. Never a prediction.
 */
export function periodSummary(state: TrackerState, today: string = dateKey()): string {
  const [last, ...earlier] = state.periods;
  if (!last) return "No periods added yet. Add one whenever you like; everything here is optional.";
  const since = daysBetween(last.start, today);
  const lastLine =
    last.end === null
      ? `Your current period started ${since === 0 ? "today" : since === 1 ? "yesterday" : `${since} days ago`}.`
      : `Your last period started ${since === 0 ? "today" : since === 1 ? "yesterday" : `${since} days ago`} and lasted ${daysBetween(last.start, last.end) + 1} ${daysBetween(last.start, last.end) === 0 ? "day" : "days"}.`;
  if (earlier.length === 0) return `${lastLine} Add more periods over time to see how far apart they are.`;
  const gaps = state.periods.slice(0, 4).flatMap((p, i, arr) => (i + 1 < arr.length ? [daysBetween(arr[i + 1].start, p.start)] : []));
  const lo = Math.min(...gaps);
  const hi = Math.max(...gaps);
  const apart = lo === hi ? `${lo} days apart` : `between ${lo} and ${hi} days apart`;
  const count = gaps.length + 1;
  const worth = hi > 35 || lo < 21 ? " Gaps shorter than about 21 days or longer than about 35 are worth mentioning to your doctor." : "";
  return `${lastLine} Your last ${count} periods started ${apart}.${worth}`;
}

/** A neutral count of what was noted in the last 30 days, for a doctor visit. */
export function recentSummary(state: TrackerState, today: string = dateKey()): string {
  const recent = state.days.filter((d) => {
    const ago = daysBetween(d.date, today);
    return ago >= 0 && ago < 30;
  });
  if (recent.length === 0) return "Nothing noted in the last 30 days.";
  const counts = new Map<SymptomId, number>();
  for (const d of recent) for (const s of d.symptoms) counts.set(s, (counts.get(s) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const days = `You added notes on ${recent.length} ${recent.length === 1 ? "day" : "days"} in the last 30 days.`;
  if (top.length === 0) return days;
  return `${days} Noted most often: ${top.map(([id, n]) => `${symptomLabel(id).toLowerCase()} (${n} ${n === 1 ? "day" : "days"})`).join(", ")}.`;
}

function cleanCheckIn(raw: unknown): CheckIn {
  const out: CheckIn = {};
  if (!raw || typeof raw !== "object") return out;
  for (const f of CHECKIN_FIELDS) {
    const v = (raw as Record<string, unknown>)[f.id];
    if (LEVELS.includes(v as Level)) out[f.id] = v as Level;
  }
  return out;
}

/** Whatever came back from the account (or nothing), as a safe TrackerState. */
export function sanitizeTracker(raw: unknown): TrackerState {
  if (!raw || typeof raw !== "object") return EMPTY_TRACKER;
  const r = raw as Record<string, unknown>;
  const periods: Period[] = [];
  for (const p of Array.isArray(r.periods) ? r.periods : []) {
    if (!p || typeof p !== "object") continue;
    const { start, end } = p as Record<string, unknown>;
    if (!isDateKey(start) || periods.some((x) => x.start === start)) continue;
    const okEnd = isDateKey(end) && end >= start && daysBetween(start, end) < MAX_PERIOD_DAYS ? end : null;
    periods.push({ start, end: okEnd });
  }
  const ids = SYMPTOMS.map((s) => s.id);
  const days: DayNote[] = [];
  for (const d of Array.isArray(r.days) ? r.days : []) {
    if (!d || typeof d !== "object") continue;
    const { date, checkIn, symptoms } = d as Record<string, unknown>;
    if (!isDateKey(date) || days.some((x) => x.date === date)) continue;
    const syms = Array.isArray(symptoms) ? ids.filter((id) => symptoms.includes(id)) : [];
    days.push({ date, checkIn: cleanCheckIn(checkIn), symptoms: syms });
  }
  let questions: string[] = [];
  for (const q of Array.isArray(r.questions) ? r.questions : []) {
    if (typeof q !== "string") continue;
    const res = addNote(questions, q);
    if (res.ok) questions = res.items;
  }
  return {
    periods: periods.sort(newestFirst).slice(0, MAX_PERIODS),
    days: days.sort(newestFirst).slice(0, MAX_DAYS),
    questions,
  };
}
