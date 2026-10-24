// What a caregiver sees about a child's games: activity only (how many rounds,
// when last played). Never a measure of ability, so no scores are compared and
// there is no ranking.
import type { GameProgress } from "@safespace/shared-types";
import { GAME_IDS, type GameId } from "./content";
import { starsFor } from "./scoring";

export interface GameSummaryRow {
  gameId: GameId;
  rounds: number;
  /** Highest level played, easy / medium / hard. */
  levels: string[];
  bestStars: 1 | 2 | 3 | null;
  lastPlayedAt: string;
}

export function summarizeGameProgress(rows: GameProgress[]): GameSummaryRow[] {
  return GAME_IDS.flatMap((gameId) => {
    const mine = rows.filter((r) => r.gameId === gameId && r.roundsCompleted > 0);
    if (mine.length === 0) return [];
    const scores = mine.map((r) => r.bestScore).filter((n): n is number => n !== null);
    return [
      {
        gameId,
        rounds: mine.reduce((n, r) => n + r.roundsCompleted, 0),
        levels: ["easy", "medium", "hard"].filter((d) => mine.some((r) => r.difficulty === d)),
        bestStars: scores.length ? starsFor(Math.max(...scores)) : null,
        lastPlayedAt: mine.map((r) => r.lastPlayedAt).sort().slice(-1)[0],
      },
    ];
  }).sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt));
}
