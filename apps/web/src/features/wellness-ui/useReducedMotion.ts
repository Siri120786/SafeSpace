import { useLowSensory } from "../calm-tools";
import { resolveLowSensory } from "../calm-tools/lib/lowSensory";

export interface ReducedMotionResult {
  /** True when animations, transitions, and motion effects should be reduced or disabled. */
  reducedMotion: boolean;
  /** Direct alias for reducedMotion to preserve low-sensory terminology. */
  isLowSensory: boolean;
  /** Error message if saved comfort preferences could not be fetched, or null if resolved cleanly. */
  preferenceError: string | null;
}

/**
 * Hook providing reduced motion / low-sensory status.
 * Wraps the existing `useLowSensory` hook to ensure a single source of truth
 * for both OS `prefers-reduced-motion` and user profile comfort preferences.
 * Gracefully falls back to OS preference when rendered outside of AuthProvider (e.g. in tests/SSR).
 */
export function useReducedMotion(): ReducedMotionResult {
  try {
    const { lowSensory, preferenceError } = useLowSensory();
    return {
      reducedMotion: lowSensory,
      isLowSensory: lowSensory,
      preferenceError,
    };
  } catch {
    const osReduced =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
    return {
      reducedMotion: osReduced,
      isLowSensory: osReduced,
      preferenceError: null,
    };
  }
}

export { resolveLowSensory };
