/**
 * Cycle Care: personal health profile ("assessment") and its private summary. Pure logic.
 *
 * Every field is optional and skippable. The summary is for the person to bring to a doctor or
 * dietitian. The app does NOT calculate BMI, set a target weight, score answers or give
 * medical advice. Food preferences only filter the meal ideas offered in the diet plan.
 * Physical activity and sleep/stress are covered elsewhere in Cycle Care, so they are not asked here.
 * Wording is unreviewed (docs/content-needing-review.md).
 */
import type { FoodPreference } from "./dietPlan";

export type CycleStatus = "regular" | "irregular" | "rare" | "absent" | "unsure";
export const CYCLE_OPTIONS: readonly { id: CycleStatus; label: string }[] = [
  { id: "regular", label: "Mostly regular" },
  { id: "irregular", label: "Irregular" },
  { id: "rare", label: "Very infrequent" },
  { id: "absent", label: "No periods lately" },
  { id: "unsure", label: "Not sure" },
];

export const HISTORY_OPTIONS: readonly { id: string; label: string }[] = [
  { id: "pcos", label: "PCOS/PCOD diagnosed by a doctor" },
  { id: "thyroid", label: "Thyroid condition" },
  { id: "sugar", label: "High blood sugar or diabetes" },
  { id: "bp", label: "High blood pressure" },
  { id: "cholesterol", label: "High cholesterol" },
  { id: "family", label: "Family history of diabetes" },
];

export const EATING_OPTIONS: readonly { id: string; label: string }[] = [
  { id: "regular", label: "I eat at fairly regular times" },
  { id: "skip", label: "I often skip meals" },
  { id: "late", label: "I eat late at night" },
  { id: "snack", label: "I snack a lot between meals" },
  { id: "outside", label: "I eat outside food often" },
  { id: "sweet", label: "I crave sweet things" },
];

export const NEEDS_OPTIONS: readonly { id: string; label: string }[] = [
  { id: "lowsugar", label: "Lower sugar, as advised by my doctor" },
  { id: "highprotein", label: "Extra protein, as advised" },
  { id: "lactose", label: "Lactose intolerance" },
  { id: "gluten", label: "Gluten sensitivity" },
  { id: "iron", label: "Iron or vitamin supplements, as advised" },
];

export const PREFERENCE_OPTIONS: readonly { id: FoodPreference; label: string }[] = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "eggetarian", label: "Eggetarian" },
  { id: "non_vegetarian", label: "Non-vegetarian" },
  { id: "vegan", label: "Vegan" },
];

export const GOAL_OPTIONS: readonly { id: string; label: string }[] = [
  { id: "understand", label: "Understand my condition better" },
  { id: "periods", label: "More regular periods" },
  { id: "energy", label: "More energy" },
  { id: "mood", label: "A steadier mood" },
  { id: "sleep", label: "Better sleep" },
  { id: "sugar", label: "Steadier blood sugar, with my doctor" },
  { id: "skin", label: "Skin and hair concerns" },
  { id: "pregnancy", label: "Planning a pregnancy, with my doctor" },
  { id: "feelgood", label: "Eating in a way that feels good" },
];

export interface Assessment {
  cycle: CycleStatus | null;
  history: string[];
  weightKg: string;
  waistCm: string;
  fastingGlucose: string;
  hba1c: string;
  eating: string[];
  needs: string[];
  allergies: string;
  preference: FoodPreference | null;
  likes: string;
  goals: string[];
  goalNote: string;
}

export const EMPTY_ASSESSMENT: Assessment = {
  cycle: null, history: [], weightKg: "", waistCm: "", fastingGlucose: "", hba1c: "",
  eating: [], needs: [], allergies: "", preference: null, likes: "", goals: [], goalNote: "",
};

export const MAX_TEXT = 200;

interface NumberRule { label: string; unit: string; min: number; max: number }
const RULES: Record<"weightKg" | "waistCm" | "fastingGlucose" | "hba1c", NumberRule> = {
  weightKg: { label: "Body weight", unit: "kg", min: 20, max: 300 },
  waistCm: { label: "Waist", unit: "cm", min: 40, max: 200 },
  fastingGlucose: { label: "Fasting blood glucose", unit: "mg/dL", min: 40, max: 400 },
  hba1c: { label: "HbA1c", unit: "%", min: 3, max: 15 },
};

