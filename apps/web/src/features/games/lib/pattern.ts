// Pattern Quest rules.
import { patternContent, type Difficulty, type PatternRound } from "./content";
import { shuffle, type Rng } from "./rng";
import { averageScore, questionCredit } from "./scoring";

export const GAP = "?";

/** Rounds for one game: a shuffled selection, with the answer options shuffled too. */
export function buildPatternGame(difficulty: Difficulty, rng: Rng, count = patternContent.roundsPerGame): PatternRound[] {
  const pool = patternContent.rounds[difficulty];
  return shuffle(pool, rng)
    .slice(0, Math.min(count, pool.length))
    .map((r) => ({ ...r, options: shuffle(r.options, rng) }));
}

/** Index of the missing item, or -1 when the question is "what comes next?". */
export function gapIndex(round: PatternRound): number {
  return round.items.indexOf(GAP);
}

/** The row as the player sees it: a gap or a trailing "?" for what comes next. */
export function displayItems(round: PatternRound): string[] {
  return gapIndex(round) >= 0 ? round.items : [...round.items, GAP];
}

export function isCorrect(round: PatternRound, choice: string): boolean {
  return choice === round.answer;
}

/** The finished row, used to read the pattern aloud and to show the solved state. */
export function solvedItems(round: PatternRound): string[] {
  const i = gapIndex(round);
  return i >= 0 ? round.items.map((x, k) => (k === i ? round.answer : x)) : [...round.items, round.answer];
}

/**
 * Musical position for each item (first new picture = 0, next new = 1 ...).
 * Equal pictures get equal notes, so the pattern can be heard as well as seen.
 */
export function noteIndexes(items: string[]): number[] {
  const seen: string[] = [];
  return items.map((x) => {
    let i = seen.indexOf(x);
    if (i < 0) {
      seen.push(x);
      i = seen.length - 1;
    }
    return i;
  });
}

/** Checks that a numeric round follows its declared rule. Used by content tests. */
export function followsRule(round: PatternRound): boolean {
  const rule = round.rule;
  if (!rule) return true;
  const nums = solvedItems(round).map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return false;
  for (let i = 1; i < nums.length; i++) {
    if (rule.type === "add" && nums[i] - nums[i - 1] !== rule.by) return false;
    if (rule.type === "double" && nums[i] !== nums[i - 1] * 2) return false;
    if (rule.type === "fibonacci" && i >= 2 && nums[i] !== nums[i - 1] + nums[i - 2]) return false;
  }
  return true;
}

export interface PatternProgress {
  attempts: number[];
  hinted: boolean[];
}

export const patternScore = (p: PatternProgress) =>
  averageScore(p.attempts.map((a, i) => questionCredit(a, p.hinted[i] ?? false)));
