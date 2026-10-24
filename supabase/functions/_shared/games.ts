// supabase/functions/_shared/games.ts
// Request parsing and row shaping for the child `games` Edge Function. Pure,
// no Deno or network, so supabase/tests/games_handler.test.mts can run it.
// Ids must match GAME_IDS in packages/shared-types and the migration
// 20261029100000_game_progress.sql (the games tests check all three).

export const GAME_IDS = ["memory-match", "pattern-quest", "feelings-detective", "imagine-create", "maze-explorer"] as const;
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

const isGameId = (v: unknown): v is (typeof GAME_IDS)[number] => typeof v === "string" && (GAME_IDS as readonly string[]).includes(v);
const isDifficulty = (v: unknown): v is (typeof DIFFICULTIES)[number] => typeof v === "string" && (DIFFICULTIES as readonly string[]).includes(v);

export interface PreferencesInput {
  difficulty: (typeof DIFFICULTIES)[number];
  reducedMotion: boolean;
  soundEnabled: boolean;
  voiceEnabled: boolean;
}

export type GamesRequest =
  | { action: "get_state" }
  | { action: "record_round"; gameId: string; difficulty: string; score: number | null }
  | { action: "save_preferences"; preferences: PreferencesInput };

export type GamesParse =
  | { ok: true; value: GamesRequest; childSessionToken: string }
  | { ok: false; status: 400 | 401; error: string };

export function parseGamesRequest(raw: unknown): GamesParse {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, status: 400, error: "invalid_request" };
  }
  const b = raw as Record<string, unknown>;
  if (typeof b.child_session_token !== "string" || !b.child_session_token) {
    return { ok: false, status: 401, error: "invalid_session" };
  }
  const token = b.child_session_token;

  if (b.action === "get_state") return { ok: true, value: { action: "get_state" }, childSessionToken: token };

  if (b.action === "record_round") {
    if (!isGameId(b.game_id) || !isDifficulty(b.difficulty)) return { ok: false, status: 400, error: "invalid_input" };
    const score = b.score === undefined ? null : b.score;
    if (score !== null && !(typeof score === "number" && Number.isInteger(score) && score >= 0 && score <= 100)) {
      return { ok: false, status: 400, error: "invalid_input" };
    }
    return { ok: true, value: { action: "record_round", gameId: b.game_id, difficulty: b.difficulty, score }, childSessionToken: token };
  }

  if (b.action === "save_preferences") {
    const p = b.preferences as Record<string, unknown> | null | undefined;
    if (
      typeof p !== "object" || p === null || !isDifficulty(p.difficulty) ||
      typeof p.reduced_motion !== "boolean" || typeof p.sound_enabled !== "boolean" || typeof p.voice_enabled !== "boolean"
    ) {
      return { ok: false, status: 400, error: "invalid_input" };
    }
    return {
      ok: true,
      value: {
        action: "save_preferences",
        preferences: { difficulty: p.difficulty, reducedMotion: p.reduced_motion, soundEnabled: p.sound_enabled, voiceEnabled: p.voice_enabled },
      },
      childSessionToken: token,
    };
  }
  return { ok: false, status: 400, error: "invalid_action" };
}

// ---------------------------------------------------------------------------
// Row -> contract shaping (GameProgress / GamePreferences in shared-types)
// ---------------------------------------------------------------------------
export interface ProgressRow {
  game_id: string;
  difficulty: string;
  rounds_completed: number;
  best_score: number | null;
  last_played_at: string;
}
export interface PreferencesRow {
  difficulty: string;
  reduced_motion: boolean;
  sound_enabled: boolean;
  voice_enabled: boolean;
}

export const shapeProgress = (rows: ProgressRow[]) =>
  rows
    .filter((r) => isGameId(r.game_id) && isDifficulty(r.difficulty))
    .map((r) => ({
      gameId: r.game_id,
      difficulty: r.difficulty,
      roundsCompleted: r.rounds_completed,
      bestScore: r.best_score,
      lastPlayedAt: r.last_played_at,
    }));

export const shapePreferences = (row: PreferencesRow | null) =>
  row && isDifficulty(row.difficulty)
    ? { difficulty: row.difficulty, reducedMotion: row.reduced_motion, soundEnabled: row.sound_enabled, voiceEnabled: row.voice_enabled }
    : null;
