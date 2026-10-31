import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PATTERN, getBreathingState, totalSeconds, type BreathingPattern } from "../lib/breathing";

const TICK_MS = 100;

/**
 * A breathing session's timer: start, pause, resume and reset, with the
 * state worked out from real elapsed time (lib/breathing.ts). Shared by the
 * breathing exercise and Calm Space's ocean breathing.
 */
export function useBreathingTimer(pattern: BreathingPattern = DEFAULT_PATTERN) {
  const totalMs = totalSeconds(pattern) * 1000;
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  // Time already banked before the current run, and when the current run began.
  const bankedRef = useRef(0);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startedAtRef.current = performance.now();
    const id = window.setInterval(() => {
      const total = bankedRef.current + (performance.now() - startedAtRef.current);
      if (total >= totalMs) {
        bankedRef.current = totalMs;
        setElapsedMs(totalMs);
        setRunning(false);
        return;
      }
      setElapsedMs(total);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running, totalMs]);

  const start = useCallback(() => {
    if (bankedRef.current >= totalMs) {
      bankedRef.current = 0;
      setElapsedMs(0);
    }
    setRunning(true);
  }, [totalMs]);

  const pause = useCallback(() => {
    bankedRef.current += performance.now() - startedAtRef.current;
    setElapsedMs(bankedRef.current);
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    bankedRef.current = 0;
    setElapsedMs(0);
    setRunning(false);
  }, []);

  const state = getBreathingState(elapsedMs, pattern);
  const notStarted = !running && elapsedMs === 0;
  const paused = !running && elapsedMs > 0 && !state.finished;
  return { pattern, state, running, notStarted, paused, start, pause, reset };
}
