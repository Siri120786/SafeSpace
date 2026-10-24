// Scoring and level suggestions. Scores are only for the player's own
// "stars" and the caregiver's activity summary. They are never used to infer
// ability, a diagnosis or intelligence (docs/games.md).
import { catalog, type Difficulty, type GameId } from "./content";

export interface RoundResult {
  gameId: GameId;
  difficulty: Difficulty;
  /** 0-100, or null for open-ended games with no score. */
  score: number | null;
  /** Wrong tries during the round (never shown as "failures"). */
  mistakes: number;
  hints: number;
}

export const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** 1 to 3 stars. Everyone who finishes gets at least one. */
export function starsFor(score: number | null): 1 | 2 | 3 {
  if (score === null) return 3;
  return score >= 80 ? 3 : score >= 50 ? 2 : 1;
}

/** Memory Match: every pair needs one try; extra tries and hints take a little off. */
export function memoryScore(pairs: number, mistakes: number, hints: number): number {
  return clampScore((100 * pairs) / (pairs + mistakes) - hints * 5);
}

/**
 * Pattern Quest and Feelings Detective: each question is worth full credit on
 * the first try, half on the second, a quarter after that, and a hint caps it
 * at three quarters.
 */
export function questionCredit(attempts: number, usedHint: boolean): number {
  const base = attempts <= 1 ? 1 : attempts === 2 ? 0.5 : 0.25;
  return usedHint ? Math.min(base, 0.75) : base;
}

export function averageScore(credits: number[]): number {
  if (credits.length === 0) return 0;
  return clampScore((100 * credits.reduce((a, b) => a + b, 0)) / credits.length);
}

/** Maze: steps close to the shortest route score high; hints take a little off. */
export function mazeScore(optimalSteps: number, steps: number, hints: number): number {
  return clampScore((100 * optimalSteps) / Math.max(optimalSteps, steps) - hints * 5);
}

export interface RecentRound {
  difficulty: Difficulty;
  mistakes: number;
  hints: number;
}

export type Suggestion = "up" | "down" | "same";

/**
 * Optional adaptation: looks at the last few rounds played at the CURRENT
 * level only. Easy-going rounds suggest one step up; a run of hard rounds
 * suggests one step down. It is only ever offered; the player or caregiver
 * decides.
 */
export function suggestDifficulty(current: Difficulty, recent: RecentRound[]): Suggestion {
  const { window, stepUpIfAtMostMistakes, stepUpIfAtMostHints, stepDownIfAtLeastMistakes } = catalog.adaptation;
  const here = recent.filter((r) => r.difficulty === current).slice(-window);
  if (here.length < window) return "same";
  const smooth = here.every((r) => r.mistakes <= stepUpIfAtMostMistakes && r.hints <= stepUpIfAtMostHints);
  if (smooth && current !== "hard") return "up";
  const struggling = here.every((r) => r.mistakes >= stepDownIfAtLeastMistakes);
  if (struggling && current !== "easy") return "down";
  return "same";
}

export function nextDifficulty(current: Difficulty, direction: "up" | "down"): Difficulty {
  const i = catalog.difficulties.indexOf(current);
  const j = Math.max(0, Math.min(catalog.difficulties.length - 1, i + (direction === "up" ? 1 : -1)));
  return catalog.difficulties[j];
}
