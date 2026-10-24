// Local-first progress. Everything a player does is saved on this device
// first; the account copy (Supabase) is best-effort and catches up later. A
// failed save never stops play (docs/games.md).
//
// The device copy is kept per person under the shared device-store prefix,
// so signing out clears it (step 10b). Kept creations live in the account
// (migration 20261029400000); one not yet saved waits here with the rounds.
import { STORAGE_PREFIX } from "../../wellness-ui/store/LocalDeviceStore";
import type { Difficulty, GameId } from "./content";
import type { Creation } from "./imagine";
import type { RecentRound, RoundResult } from "./scoring";

export interface ProgressRow {
  gameId: GameId;
  difficulty: Difficulty;
  roundsCompleted: number;
  bestScore: number | null;
  lastPlayedAt: string;
}

export interface Prefs {
  difficulty: Difficulty;
  reducedMotion: boolean;
  soundEnabled: boolean;
  voiceEnabled: boolean;
}

export interface PendingRound {
  gameId: GameId;
  difficulty: Difficulty;
  score: number | null;
}

export interface LocalGameState {
  v: 1;
  progress: ProgressRow[];
  /** Null until the player (or their caregiver's default) chooses. */
  prefs: Prefs | null;
  /** Last few rounds per game, only for the optional level suggestion. */
  recent: Partial<Record<GameId, RecentRound[]>>;
  /** Rounds not yet saved to the account. */
  pending: PendingRound[];
  /** Creations kept but not yet saved to the account. */
  pendingCreations: Creation[];
}

export const MAX_RECENT = 5;
export const MAX_PENDING = 50;

export const emptyState = (): LocalGameState => ({ v: 1, progress: [], prefs: null, recent: {}, pending: [], pendingCreations: [] });

export function defaultPrefs(lowSensory: boolean): Prefs {
  return { difficulty: "easy", reducedMotion: lowSensory, soundEnabled: !lowSensory, voiceEnabled: false };
}

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Adds one finished round to the local record. */
export function applyRound(state: LocalGameState, result: RoundResult, now: Date): LocalGameState {
  const score = result.score === null ? null : clampScore(result.score);
  const at = now.toISOString();
  const i = state.progress.findIndex((p) => p.gameId === result.gameId && p.difficulty === result.difficulty);
  const prev = i >= 0 ? state.progress[i] : null;
  const row: ProgressRow = {
    gameId: result.gameId,
    difficulty: result.difficulty,
    roundsCompleted: (prev?.roundsCompleted ?? 0) + 1,
    bestScore: score === null ? prev?.bestScore ?? null : Math.max(prev?.bestScore ?? -1, score),
    lastPlayedAt: at,
  };
  const progress = i >= 0 ? state.progress.map((p, k) => (k === i ? row : p)) : [...state.progress, row];
  const recent = {
    ...state.recent,
    [result.gameId]: [...(state.recent[result.gameId] ?? []), { difficulty: result.difficulty, mistakes: result.mistakes, hints: result.hints }].slice(-MAX_RECENT),
  };
  const pending = [...state.pending, { gameId: result.gameId, difficulty: result.difficulty, score }].slice(-MAX_PENDING);
  return { ...state, progress, recent, pending };
}

/** Stars collected so far: one per finished round. */
export const totalRounds = (rows: ProgressRow[]) => rows.reduce((n, r) => n + r.roundsCompleted, 0);

export function roundsFor(rows: ProgressRow[], gameId: GameId): number {
  return rows.filter((r) => r.gameId === gameId).reduce((n, r) => n + r.roundsCompleted, 0);
}

/**
 * Folds the account's copy into the local one without losing either: for each
 * game and level the larger count and best score win. Preferences from the
 * account are used only when none are saved locally.
 */
export function mergeRemote(local: LocalGameState, remote: { progress: ProgressRow[]; prefs: Prefs | null }): LocalGameState {
  const rows = new Map<string, ProgressRow>();
  const key = (r: ProgressRow) => `${r.gameId}:${r.difficulty}`;
  for (const r of local.progress) rows.set(key(r), r);
  for (const r of remote.progress) {
    const have = rows.get(key(r));
    if (!have) {
      rows.set(key(r), r);
      continue;
    }
    rows.set(key(r), {
      ...have,
      roundsCompleted: Math.max(have.roundsCompleted, r.roundsCompleted),
      bestScore: have.bestScore === null ? r.bestScore : r.bestScore === null ? have.bestScore : Math.max(have.bestScore, r.bestScore),
      lastPlayedAt: have.lastPlayedAt > r.lastPlayedAt ? have.lastPlayedAt : r.lastPlayedAt,
    });
  }
  return { ...local, progress: [...rows.values()], prefs: local.prefs ?? remote.prefs };
}

