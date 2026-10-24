// apps/web/src/features/mood/hooks/useMoodCheckIn.ts
// React hook encapsulating state and API interaction for the Mood Check-in feature.

import { useState, useEffect, useCallback } from "react";
import type { AppSession, MoodCheckin, MoodValue } from "@safespace/shared-types";
import {
  createMoodCheckin,
  listMyMoodCheckins,
} from "@safespace/api-client";
import {
  prepareMoodCheckInPayload,
  getFriendlyErrorMessage,
} from "../utils/moodLogic";

export type MoodCheckInStatus = "idle" | "saving" | "saved" | "error";
export type MoodHistoryStatus = "loading" | "ready" | "error";

export interface UseMoodCheckInReturn {
  selectedMood: MoodValue | null;
  setSelectedMood: (mood: MoodValue | null) => void;
  intensity: number | null;
  setIntensity: (intensity: number | null) => void;
  note: string;
  setNote: (note: string) => void;
  status: MoodCheckInStatus;
  history: MoodCheckin[];
  historyStatus: MoodHistoryStatus;
  errorMessage: string | null;
  historyErrorMessage: string | null;
  saveCheckIn: () => Promise<MoodCheckin | null>;
  retrySave: () => Promise<MoodCheckin | null>;
  refreshHistory: () => Promise<void>;
  resetForm: () => void;
}

export function useMoodCheckIn(session: AppSession): UseMoodCheckInReturn {
  const [selectedMood, setSelectedMood] = useState<MoodValue | null>(null);
  const [intensity, setIntensity] = useState<number | null>(null);
  const [note, setNote] = useState<string>("");

  const [status, setStatus] = useState<MoodCheckInStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [history, setHistory] = useState<MoodCheckin[]>([]);
  const [historyStatus, setHistoryStatus] = useState<MoodHistoryStatus>("loading");
  const [historyErrorMessage, setHistoryErrorMessage] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!session) {
      setHistory([]);
      setHistoryStatus("ready");
      return;
    }

    setHistoryStatus("loading");
    setHistoryErrorMessage(null);

    try {
      const items = await listMyMoodCheckins(session, { limit: 30 });
      setHistory(items);
      setHistoryStatus("ready");
    } catch (err) {
      setHistoryErrorMessage(getFriendlyErrorMessage(err, "load"));
      setHistoryStatus("error");
    }
  }, [session]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const saveCheckIn = useCallback(async (): Promise<MoodCheckin | null> => {
    if (!session) {
      setStatus("error");
      setErrorMessage("Please sign in to save your mood check-in.");
      return null;
    }

    const validation = prepareMoodCheckInPayload(selectedMood, intensity, note);
    if (!validation.valid) {
      setStatus("error");
      setErrorMessage(getFriendlyErrorMessage(new Error(validation.error)));
      return null;
    }

    setStatus("saving");
    setErrorMessage(null);

    try {
      const created = await createMoodCheckin(session, validation.payload);
      setStatus("saved");
      setErrorMessage(null);

      // Refresh history so the new entry appears immediately
      await loadHistory();
      return created;
    } catch (err) {
      setStatus("error");
      setErrorMessage(getFriendlyErrorMessage(err));
      return null;
    }
  }, [session, selectedMood, intensity, note, loadHistory]);

  const retrySave = useCallback(() => {
    return saveCheckIn();
  }, [saveCheckIn]);

  const resetForm = useCallback(() => {
    setSelectedMood(null);
    setIntensity(null);
    setNote("");
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  return {
    selectedMood,
    setSelectedMood,
    intensity,
    setIntensity,
    note,
    setNote,
    status,
    history,
    historyStatus,
    errorMessage,
    historyErrorMessage,
    saveCheckIn,
    retrySave,
    refreshHistory: loadHistory,
    resetForm,
  };
}
