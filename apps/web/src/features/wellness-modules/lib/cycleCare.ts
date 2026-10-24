/**
 * Cycle Care extras (PCOS/PCOD): pure logic and wording, no React.
 *
 * Design rules (docs/Architecture_Specification.md, open question 5): PCOS is linked
 * with a higher eating-disorder risk, so nothing here uses weight, calories, targets,
 * streaks or "good/bad" scoring. Everything is optional, gentle and non-clinical.
 * Wording is unreviewed (docs/content-needing-review.md).
 */

export type Level = "low" | "okay" | "good";
export const LEVELS: readonly Level[] = ["low", "okay", "good"];

export interface CheckInField {
  id: "energy" | "mood" | "comfort" | "sleep";
  label: string;
  /** Labels for low / okay / good, in that order. */
  options: readonly [string, string, string];
}

export const CHECKIN_FIELDS: readonly CheckInField[] = [
  { id: "energy", label: "Energy", options: ["Running low", "Steady", "Plenty"] },
  { id: "mood", label: "Mood", options: ["Heavy", "Mixed", "Light"] },
  { id: "comfort", label: "Body comfort", options: ["Uncomfortable", "Some discomfort", "Comfortable"] },
  { id: "sleep", label: "Last night's sleep", options: ["Rough", "Okay", "Restful"] },
];

export type CheckIn = Partial<Record<CheckInField["id"], Level>>;

export function optionLabel(field: CheckInField, level: Level): string {
  return field.options[LEVELS.indexOf(level)];
}

/** One gentle sentence for a single check-in. Never scores or judges. */
export function describeCheckIn(c: CheckIn): string {
  const parts = CHECKIN_FIELDS.filter((f) => c[f.id]).map((f) => `${f.label.toLowerCase()}: ${optionLabel(f, c[f.id] as Level).toLowerCase()}`);
  if (parts.length === 0) return "Nothing noted yet. Skipping is always fine.";
  return `Today you noted ${parts.join(", ")}.`;
}

/**
 * A neutral look back over the check-ins made on this page. It counts, it does not rank:
 * no streaks, no "best day", no targets.
 */
export function summarizeCheckIns(entries: readonly CheckIn[]): string {
  const filled = entries.filter((e) => Object.keys(e).length > 0);
  if (filled.length === 0) return "No check-ins yet. Add one whenever you feel like it.";
  const lowComfort = filled.filter((e) => e.comfort === "low").length;
  const base = `You checked in ${filled.length} time${filled.length === 1 ? "" : "s"} on this page.`;
  if (lowComfort >= 2) {
    return `${base} Your body felt uncomfortable more than once. If this keeps happening, it may help to mention it to your doctor.`;
  }
  return `${base} Notes like these can help you remember what to tell your doctor.`;
}

export const MOVEMENT_BY_ENERGY: Record<Level, readonly string[]> = {
  low: ["Slow stretching on the floor or in a chair", "A few deep breaths by an open window", "A very short, easy walk, only if you want to"],
  okay: ["A walk at a comfortable pace", "Gentle yoga or stretching", "Dancing to one song"],
  good: ["A longer walk or a bike ride you enjoy", "Something playful like dancing or a game outside", "Light strength moves, at your own pace"],
};

export const MOVEMENT_NOTE = "There is no right amount. Rest counts too. Choose what feels kind to your body today.";

export const VISIT_PROMPTS: readonly string[] = [
  "What changes in my periods or body have I noticed lately?",
  "Which tests or check-ups do I need, and how often?",
  "What are my treatment options, and what are the side effects?",
  "Is it okay to take my supplements together with my medicine?",
  "What support is there for my mood, stress or sleep?",
];

export const MEDICATION_NOTE =
  "These are only your own notes, so you can remember what to ask. This app does not give medicine advice and does not send reminders from this page. Use the Reminders page for alerts.";

export const WATER_NOTE = "Just a tally for you. There is no goal to reach and nothing to keep up.";

export const BODY_KINDNESS_TEXT =
  "SafeSpace does not track weight, calories or body size, on purpose. If thoughts about food or your body feel heavy, please talk to a doctor or someone you trust.";

export const MAX_ITEMS = 20;
export const MAX_ITEM_LENGTH = 120;

export type AddResult = { ok: true; items: string[] } | { ok: false; error: string };

/** Adds a user-typed note to a short list. Trims, rejects empty, duplicates and overly long text. */
export function addNote(list: readonly string[], text: string): AddResult {
  const t = text.trim();
  if (!t) return { ok: false, error: "Please type something first." };
  if (t.length > MAX_ITEM_LENGTH) return { ok: false, error: `Please keep it under ${MAX_ITEM_LENGTH} characters.` };
  if (list.length >= MAX_ITEMS) return { ok: false, error: "That list is full. Remove one to add another." };
  if (list.some((x) => x.toLowerCase() === t.toLowerCase())) return { ok: false, error: "That is already on the list." };
  return { ok: true, items: [...list, t] };
}

export function removeNote(list: readonly string[], index: number): string[] {
  return list.filter((_, i) => i !== index);
}

/** Water tally never goes below 0 and has a sane upper limit; there is no target. */
export const MAX_WATER = 30;
export function bumpWater(current: number, delta: 1 | -1): number {
  return Math.min(MAX_WATER, Math.max(0, current + delta));
}

/** Words that must never appear in Cycle Care wording (body-image safety). Checked by tests. */
export const BLOCKED_TERMS: readonly RegExp[] = [
  /\bcalor(?:ie|ies)\b/i,
  /\bweigh(?:t|ing)\b/i,
  /\bdiet\b/i,
  /\blose\b/i,
  /\bfat\b/i,
  /\bBMI\b/,
  /\bstreak\b/i,
  /\bgoal weight\b/i,
];

export function isBodyNeutral(text: string): boolean {
  // The body-kindness statement itself names what the app does not do.
  if (text === BODY_KINDNESS_TEXT) return true;
  return !BLOCKED_TERMS.some((re) => re.test(text));
}

export const CYCLE_CARE_TEXTS: readonly string[] = [
  ...CHECKIN_FIELDS.flatMap((f) => [f.label, ...f.options]),
  ...Object.values(MOVEMENT_BY_ENERGY).flat(),
  MOVEMENT_NOTE,
  ...VISIT_PROMPTS,
  MEDICATION_NOTE,
  WATER_NOTE,
];
