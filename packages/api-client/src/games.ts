// packages/api-client/src/games.ts
// Games Corner storage (docs/games.md). Game rules run on the device; this
// only saves a short progress record and the player's comfort settings.
//   - Adults: tables and SECURITY INVOKER functions under RLS
//     (supabase/migrations/20261029100000_game_progress.sql).
//   - Children: the `games` Edge Function (they have no Supabase login).
//   - Caregivers: READ-only summary of their own children's progress, by childId.

import { getSafeSpaceClient } from "./supabaseClient";
import { ContractError, invokeEdge, toContractError } from "./edge";
import {
  GAME_DIFFICULTIES,
  GAME_IDS,
  type AppSession,
  type GameDifficulty,
  type GameId,
  type GamePreferences,
  type GameProgress,
  type GameState,
  type RecordGameRoundInput,
} from "@safespace/shared-types";

const PROGRESS_COLUMNS = "game_id, difficulty, rounds_completed, best_score, last_played_at";
const PREFERENCE_COLUMNS = "difficulty, reduced_motion, sound_enabled, voice_enabled";

const isGameId = (v: unknown): v is GameId => typeof v === "string" && (GAME_IDS as readonly string[]).includes(v);
const isDifficulty = (v: unknown): v is GameDifficulty => typeof v === "string" && (GAME_DIFFICULTIES as readonly string[]).includes(v);

function toProgress(r: any): GameProgress {
  return {
    gameId: r.game_id,
    difficulty: r.difficulty,
    roundsCompleted: r.rounds_completed,
    bestScore: r.best_score ?? null,
    lastPlayedAt: r.last_played_at,
  };
}

function toPreferences(r: any): GamePreferences {
  return {
    difficulty: r.difficulty,
    reducedMotion: r.reduced_motion,
    soundEnabled: r.sound_enabled,
    voiceEnabled: r.voice_enabled,
  };
}

function cleanRound(input: RecordGameRoundInput): RecordGameRoundInput {
  const score = input?.score ?? null;
  if (
    !isGameId(input?.gameId) || !isDifficulty(input?.difficulty) ||
    (score !== null && !(Number.isInteger(score) && score >= 0 && score <= 100))
  ) {
    throw new ContractError("invalid_input");
  }
  return { gameId: input.gameId, difficulty: input.difficulty, score };
}

function cleanPreferences(p: GamePreferences): GamePreferences {
  if (
    !isDifficulty(p?.difficulty) || typeof p.reducedMotion !== "boolean" ||
    typeof p.soundEnabled !== "boolean" || typeof p.voiceEnabled !== "boolean"
  ) {
    throw new ContractError("invalid_input");
  }
  return { difficulty: p.difficulty, reducedMotion: p.reducedMotion, soundEnabled: p.soundEnabled, voiceEnabled: p.voiceEnabled };
}

/** The signed-in player's progress and saved settings (preferences is null until first saved). */
export async function getGameState(session: AppSession): Promise<GameState> {
  if (session?.kind === "child") {
    const data = await invokeEdge<GameState>("games", { action: "get_state", child_session_token: session.childSessionToken });
    return { progress: data.progress ?? [], preferences: data.preferences ?? null };
  }
  if (session?.kind !== "auth_user") throw new ContractError("unsupported_session");

  const supabase = getSafeSpaceClient();
  const [progress, prefs] = await Promise.all([
    supabase.from("game_progress").select(PROGRESS_COLUMNS).eq("profile_id", session.profile.id),
    supabase.from("game_preferences").select(PREFERENCE_COLUMNS).eq("profile_id", session.profile.id).maybeSingle(),
  ]);
  if (progress.error) throw toContractError(progress.error);
  if (prefs.error) throw toContractError(prefs.error);
  return { progress: (progress.data ?? []).map(toProgress), preferences: prefs.data ? toPreferences(prefs.data) : null };
}

/** Saves one finished round. Counts it and keeps the best score. */
export async function recordGameRound(session: AppSession, input: RecordGameRoundInput): Promise<void> {
  const round = cleanRound(input);
  if (session?.kind === "child") {
    await invokeEdge("games", {
      action: "record_round", game_id: round.gameId, difficulty: round.difficulty, score: round.score,
      child_session_token: session.childSessionToken,
    });
    return;
  }
  if (session?.kind !== "auth_user") throw new ContractError("unsupported_session");
  const { error } = await getSafeSpaceClient().rpc("record_game_round", {
    p_game_id: round.gameId, p_difficulty: round.difficulty, p_score: round.score,
  });
  if (error) throw toContractError(error);
}

export async function saveGamePreferences(session: AppSession, preferences: GamePreferences): Promise<void> {
  const p = cleanPreferences(preferences);
  if (session?.kind === "child") {
    await invokeEdge("games", {
      action: "save_preferences",
      preferences: { difficulty: p.difficulty, reduced_motion: p.reducedMotion, sound_enabled: p.soundEnabled, voice_enabled: p.voiceEnabled },
      child_session_token: session.childSessionToken,
    });
    return;
  }
  if (session?.kind !== "auth_user") throw new ContractError("unsupported_session");
  const { error } = await getSafeSpaceClient().rpc("save_game_preferences", {
    p_difficulty: p.difficulty, p_reduced_motion: p.reducedMotion, p_sound_enabled: p.soundEnabled, p_voice_enabled: p.voiceEnabled,
  });
  if (error) throw toContractError(error);
}

/**
 * Caregiver view of one child's games: rounds, best score and last played per
 * game and level. Under the caregiver's own RLS, so a child who isn't theirs
 * returns nothing.
 */
export async function getChildGameSummary(childId: string): Promise<GameProgress[]> {
  if (typeof childId !== "string" || !childId) throw new ContractError("invalid_input");
  const { data, error } = await getSafeSpaceClient()
    .from("game_progress")
    .select(PROGRESS_COLUMNS)
    .eq("child_id", childId)
    .order("last_played_at", { ascending: false });
  if (error) throw toContractError(error);
  return (data ?? []).map(toProgress);
}
