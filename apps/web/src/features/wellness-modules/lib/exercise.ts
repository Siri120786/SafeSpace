/**
 * Physical Exercise module: daily activity minutes, yoga minutes and a weekly workout plan.
 * Pure logic, no React.
 *
 * Safeguards (over-exercising is also a risk when food and body are on someone's mind): the app
 * never counts calories burned or links movement to weight, the weekly goal is optional and set by
 * the person, rest days are part of the plan, the character never shames a quiet day, and a very
 * long day gets a gentle "rest matters" note. Wording is unreviewed (docs/content-needing-review.md).
 */

export type ActivityType = "walk" | "yoga" | "strength" | "cardio" | "other";
export const ACTIVITIES: readonly { id: ActivityType; label: string }[] = [
  { id: "walk", label: "Walking" },
  { id: "yoga", label: "Yoga" },
  { id: "strength", label: "Strength" },
  { id: "cardio", label: "Cardio" },
  { id: "other", label: "Other" },
];
const TYPE_IDS = new Set<string>(ACTIVITIES.map((a) => a.id));

export const activityLabel = (t: ActivityType) => ACTIVITIES.find((a) => a.id === t)?.label ?? "Other";

export interface LogEntry {
  /** Local date "YYYY-MM-DD". */
  date: string;
  type: ActivityType;
  minutes: number;
}

export interface PlannedDay {
  type: ActivityType;
  minutes: number;
}

/** Weekday index 0 = Monday ... 6 = Sunday. A missing day is a rest day. */
export type WeekPlan = Partial<Record<number, PlannedDay>>;

export interface ExerciseState {
  log: LogEntry[];
  plan: WeekPlan;
  /** Optional weekly minutes goal chosen by the person, or null for none. */
  weeklyGoal: number | null;
}

export const EMPTY_EXERCISE: ExerciseState = { log: [], plan: {}, weeklyGoal: null };

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export const MAX_ENTRY_MINUTES = 300;
export const LONG_DAY_MINUTES = 180;
export const MAX_GOAL_MINUTES = 1000;
export const MAX_LOG_ENTRIES = 400;
const KEEP_DAYS = 120;

export const REST_NOTE = "Rest days are part of a healthy week. A day off is not a missed day.";
export const LONG_DAY_NOTE = "That is a lot of movement for one day. Rest matters too. Stop and check with a doctor if you feel pain, dizziness or unwell.";

// ---------------------------------------------------------------- dates

export function dateKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + delta));
}

