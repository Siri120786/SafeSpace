/** Pure breathing-exercise logic. No React, no DOM, so it can be unit tested. */

export type BreathingPhase = "inhale" | "hold" | "exhale";

export interface BreathingPattern {
  inhaleSeconds: number;
  holdSeconds: number;
  exhaleSeconds: number;
  /** How many full breaths make one session. */
  cycles: number;
}

export const DEFAULT_PATTERN: BreathingPattern = {
  inhaleSeconds: 4,
  holdSeconds: 4,
  exhaleSeconds: 6,
  cycles: 5,
};

export const PHASE_INSTRUCTIONS: Record<BreathingPhase, string> = {
  inhale: "Breathe in slowly through your nose",
  hold: "Hold gently. Keep your shoulders relaxed",
  exhale: "Breathe out slowly through your mouth",
};

export const PHASE_LABELS: Record<BreathingPhase, string> = {
  inhale: "Breathe in",
  hold: "Hold",
  exhale: "Breathe out",
};

export interface BreathingState {
  phase: BreathingPhase;
  /** Whole seconds left in this phase, counting down (never below 1 until done). */
  secondsLeft: number;
  /** 1-based number of the current breath. */
  cycle: number;
  /** 0..1, how far through the current phase we are. */
  phaseProgress: number;
  finished: boolean;
}

export function cycleSeconds(p: BreathingPattern): number {
  return p.inhaleSeconds + p.holdSeconds + p.exhaleSeconds;
}

export function totalSeconds(p: BreathingPattern): number {
  return cycleSeconds(p) * p.cycles;
}

/**
 * Work out where we are from the real elapsed time. Deriving the state from
 * elapsed milliseconds (instead of counting ticks) keeps the timer accurate
 * even if the browser delays a timer callback.
 */
export function getBreathingState(
  elapsedMs: number,
  pattern: BreathingPattern = DEFAULT_PATTERN,
): BreathingState {
  const elapsed = Math.max(0, elapsedMs) / 1000;
  const perCycle = cycleSeconds(pattern);

  if (elapsed >= totalSeconds(pattern)) {
    return { phase: "exhale", secondsLeft: 0, cycle: pattern.cycles, phaseProgress: 1, finished: true };
  }

  const cycleIndex = Math.floor(elapsed / perCycle);
  const inCycle = elapsed - cycleIndex * perCycle;

  let phase: BreathingPhase;
  let phaseStart: number;
  let phaseLength: number;
  if (inCycle < pattern.inhaleSeconds) {
    phase = "inhale";
    phaseStart = 0;
    phaseLength = pattern.inhaleSeconds;
  } else if (inCycle < pattern.inhaleSeconds + pattern.holdSeconds) {
    phase = "hold";
    phaseStart = pattern.inhaleSeconds;
    phaseLength = pattern.holdSeconds;
  } else {
    phase = "exhale";
    phaseStart = pattern.inhaleSeconds + pattern.holdSeconds;
    phaseLength = pattern.exhaleSeconds;
  }

  const intoPhase = inCycle - phaseStart;
  return {
    phase,
    secondsLeft: Math.max(1, Math.ceil(phaseLength - intoPhase)),
    cycle: cycleIndex + 1,
    phaseProgress: Math.min(1, intoPhase / phaseLength),
    finished: false,
  };
}