/** What the app needs from the account. Adults and children each have an adapter. */
export interface GameBackend {
  fetch(): Promise<{ progress: ProgressRow[]; prefs: Prefs | null }>;
  record(round: PendingRound): Promise<void>;
  savePrefs(prefs: Prefs): Promise<void>;
  listCreations(): Promise<Creation[]>;
  saveCreation(c: Creation): Promise<void>;
}

/** A creation as the account keeps it: its choices under the kind's own key. */
export function creationContent(c: Creation): Record<string, unknown> {
  return { [c.kind]: c[c.kind] ?? {} };
}

/** Sends waiting creations in order. Stops at the first failure and keeps the rest. */
export async function flushPendingCreations(state: LocalGameState, backend: GameBackend): Promise<{ state: LocalGameState; ok: boolean }> {
  let waiting = state.pendingCreations;
  while (waiting.length > 0) {
    try {
      await backend.saveCreation(waiting[0]);
    } catch {
      return { state: { ...state, pendingCreations: waiting }, ok: false };
    }
    waiting = waiting.slice(1);
  }
  return { state: { ...state, pendingCreations: waiting }, ok: true };
}

/** Sends waiting rounds in order. Stops at the first failure and keeps the rest. */
export async function flushPending(state: LocalGameState, backend: GameBackend): Promise<{ state: LocalGameState; ok: boolean }> {
  let pending = state.pending;
  while (pending.length > 0) {
    try {
      await backend.record(pending[0]);
    } catch {
      return { state: { ...state, pending }, ok: false };
    }
    pending = pending.slice(1);
  }
  return { state: { ...state, pending }, ok: true };
}

// ---- Device storage -------------------------------------------------------

/** Where a person's games are kept on this device; `owner` is the device-store owner ("p:<id>" or "c:<id>"). */
export const storageKey = (owner: string) => `${STORAGE_PREFIX}${owner}.games`;

/** Where they were kept before step 10b (never cleared on sign-out). */
export const legacyStorageKey = (id: string) => `safespace_games_v1_${id}`;

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type RemovableStorage = StorageLike & Pick<Storage, "removeItem">;

const isRows = (v: unknown): v is ProgressRow[] => Array.isArray(v);

/** Reads saved state. Anything missing, damaged or unavailable becomes a fresh state. */
export function loadState(ownerId: string, storage: StorageLike | null): LocalGameState {
  if (!storage) return emptyState();
  try {
    const raw = storage.getItem(storageKey(ownerId));
    if (!raw) return emptyState();
    const v = JSON.parse(raw) as Partial<LocalGameState>;
    if (!v || v.v !== 1) return emptyState();
    return {
      v: 1,
      progress: isRows(v.progress) ? v.progress : [],
      prefs: v.prefs ?? null,
      recent: v.recent && typeof v.recent === "object" ? v.recent : {},
      pending: Array.isArray(v.pending) ? v.pending : [],
      pendingCreations: Array.isArray(v.pendingCreations) ? v.pendingCreations : [],
    };
  } catch {
    return emptyState();
  }
}

/** Returns false when the device would not store it (private window, full, blocked). */
export function saveState(ownerId: string, state: LocalGameState, storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(storageKey(ownerId), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Moves a person's games from the old key (`safespace_games_v1_<id>`) to the
 * new one, once: progress, settings and waiting rounds come across (unless the
 * new key already has some), and creations kept on the device become
 * creations waiting to be saved to the account. The old key is removed.
 */
export function moveLegacyState(id: string, owner: string, storage: RemovableStorage | null): void {
  if (!storage) return;
  let raw: string | null = null;
  try {
    raw = storage.getItem(legacyStorageKey(id));
  } catch {
    return;
  }
  if (raw === null) return;
  try {
    const old = JSON.parse(raw) as Partial<LocalGameState> & { creations?: unknown };
    if (old && old.v === 1) {
      const current = loadState(owner, storage);
      const fresh = current.progress.length === 0 && current.pending.length === 0 && current.prefs === null;
      const base: LocalGameState = fresh
        ? {
            v: 1,
            progress: Array.isArray(old.progress) ? old.progress : [],
            prefs: old.prefs ?? null,
            recent: old.recent && typeof old.recent === "object" ? old.recent : {},
            pending: Array.isArray(old.pending) ? old.pending : [],
            pendingCreations: [],
          }
        : current;
      const kept = Array.isArray(old.creations) ? (old.creations as Creation[]) : [];
      saveState(owner, { ...base, pendingCreations: [...base.pendingCreations, ...kept].slice(0, 12) }, storage);
    }
  } catch {
    // Damaged: nothing worth moving.
  }
  try {
    storage.removeItem(legacyStorageKey(id));
  } catch {
    // Storage unavailable.
  }
}

export function deviceStorage(): RemovableStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
