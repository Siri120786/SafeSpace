/**
 * Cycle Care: diet plan, daily rewards and the character's reactions. Pure logic, no React.
 *
 * Where the plan comes from: the person writes it from what their doctor or dietitian told them.
 * The app only offers general tips and meal ideas (unreviewed wording, see
 * docs/content-needing-review.md). It never counts calories, sets a target weight or scores a body.
 *
 * Rewards: stars for every ticked meal, a bonus for finishing the whole plan, and a streak of
 * complete days. A day without a streak is never shown as a failure: partial days still earn stars.
 */

export type MealId = "breakfast" | "lunch" | "snack" | "dinner";
export const MEALS: readonly { id: MealId; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "snack", label: "Snack" },
  { id: "dinner", label: "Dinner" },
];

export type DietPlan = Record<MealId, string[]>;
export const EMPTY_PLAN: DietPlan = { breakfast: [], lunch: [], snack: [], dinner: [] };

/** One day: how many meals were planned that day and how many were ticked. */
export interface DayEntry {
  planned: number;
  done: number;
}

export interface DietState {
  plan: DietPlan;
  /** Meals ticked today, by local date key. */
  ticks: Record<string, MealId[]>;
  /** Per-day summary, by local date key. */
  days: Record<string, DayEntry>;
  /** When true the screen hides stars and streaks (a calmer view). */
  hideRewards: boolean;
}

export const EMPTY_STATE: DietState = { plan: EMPTY_PLAN, ticks: {}, days: {}, hideRewards: false };

export const GENERAL_GUIDANCE: readonly string[] = [
  "Build meals around vegetables, dal or pulses, and whole grains such as millets, oats or brown rice.",
  "Pair carbohydrates with protein or healthy fats, for example roti with dal, or fruit with a handful of nuts.",
  "Choose fibre-rich foods like vegetables, fruit with skin, seeds and legumes.",
  "Try to eat at regular times instead of long gaps between meals.",
  "Sugary drinks and very processed snacks can be enjoyed less often.",
  "Healthy fats such as nuts, seeds, and curd or paneer in sensible amounts can fit in.",
];

export const GUIDANCE_NOTE =
  "General information only, not medical advice. Please follow the plan your doctor or dietitian gives you.";

export type FoodPreference = "vegetarian" | "eggetarian" | "non_vegetarian" | "vegan";

interface MealIdea {
  meal: MealId;
  text: string;
  /** Preferences this idea suits. */
  suits: readonly FoodPreference[];
}

const ALL: readonly FoodPreference[] = ["vegetarian", "eggetarian", "non_vegetarian", "vegan"];
const NO_MEAT: readonly FoodPreference[] = ["vegetarian", "eggetarian", "non_vegetarian"];
const EGG_OK: readonly FoodPreference[] = ["eggetarian", "non_vegetarian"];

export const MEAL_IDEAS: readonly MealIdea[] = [
  { meal: "breakfast", text: "Vegetable oats upma", suits: ALL },
  { meal: "breakfast", text: "Besan chilla with mint chutney", suits: ALL },
  { meal: "breakfast", text: "Curd with fruit and seeds", suits: NO_MEAT },
  { meal: "breakfast", text: "Vegetable omelette with a slice of whole grain toast", suits: EGG_OK },
  { meal: "lunch", text: "Roti, dal and a vegetable sabzi with salad", suits: ALL },
  { meal: "lunch", text: "Millet khichdi with vegetables", suits: ALL },
  { meal: "lunch", text: "Brown rice with sambar and a vegetable side", suits: ALL },
  { meal: "lunch", text: "Grilled fish or chicken with vegetables and roti", suits: ["non_vegetarian"] },
  { meal: "snack", text: "A handful of roasted chana", suits: ALL },
  { meal: "snack", text: "Fruit with a few almonds", suits: ALL },
  { meal: "snack", text: "Buttermilk with roasted seeds", suits: NO_MEAT },
  { meal: "dinner", text: "Vegetable soup with paneer or tofu", suits: NO_MEAT },
  { meal: "dinner", text: "Roti, mixed vegetable curry and dal", suits: ALL },
  { meal: "dinner", text: "Egg curry with vegetables and a small portion of rice", suits: EGG_OK },
];

export function mealIdeasFor(meal: MealId, preference: FoodPreference | null): MealIdea[] {
  return MEAL_IDEAS.filter((i) => i.meal === meal && (!preference || i.suits.includes(preference)));
}

// ---------------------------------------------------------------- the plan

export const MAX_PLAN_ITEMS_PER_MEAL = 8;
export const MAX_PLAN_ITEM_LENGTH = 100;

export type PlanResult = { ok: true; plan: DietPlan } | { ok: false; error: string };

export function addPlanItem(plan: DietPlan, meal: MealId, text: string): PlanResult {
  const t = text.trim();
  if (!t) return { ok: false, error: "Please type something first." };
  if (t.length > MAX_PLAN_ITEM_LENGTH) return { ok: false, error: `Please keep it under ${MAX_PLAN_ITEM_LENGTH} characters.` };
  const list = plan[meal];
  if (list.length >= MAX_PLAN_ITEMS_PER_MEAL) return { ok: false, error: "That meal is full. Remove one to add another." };
  if (list.some((x) => x.toLowerCase() === t.toLowerCase())) return { ok: false, error: "That is already in this meal." };
  return { ok: true, plan: { ...plan, [meal]: [...list, t] } };
}

export function removePlanItem(plan: DietPlan, meal: MealId, index: number): DietPlan {
  return { ...plan, [meal]: plan[meal].filter((_, i) => i !== index) };
}

