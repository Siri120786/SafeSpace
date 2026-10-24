import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getGameState, listGameCreations, recordGameRound, saveGameCreation, saveGamePreferences } from "@safespace/api-client";
import type { AppSession } from "@safespace/shared-types";
import { deviceOwnerFor } from "../auth/roleRouting";
import { runBeforeSignOut } from "../auth/beforeSignOut";
import { GameAudio } from "./lib/audio";
import { resolveLanguage, text, usesFallbackLanguage, type GameId } from "./lib/content";
import { keepCreation, type Creation } from "./lib/imagine";
import {
  applyRound,
  creationContent,
  defaultPrefs,
  deviceStorage,
  flushPending,
  flushPendingCreations,
  loadState,
  mergeRemote,
  moveLegacyState,
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
  /** Kept creations, newest first: the account's, plus any still waiting to be saved. */
  creations: Creation[];
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
    listCreations: async () => (await guard(listGameCreations(session))) as Creation[],
    saveCreation: (c) => guard(saveGameCreation(session, { id: c.id, kind: c.kind, content: creationContent(c) })),
  };
}

// Sign-out clears the device copy, so whatever is waiting is sent first.
let flushBeforeSignOut: (() => Promise<void>) | null = null;
runBeforeSignOut(async () => {
  await flushBeforeSignOut?.();
});

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
  // The device copy's owner key ("p:<id>" or "c:<id>"), cleared on sign-out.
  const deviceOwner = deviceOwnerFor(session) ?? "";
  const wantedLang = typeof navigator !== "undefined" ? navigator.language : "en";
  const lang = resolveLanguage(wantedLang);

  const [state, setState] = useState<LocalGameState>(() => {
    moveLegacyState(ownerId, deviceOwner, deviceStorage());
    return loadState(deviceOwner, deviceStorage());
  });
  const [accountCreations, setAccountCreations] = useState<Creation[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("device");
  const stateRef = useRef(state);
  const audio = useMemo(() => new GameAudio(), []);
  const backend = useMemo(() => (session ? backendFor(session, guard) : null), [session, guard]);

  const commit = useCallback(
    (fn: (s: LocalGameState) => LocalGameState) => {
      const next = fn(stateRef.current);
      stateRef.current = next;
      saveState(deviceOwner, next, deviceStorage());
      setState(next);
      return next;
    },
    [deviceOwner],
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
      const waiting = stateRef.current;
      if (waiting.pendingCreations.length > 0) {
        const { state: after, ok } = await flushPendingCreations(waiting, backend);
        const kept = waiting.pendingCreations.length - after.pendingCreations.length;
        if (kept > 0) {
          commit((s) => ({ ...s, pendingCreations: s.pendingCreations.slice(kept) }));
          setAccountCreations(await backend.listCreations().catch(() => accountCreationsRef.current));
        }
        if (!ok) {
          setSaveStatus("later");
          return;
        }
      }
      setSaveStatus("account");
    } finally {
      syncing.current = false;
    }
  }, [backend, commit]);

  const accountCreationsRef = useRef(accountCreations);
  accountCreationsRef.current = accountCreations;

  // First load: show device data at once, then fold in the account copy.
  useEffect(() => {
    let active = true;
    moveLegacyState(ownerId, deviceOwner, deviceStorage());
    const local = loadState(deviceOwner, deviceStorage());
    stateRef.current = local;
    setState(local);
    setAccountCreations([]);
    if (!backend) return;
    (async () => {
      try {
        const [remote, kept] = await Promise.all([backend.fetch(), backend.listCreations()]);
        if (!active) return;
        commit((s) => mergeRemote(s, remote));
        setAccountCreations(kept);
        await sync();
      } catch {
        if (active) setSaveStatus("later");
      }
    })();
    return () => {
      active = false;
    };
  }, [ownerId, deviceOwner, backend, commit, sync]);

  // Anything waiting goes to the account before sign-out clears this device.
  useEffect(() => {
    flushBeforeSignOut = sync;
    return () => {
      if (flushBeforeSignOut === sync) flushBeforeSignOut = null;
    };
  }, [sync]);

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

  const addCreation = useCallback(
    (c: Creation) => {
      commit((s) => ({ ...s, pendingCreations: [...s.pendingCreations.filter((x) => x.id !== c.id), c] }));
      void sync();
    },
    [commit, sync],
  );

  // Newest first, at most 12: those waiting to be saved, then the account's.
  const creations = useMemo(
    () => [...state.pendingCreations, ...accountCreations].reduceRight<Creation[]>((list, c) => keepCreation(list, c), []),
    [state.pendingCreations, accountCreations],
  );

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
    creations,
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