/** Empty is fine (skipped). Otherwise it must be a number in a believable range. */
export function validateAssessment(a: Assessment): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(RULES) as (keyof typeof RULES)[]) {
    const v = a[key].trim();
    if (!v) continue;
    const r = RULES[key];
    const n = Number(v);
    if (!Number.isFinite(n) || n < r.min || n > r.max) errors.push(`${r.label} should be a number between ${r.min} and ${r.max} ${r.unit}, or left blank.`);
  }
  for (const [name, v] of [["Allergies", a.allergies], ["Likes and dislikes", a.likes], ["Goal note", a.goalNote]] as const) {
    if (v.length > MAX_TEXT) errors.push(`${name} should be under ${MAX_TEXT} characters.`);
  }
  return errors;
}

const label = (opts: readonly { id: string; label: string }[], ids: string[]) =>
  ids.map((id) => opts.find((o) => o.id === id)?.label).filter((x): x is string => !!x);

/** A plain list of what was answered, to show a doctor or dietitian. Skipped fields are left out. */
export function buildSummary(a: Assessment): string[] {
  const out: string[] = [];
  if (a.cycle) out.push(`Periods: ${CYCLE_OPTIONS.find((o) => o.id === a.cycle)?.label.toLowerCase()}.`);
  const history = label(HISTORY_OPTIONS, a.history);
  if (history.length) out.push(`Health history: ${history.join("; ")}.`);
  if (a.weightKg.trim()) out.push(`Body weight: ${a.weightKg.trim()} kg.`);
  if (a.waistCm.trim()) out.push(`Waist: ${a.waistCm.trim()} cm.`);
  if (a.fastingGlucose.trim()) out.push(`Fasting blood glucose: ${a.fastingGlucose.trim()} mg/dL.`);
  if (a.hba1c.trim()) out.push(`HbA1c: ${a.hba1c.trim()} %.`);
  const eating = label(EATING_OPTIONS, a.eating);
  if (eating.length) out.push(`Eating habits: ${eating.join("; ")}.`);
  const needs = label(NEEDS_OPTIONS, a.needs);
  if (needs.length) out.push(`Nutrition needs: ${needs.join("; ")}.`);
  if (a.allergies.trim()) out.push(`Allergies: ${a.allergies.trim()}.`);
  if (a.preference) out.push(`Food preference: ${PREFERENCE_OPTIONS.find((o) => o.id === a.preference)?.label.toLowerCase()}.`);
  if (a.likes.trim()) out.push(`Likes and dislikes: ${a.likes.trim()}.`);
  const goals = label(GOAL_OPTIONS, a.goals);
  if (goals.length) out.push(`My goals: ${goals.join("; ")}.`);
  if (a.goalNote.trim()) out.push(`In my own words: ${a.goalNote.trim()}.`);
  return out;
}

export const SUMMARY_NOTE =
  "This is only a list of what you chose to share. It is not a diagnosis, score or advice. Bring it to your doctor or dietitian.";

export const PROFILE_NOTE =
  "Everything here is optional, so skip anything you like. It is saved on this device only, and you can clear it at any time.";

const toggleId = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
export const toggleChoice = toggleId;

/** Accepts whatever was stored and returns a safe assessment. */
export function sanitizeAssessment(raw: unknown): Assessment {
  if (!raw || typeof raw !== "object") return EMPTY_ASSESSMENT;
  const r = raw as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string).slice(0, MAX_TEXT) : "");
  const ids = (k: string, opts: readonly { id: string }[]) =>
    Array.isArray(r[k]) ? (r[k] as unknown[]).filter((x): x is string => typeof x === "string" && opts.some((o) => o.id === x)) : [];
  const cycle = CYCLE_OPTIONS.find((o) => o.id === r.cycle)?.id ?? null;
  const preference = PREFERENCE_OPTIONS.find((o) => o.id === r.preference)?.id ?? null;
  return {
    cycle, history: ids("history", HISTORY_OPTIONS), weightKg: str("weightKg"), waistCm: str("waistCm"),
    fastingGlucose: str("fastingGlucose"), hba1c: str("hba1c"), eating: ids("eating", EATING_OPTIONS),
    needs: ids("needs", NEEDS_OPTIONS), allergies: str("allergies"), preference, likes: str("likes"),
    goals: ids("goals", GOAL_OPTIONS), goalNote: str("goalNote"),
  };
}
