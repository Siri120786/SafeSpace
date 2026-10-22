/**
 * SafeSpace ADHD useFocusTimer Hook
 * Sprint 3 Workstream B
 *
 * Wraps pure focus timer logic with a single interval and Date-based drift correction.
 * Guarantees zero time drift even if the browser tab is throttled in the background.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  calculateRemainingFromDrift,
  initFocusTimer,
  pauseFocusTimer,
  resetFocusTimer,
  resumeFocusTimer,
  startFocusTimer,
  stopFocusTimerWithoutPenalty,
} from "../lib/timerLogic";
import type { FocusTimerState } from "../types";

export interface UseFocusTimerOptions {
  initialDurationSeconds?: number;
  activityLabel?: string;
  onComplete?: (durationSeconds: number, label?: string) => void;
}

export function useFocusTimer({
  initialDurationSeconds = 1500,
  activityLabel,
  onComplete,
}: UseFocusTimerOptions = {}) {
  const [state, setState] = useState<FocusTimerState>(() =>
    initFocusTimer(initialDurationSeconds, activityLabel)
  );

  const expectedEndTimeRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const clearTimerInterval = useCallback(() => {
    expectedEndTimeRef.current = null;
  }, []);

  const start = useCallback((durationSeconds?: number, label?: string) => {
    setState((prev) => {
      const activeDuration = durationSeconds ?? prev.durationSeconds;
      const targetDuration = Math.max(1, Math.round(activeDuration));
      expectedEndTimeRef.current = Date.now() + targetDuration * 1000;
      return startFocusTimer({
        ...prev,
        durationSeconds: targetDuration,
        remainingSeconds: targetDuration,
        activityLabel: label ?? prev.activityLabel,
      });
    });
  }, []);

  const pause = useCallback(() => {
    expectedEndTimeRef.current = null;
    setState((prev) => pauseFocusTimer(prev));
  }, []);

  const resume = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "paused") return prev;
      expectedEndTimeRef.current = Date.now() + prev.remainingSeconds * 1000;
      return resumeFocusTimer(prev);
    });
  }, []);

  const reset = useCallback((newDurationSeconds?: number) => {
    clearTimerInterval();
    setState((prev) => resetFocusTimer(prev, newDurationSeconds));
  }, [clearTimerInterval]);

  const stop = useCallback(() => {
    clearTimerInterval();
    setState((prev) => stopFocusTimerWithoutPenalty(prev));
  }, [clearTimerInterval]);

  // Single active interval with drift correction
  useEffect(() => {
    if (state.status !== "running") return;

    const intervalId = window.setInterval(() => {
      if (!expectedEndTimeRef.current) return;

      const now = Date.now();
      const accurateRemaining = calculateRemainingFromDrift(
        expectedEndTimeRef.current,
        now
      );

      if (accurateRemaining <= 0) {
        expectedEndTimeRef.current = null;
        setState((prev) => ({
          ...prev,
          remainingSeconds: 0,
          status: "completed",
        }));
        onCompleteRef.current?.(state.durationSeconds, state.activityLabel);
      } else {
        setState((prev) => {
          if (prev.status !== "running") return prev;
          return {
            ...prev,
            remainingSeconds: accurateRemaining,
          };
        });
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [state.status, state.durationSeconds, state.activityLabel]);

  return {
    state,
    start,
    pause,
    resume,
    reset,
    stop,
  };
}
