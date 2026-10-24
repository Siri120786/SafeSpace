import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getGameState, recordGameRound, saveGamePreferences } from "@safespace/api-client";
import type { AppSession } from "@safespace/shared-types";
import { GameAudio } from "./lib/audio";
import { resolveLanguage, text, usesFallbackLanguage, type GameId } from "./lib/content";
import { keepCreation, type Creation } from "./lib/imagine";
import {
  applyRound,
  defaultPrefs,
  deviceStorage,
  emptyState,
  flushPending,
  loadState,
  mergeRemote,
  saveState,
  type GameBackend,
  type LocalGameState,
  type Prefs,
} from "./lib/progress";
import { suggestDifficulty, type RoundResult, type Suggestion } from "./lib/scoring";

/** "device": saved here only. "account": also saved to the account. "later": waiting for the network. */
export type SaveStatus = "device" | "account" | "later";

interface GamesApi {
  ownerId: string;
  lang: string;
  languageFallback: boolean;
  prefs: Prefs;
  /** Calm mode: no animation, longer pauses. Either the player's choice or the device/caregiver setting. */
  calm: boolean;
  state: LocalGameState;
  audio: GameAudio;
  saveStatus: SaveStatus;
  setPrefs: (patch: Partial<Prefs>) => void;
  finishRound: (result: RoundResult) => void;
  addCreation: (c: Creation) => void;
  suggestionFor: (gameId: GameId) => Suggestion;
  t: (key: string, vars?: Record<string, string>) => string;
}

const Ctx = createContext<GamesApi | null>(null);

export function useGames(): GamesApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGames must be used inside GamesProvider");
  return v;
}

function backendFor(session: AppSession, guard: <T>(p: Promise<T>) => Promise<T>): GameBackend {
  return {
    fetch: async () => {
      const s = await guard(getGameState(session));
      return { progress: s.progress, prefs: s.preferences };
    },
    record: (r) => guard(recordGameRound(session, r)),
    savePrefs: (p) => guard(saveGamePreferences(session, p)),
  };
}

interface ProviderProps {
  session: AppSession;
  lowSensory: boolean;
  /** For children: signs out to the PIN page if the session has ended. */
  guard?: <T>(p: Promise<T>) => Promise<T>;
  children: React.ReactNode;
}

const identity = <T,>(p: Promise<T>) => p;

/**
 * Local-first progress for the signed-in player (adult or child). Play never
 * waits for the network; the account copy catches up when it can.
 */
export const GamesProvider: React.FC<ProviderProps> = ({ session, lowSensory, guard = identity, children }) => {
  const ownerId = session?.kind === "auth_user" ? session.profile.id : session?.kind === "child" ? session.childId : "";
  const wantedLang = typeof navigator !== "undefined" ? navigator.language : "en";
  const lang = resolveLanguage(wantedLang);

  const [state, setState] = useState<LocalGameState>(() => loadState(ownerId, deviceStorage()));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("device");
  const stateRef = useRef(state);
  const audio = useMemo(() => new GameAudio(), []);
  const backend = useMemo(() => (session ? backendFor(session, guard) : null), [session, guard]);

  const commit = useCallback(
    (fn: (s: LocalGameState) => LocalGameState) => {
      const next = fn(stateRef.current);
      stateRef.current = next;
      saveState(ownerId, next, deviceStorage());
      setState(next);
      return next;
    },
    [ownerId],
  );

  const syncing = useRef(false);
  const sync = useCallback(async () => {
    if (!backend || syncing.current) return;
    syncing.current = true;
    try {
      // A few passes, in case more rounds finish while we are sending.
      for (let pass = 0; pass < 3; pass++) {
        const snapshot = stateRef.current;
        const { state: after, ok } = await flushPending(snapshot, backend);
        const sent = snapshot.pending.length - after.pending.length;
        if (sent > 0) commit((s) => ({ ...s, pending: s.pending.slice(sent) }));
        if (!ok) {
          setSaveStatus("later");
          return;
        }
        if (stateRef.current.pending.length === 0) break;
      }
      setSaveStatus("account");
    } finally {
      syncing.current = false;
    }
  }, [backend, commit]);

  // First load: show device data at once, then fold in the account copy.
  useEffect(() => {
    let active = true;
    const local = loadState(ownerId, deviceStorage());
    stateRef.current = local;
    setState(local);
    if (!backend) return;
    (async () => {
      try {
        const remote = await backend.fetch();
        if (!active) return;
        commit((s) => mergeRemote(s, remote));
        await sync();
      } catch {
        if (active) setSaveStatus("later");
      }
    })();
    return () => {
      active = false;
    };
  }, [ownerId, backend, commit, sync]);

  const prefs = state.prefs ?? defaultPrefs(lowSensory);
  const calm = prefs.reducedMotion || lowSensory;

  useEffect(() => {
    audio.soundEnabled = prefs.soundEnabled;
    audio.voiceEnabled = prefs.voiceEnabled;
    audio.lang = lang;
  }, [audio, prefs.soundEnabled, prefs.voiceEnabled, lang]);

  useEffect(() => () => audio.dispose(), [audio]);

  const setPrefs = useCallback(
    (patch: Partial<Prefs>) => {
      const next = { ...(stateRef.current.prefs ?? defaultPrefs(lowSensory)), ...patch };
      commit((s) => ({ ...s, prefs: next }));
      backend?.savePrefs(next).catch(() => setSaveStatus("later"));
    },
    [backend, commit, lowSensory],
  );

  const finishRound = useCallback(
    (result: RoundResult) => {
      commit((s) => applyRound(s, result, new Date()));
      setSaveStatus("device");
      void sync();
    },
    [commit, sync],
  );

  const addCreation = useCallback((c: Creation) => commit((s) => ({ ...s, creations: keepCreation(s.creations, c) })), [commit]);

  const suggestionFor = useCallback(
    (gameId: GameId) => suggestDifficulty(prefs.difficulty, state.recent[gameId] ?? []),
    [prefs.difficulty, state.recent],
  );

  const t = useCallback((key: string, vars?: Record<string, string>) => text(key, vars, lang), [lang]);

  const value: GamesApi = {
    ownerId,
    lang,
    languageFallback: usesFallbackLanguage(wantedLang),
    prefs,
    calm,
    state,
    audio,
    saveStatus,
    setPrefs,
    finishRound,
    addCreation,
    suggestionFor,
    t,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