export function plannedMeals(plan: DietPlan): MealId[] {
  return MEALS.filter((m) => plan[m.id].length > 0).map((m) => m.id);
}

// ---------------------------------------------------------------- days, stars, streaks

export function dateKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + delta));
}

/** Ticks a meal on or off for a day and refreshes that day's summary. Unplanned meals are ignored. */
export function toggleMeal(state: DietState, meal: MealId, today: string): DietState {
  if (state.plan[meal].length === 0) return state;
  const ticked = state.ticks[today] ?? [];
  const next = ticked.includes(meal) ? ticked.filter((m) => m !== meal) : [...ticked, meal];
  return refreshDay({ ...state, ticks: { ...state.ticks, [today]: next } }, today);
}

/** Re-counts a day from the current plan and ticks. Call after the plan changes too. */
export function refreshDay(state: DietState, today: string): DietState {
  const planned = plannedMeals(state.plan);
  const done = (state.ticks[today] ?? []).filter((m) => planned.includes(m)).length;
  return { ...state, days: { ...state.days, [today]: { planned: planned.length, done } } };
}

export function isCompleteDay(e: DayEntry | undefined): boolean {
  return !!e && e.planned > 0 && e.done >= e.planned;
}

/** Stars for one day: one per ticked meal, plus one bonus for finishing the whole plan. */
export function starsForDay(e: DayEntry | undefined): number {
  if (!e || e.planned === 0) return 0;
  return e.done + (isCompleteDay(e) ? 1 : 0);
}

export function totalStars(days: Record<string, DayEntry>): number {
  return Object.values(days).reduce((sum, e) => sum + starsForDay(e), 0);
}

/**
 * Days in a row with the whole plan ticked. Today only breaks the streak once it is over, so an
 * unfinished today does not erase yesterday's run.
 */
export function currentStreak(days: Record<string, DayEntry>, today: string): number {
  let day = isCompleteDay(days[today]) ? today : addDays(today, -1);
  let n = 0;
  while (isCompleteDay(days[day])) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function bestStreak(days: Record<string, DayEntry>): number {
  const keys = Object.keys(days).filter((k) => isCompleteDay(days[k])).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    run = prev !== null && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

// ---------------------------------------------------------------- the character

export type Stance = "happy" | "meditating" | "peeking" | "waving" | "celebrating";
export interface Reaction {
  stance: Stance;
  text: string;
}

/**
 * What the character says. Always kind: it cheers progress and, when nothing is ticked late in the
 * day, gives a small nudge. It never shames, counts missed days or mentions the body.
 */
export function characterReaction(entry: DayEntry | undefined, hour: number, streak: number): Reaction {
  if (!entry || entry.planned === 0) {
    return { stance: "waving", text: "Hi! Add a few meals to your plan and I will cheer you on." };
  }
  if (isCompleteDay(entry)) {
    const extra = streak >= 2 ? ` That is ${streak} days in a row!` : "";
    return { stance: "celebrating", text: `Yayyy! You finished today's plan. You did great!${extra}` };
  }
  if (entry.done > 0) {
    return { stance: "happy", text: `Nice work! ${entry.done} of ${entry.planned} meals done. Keep going at your own pace.` };
  }
  if (hour >= 18) {
    return { stance: "meditating", text: "Hey, let's try to follow your plan with the next meal. A small step is okay." };
  }
  return { stance: "waving", text: "Good to see you! Tick a meal when you have had it." };
}

/** Every line the character or the rewards area can show, so tests can check the tone. */
export function allCharacterLines(): string[] {
  const out: string[] = [];
  const cases: (DayEntry | undefined)[] = [undefined, { planned: 3, done: 3 }, { planned: 3, done: 1 }, { planned: 3, done: 0 }];
  for (const c of cases) for (const hour of [9, 20]) for (const streak of [0, 4]) out.push(characterReaction(c, hour, streak).text);
  return out;
}

// ---------------------------------------------------------------- storage shape

const MEAL_IDS = new Set<string>(MEALS.map((m) => m.id));

/** Accepts whatever was stored and returns a safe state; bad or old data falls back to empty. */
export function sanitizeState(raw: unknown): DietState {
  if (!raw || typeof raw !== "object") return EMPTY_STATE;
  const r = raw as Partial<DietState>;
  const plan: DietPlan = { breakfast: [], lunch: [], snack: [], dinner: [] };
  for (const m of MEALS) {
    const list = (r.plan as Record<string, unknown> | undefined)?.[m.id];
    if (Array.isArray(list)) {
      plan[m.id] = list.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= MAX_PLAN_ITEM_LENGTH).slice(0, MAX_PLAN_ITEMS_PER_MEAL);
    }
  }
  const ticks: Record<string, MealId[]> = {};
  if (r.ticks && typeof r.ticks === "object") {
    for (const [k, v] of Object.entries(r.ticks)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(v)) ticks[k] = v.filter((x): x is MealId => typeof x === "string" && MEAL_IDS.has(x));
    }
  }
  const days: Record<string, DayEntry> = {};
  if (r.days && typeof r.days === "object") {
    for (const [k, v] of Object.entries(r.days)) {
      const e = v as Partial<DayEntry> | null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && e && Number.isInteger(e.planned) && Number.isInteger(e.done) && (e.planned as number) >= 0 && (e.planned as number) <= 4 && (e.done as number) >= 0 && (e.done as number) <= (e.planned as number)) {
        days[k] = { planned: e.planned as number, done: e.done as number };
      }
    }
  }
  return { plan, ticks, days, hideRewards: r.hideRewards === true };
}
