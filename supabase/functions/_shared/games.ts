// supabase/functions/_shared/games.ts
// Request parsing and row shaping for the child `games` Edge Function. Pure,
// no Deno or network, so supabase/tests/games.test.mts can run it.
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

export const CREATION_KINDS = ["character", "scene", "story"] as const;
export type CreationKind = (typeof CREATION_KINDS)[number];
export const MAX_CREATION_BYTES = 4096;
const CREATION_ID = /^[a-z]{1,12}-[0-9]{1,16}$/;

// A kept Imagine & Create creation. The content holds the choices under the
// kind's own key ({ story: {...} }), with a name of up to 24 characters and
// the player's own story text of up to 240 (migration 20261029400000).
export interface CreationInput {
  id: string;
  kind: CreationKind;
  content: Record<string, unknown>;
}

export function parseCreation(v: unknown): CreationInput | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const c = v as Record<string, unknown>;
  if (typeof c.id !== "string" || !CREATION_ID.test(c.id)) return null;
  if (!(CREATION_KINDS as readonly unknown[]).includes(c.kind)) return null;
  const kind = c.kind as CreationKind;
  const content = c.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  const inner = (content as Record<string, unknown>)[kind];
  if (!inner || typeof inner !== "object" || Array.isArray(inner)) return null;
  const draft = inner as Record<string, unknown>;
  if (draft.name !== undefined && (typeof draft.name !== "string" || [...draft.name].length > 24)) return null;
  if (draft.ownText !== undefined && (typeof draft.ownText !== "string" || [...draft.ownText].length > 240)) return null;
  if (new TextEncoder().encode(JSON.stringify(content)).length > MAX_CREATION_BYTES) return null;
  return { id: c.id, kind, content: content as Record<string, unknown> };
}

export type GamesRequest =
  | { action: "get_state" }
  | { action: "record_round"; gameId: string; difficulty: string; score: number | null }
  | { action: "save_preferences"; preferences: PreferencesInput }
  | { action: "list_creations" }
  | { action: "save_creation"; creation: CreationInput }
  | { action: "delete_creation"; id: string };

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
  if (b.action === "list_creations") return { ok: true, value: { action: "list_creations" }, childSessionToken: token };

  if (b.action === "save_creation") {
    const creation = parseCreation(b.creation);
    return creation
      ? { ok: true, value: { action: "save_creation", creation }, childSessionToken: token }
      : { ok: false, status: 400, error: "invalid_input" };
  }
  if (b.action === "delete_creation") {
    return typeof b.id === "string" && CREATION_ID.test(b.id)
      ? { ok: true, value: { action: "delete_creation", id: b.id }, childSessionToken: token }
      : { ok: false, status: 400, error: "invalid_input" };
  }

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

export interface CreationRow {
  id: string;
  kind: string;
  content: Record<string, unknown>;
  created_at: string;
}

// Newest first, in the app's own shape.
export const shapeCreations = (rows: CreationRow[]) =>
  rows
    .filter((r) => (CREATION_KINDS as readonly string[]).includes(r.kind))
    .map((r) => ({ id: r.id, kind: r.kind as CreationKind, createdAt: r.created_at, ...r.content }));

export const shapePreferences = (row: PreferencesRow | null) =>
  row && isDifficulty(row.difficulty)
    ? { difficulty: row.difficulty, reducedMotion: row.reduced_motion, soundEnabled: row.sound_enabled, voiceEnabled: row.voice_enabled }
    : null;