/** Monday = 0 ... Sunday = 6 for a date key. */
export function weekdayIndex(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** The seven date keys of the week (Monday to Sunday) that contains `today`. */
export function weekDates(today: string): string[] {
  const monday = addDays(today, -weekdayIndex(today));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// ---------------------------------------------------------------- logging

export type Result = { ok: true; state: ExerciseState } | { ok: false; error: string };

export function parseMinutes(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= MAX_ENTRY_MINUTES ? n : null;
}

export function addEntry(state: ExerciseState, date: string, type: ActivityType, minutes: number): Result {
  if (!TYPE_IDS.has(type)) return { ok: false, error: "Please pick an activity." };
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_ENTRY_MINUTES) return { ok: false, error: `Please enter minutes between 1 and ${MAX_ENTRY_MINUTES}.` };
  if (state.log.length >= MAX_LOG_ENTRIES) return { ok: false, error: "The log is full. Remove an old entry first." };
  const log = [...state.log, { date, type, minutes }].filter((e) => e.date >= addDays(date, -KEEP_DAYS));
  return { ok: true, state: { ...state, log } };
}

export function removeEntry(state: ExerciseState, index: number): ExerciseState {
  return { ...state, log: state.log.filter((_, i) => i !== index) };
}

export function entriesOn(state: ExerciseState, date: string): LogEntry[] {
  return state.log.filter((e) => e.date === date);
}

export function minutesOn(state: ExerciseState, date: string, type?: ActivityType): number {
  return state.log.filter((e) => e.date === date && (!type || e.type === type)).reduce((s, e) => s + e.minutes, 0);
}

export interface WeekSummary {
  totalMinutes: number;
  yogaMinutes: number;
  daysActive: number;
  byType: Record<ActivityType, number>;
}

export function summarizeWeek(state: ExerciseState, today: string): WeekSummary {
  const dates = new Set(weekDates(today));
  const inWeek = state.log.filter((e) => dates.has(e.date));
  const byType: Record<ActivityType, number> = { walk: 0, yoga: 0, strength: 0, cardio: 0, other: 0 };
  for (const e of inWeek) byType[e.type] += e.minutes;
  return {
    totalMinutes: inWeek.reduce((s, e) => s + e.minutes, 0),
    yogaMinutes: byType.yoga,
    daysActive: new Set(inWeek.map((e) => e.date)).size,
    byType,
  };
}

export function isLongDay(state: ExerciseState, date: string): boolean {
  return minutesOn(state, date) > LONG_DAY_MINUTES;
}

// ---------------------------------------------------------------- weekly plan and goal

export function setPlanDay(state: ExerciseState, weekday: number, planned: PlannedDay | null): Result {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { ok: false, error: "Please pick a day." };
  const plan = { ...state.plan };
  if (planned === null) {
    delete plan[weekday];
  } else {
    if (!TYPE_IDS.has(planned.type)) return { ok: false, error: "Please pick an activity." };
    if (!Number.isInteger(planned.minutes) || planned.minutes < 1 || planned.minutes > MAX_ENTRY_MINUTES) return { ok: false, error: `Please enter minutes between 1 and ${MAX_ENTRY_MINUTES}.` };
    plan[weekday] = { type: planned.type, minutes: planned.minutes };
  }
  return { ok: true, state: { ...state, plan } };
}

export type PlanStatus = "rest" | "todo" | "partly" | "done";

/** A planned day is done when enough of the planned activity was logged on that date. */
export function planStatus(state: ExerciseState, date: string): PlanStatus {
  const planned = state.plan[weekdayIndex(date)];
  if (!planned) return "rest";
  const got = minutesOn(state, date, planned.type);
  if (got >= planned.minutes) return "done";
  return got > 0 ? "partly" : "todo";
}

export function plannedMinutesPerWeek(plan: WeekPlan): number {
  return Object.values(plan).reduce((s, d) => s + (d?.minutes ?? 0), 0);
}

export function setWeeklyGoal(state: ExerciseState, text: string): Result {
  const t = text.trim();
  if (t === "") return { ok: true, state: { ...state, weeklyGoal: null } };
  if (!/^\d{1,4}$/.test(t)) return { ok: false, error: "Please enter a number of minutes, or leave it blank for no goal." };
  const n = Number(t);
  if (n < 10 || n > MAX_GOAL_MINUTES) return { ok: false, error: `Please choose between 10 and ${MAX_GOAL_MINUTES} minutes, or leave it blank.` };
  return { ok: true, state: { ...state, weeklyGoal: n } };
}

/** A neutral sentence about the week. No ranking, no "behind", no body talk. */
export function weekMessage(state: ExerciseState, today: string): string {
  const w = summarizeWeek(state, today);
  if (w.totalMinutes === 0) return "Nothing logged this week yet. Even a short stretch counts when you are ready.";
  const base = `This week you moved for ${w.totalMinutes} minutes on ${w.daysActive} ${w.daysActive === 1 ? "day" : "days"}.`;
  const yoga = w.yogaMinutes > 0 ? ` ${w.yogaMinutes} of those were yoga.` : "";
  if (state.weeklyGoal !== null && w.totalMinutes >= state.weeklyGoal) return `${base}${yoga} You reached the goal you set. Well done!`;
  if (state.weeklyGoal !== null) return `${base}${yoga} Your own goal is ${state.weeklyGoal} minutes. Go at your own pace.`;
  return `${base}${yoga}`;
}

export type Stance = "happy" | "meditating" | "peeking" | "waving" | "celebrating";
export interface Reaction {
  stance: Stance;
  text: string;
}

/** What the character says about today's movement. Always kind. */
export function exerciseReaction(state: ExerciseState, today: string, hour: number): Reaction {
  const status = planStatus(state, today);
  const todayMin = minutesOn(state, today);
  if (isLongDay(state, today)) return { stance: "meditating", text: "That was a lot of movement today. Time to rest and stretch gently." };
  if (status === "done") return { stance: "celebrating", text: "Yayyy! You finished today's workout. You did great!" };
  if (status === "partly" || (status === "rest" && todayMin > 0)) return { stance: "happy", text: `Nice! ${todayMin} minutes of movement today. Keep going at your own pace.` };
  if (status === "rest") return { stance: "meditating", text: "Today is a rest day. Resting is part of the plan." };
  if (hour >= 18) return { stance: "waving", text: "Hey, even a short stretch or a few minutes of yoga counts today." };
  return { stance: "waving", text: "Good to see you! Log your movement when you are done." };
}

export function allExerciseLines(): string[] {
  const out: string[] = [REST_NOTE, LONG_DAY_NOTE];
  const monday = "2026-10-26";
  const plan: WeekPlan = { 0: { type: "walk", minutes: 20 } };
  const base: ExerciseState = { log: [], plan, weeklyGoal: 100 };
  const withLog = (m: number): ExerciseState => ({ ...base, log: [{ date: monday, type: "walk", minutes: m }] });
  for (const hour of [9, 20]) {
    for (const s of [base, withLog(10), withLog(20), withLog(200), { ...base, plan: {} }]) out.push(exerciseReaction(s, monday, hour).text);
  }
  out.push(weekMessage(base, monday), weekMessage(withLog(20), monday), weekMessage({ ...withLog(120) }, monday), weekMessage({ ...withLog(20), weeklyGoal: null }, monday));
  return out;
}

// ---------------------------------------------------------------- storage shape

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Accepts whatever was stored and returns a safe state. */
export function sanitizeExercise(raw: unknown): ExerciseState {
  if (!raw || typeof raw !== "object") return EMPTY_EXERCISE;
  const r = raw as Partial<ExerciseState>;
  const log: LogEntry[] = Array.isArray(r.log)
    ? r.log
        .filter((e): e is LogEntry => !!e && typeof e.date === "string" && DATE_RE.test(e.date) && TYPE_IDS.has(e.type as string) && Number.isInteger(e.minutes) && e.minutes >= 1 && e.minutes <= MAX_ENTRY_MINUTES)
        .map((e) => ({ date: e.date, type: e.type, minutes: e.minutes }))
        .slice(-MAX_LOG_ENTRIES)
    : [];
  const plan: WeekPlan = {};
  if (r.plan && typeof r.plan === "object") {
    for (const [k, v] of Object.entries(r.plan)) {
      const i = Number(k);
      const d = v as PlannedDay | undefined;
      if (Number.isInteger(i) && i >= 0 && i <= 6 && d && TYPE_IDS.has(d.type) && Number.isInteger(d.minutes) && d.minutes >= 1 && d.minutes <= MAX_ENTRY_MINUTES) plan[i] = { type: d.type, minutes: d.minutes };
    }
  }
  const goal = Number.isInteger(r.weeklyGoal) && (r.weeklyGoal as number) >= 10 && (r.weeklyGoal as number) <= MAX_GOAL_MINUTES ? (r.weeklyGoal as number) : null;
  return { log, plan, weeklyGoal: goal };
}
