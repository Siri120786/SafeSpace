/**
 * SafeSpace ADHD usePomodoro Hook
 * Sprint 3 Workstream B
 *
 * Wraps pure Pomodoro cycle state machine with a single interval and Date-based drift correction.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  advancePomodoroPhase,
  calculateRemainingFromDrift,
  initPomodoro,
  pausePomodoro,
  resetPomodoro,
  resumePomodoro,
  skipPomodoroPhase,
  startPomodoro,
} from "../lib/timerLogic";
import type {
  PomodoroConfig,
  PomodoroPhase,
  PomodoroState,
} from "../types";

export interface UsePomodoroOptions {
  initialConfig?: Partial<PomodoroConfig>;
  onPhaseComplete?: (phase: PomodoroPhase, cycle: number) => void;
}

export function usePomodoro({
  initialConfig,
  onPhaseComplete,
}: UsePomodoroOptions = {}) {
  const [state, setState] = useState<PomodoroState>(() =>
    initPomodoro(initialConfig)
  );

  const expectedEndTimeRef = useRef<number | null>(null);
  const onPhaseCompleteRef = useRef(onPhaseComplete);
  onPhaseCompleteRef.current = onPhaseComplete;

  const clearTimerInterval = useCallback(() => {
    expectedEndTimeRef.current = null;
  }, []);

  const start = useCallback(() => {
    setState((prev) => {
      expectedEndTimeRef.current = Date.now() + prev.remainingSeconds * 1000;
      return startPomodoro(prev);
    });
  }, []);

  const pause = useCallback(() => {
    expectedEndTimeRef.current = null;
    setState((prev) => pausePomodoro(prev));
  }, []);

  const resume = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "paused") return prev;
      expectedEndTimeRef.current = Date.now() + prev.remainingSeconds * 1000;
      return resumePomodoro(prev);
    });
  }, []);

  const reset = useCallback(
    (newConfig?: Partial<PomodoroConfig>) => {
      clearTimerInterval();
      setState((prev) => resetPomodoro(prev, newConfig));
    },
    [clearTimerInterval]
  );

  const skip = useCallback(() => {
    clearTimerInterval();
    setState((prev) => skipPomodoroPhase(prev));
  }, [clearTimerInterval]);

  const advance = useCallback(() => {
    clearTimerInterval();
    setState((prev) => advancePomodoroPhase(prev));
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
          status: "phaseCompleted",
        }));
        onPhaseCompleteRef.current?.(state.currentPhase, state.currentCycle);
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
  }, [state.status, state.currentPhase, state.currentCycle]);

  return {
    state,
    start,
    pause,
    resume,
    reset,
    skip,
    advance,
  };
}
