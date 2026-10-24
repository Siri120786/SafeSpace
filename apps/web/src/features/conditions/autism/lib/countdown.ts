import type { CountdownPhase, CountdownSnapshot } from "../types";

/**
 * Pure state representation for the transition countdown timer.
 * Completely tick-driven and free of browser side-effects or setIntervals.
 */
export interface CountdownState {
  phase: CountdownPhase;
  activity: string;
  totalSeconds: number;
  secondsRemaining: number;
}

/**
 * Initializes a new countdown state.
 * Clamps negative seconds to zero and defaults activity to a friendly placeholder.
 */
export function initCountdown(
  activity: string,
  totalSeconds: number
): CountdownState {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const safeActivity = activity.trim() || "Next activity";

  return {
    phase: safeSeconds === 0 ? "done" : "idle",
    activity: safeActivity,
    totalSeconds: safeSeconds,
    secondsRemaining: safeSeconds,
  };
}

/**
 * Transition: Start countdown from idle (or resume if paused).
 */
export function startCountdown(state: CountdownState): CountdownState {
  if (state.phase === "running" || state.phase === "done") {
    return state;
  }
  if (state.totalSeconds <= 0 || state.secondsRemaining <= 0) {
    return {
      ...state,
      phase: "done",
      secondsRemaining: 0,
    };
  }
  return {
    ...state,
    phase: "running",
  };
}

/**
 * Transition: Pause a running countdown.
 */
export function pauseCountdown(state: CountdownState): CountdownState {
  if (state.phase !== "running") {
    return state;
  }
  return {
    ...state,
    phase: "paused",
  };
}

/**
 * Transition: Resume a paused countdown.
 */
export function resumeCountdown(state: CountdownState): CountdownState {
  if (state.phase !== "paused" || state.secondsRemaining <= 0) {
    return state;
  }
  return {
    ...state,
    phase: "running",
  };
}

/**
 * Transition: Reset countdown to initial idle state.
 * Optionally updates totalSeconds or activity if reconfiguring.
 */
export function resetCountdown(
  state: CountdownState,
  newTotalSeconds?: number,
  newActivity?: string
): CountdownState {
  const safeSeconds = Math.max(
    0,
    Math.floor(newTotalSeconds ?? state.totalSeconds)
  );
  const safeActivity = (newActivity ?? state.activity).trim() || "Next activity";

  return {
    phase: safeSeconds === 0 ? "done" : "idle",
    activity: safeActivity,
    totalSeconds: safeSeconds,
    secondsRemaining: safeSeconds,
  };
}

/**
 * Pure tick evaluation: Decrements secondsRemaining by deltaSeconds.
 * If secondsRemaining reaches 0 or below, cleanly transitions to "done".
 */
export function tickCountdown(
  state: CountdownState,
  deltaSeconds = 1
): CountdownState {
  if (state.phase !== "running") {
    return state;
  }

  const nextRemaining = Math.max(0, state.secondsRemaining - deltaSeconds);
  const nextPhase: CountdownPhase = nextRemaining === 0 ? "done" : "running";

  return {
    ...state,
    phase: nextPhase,
    secondsRemaining: nextRemaining,
  };
}

/**
 * Calculates remaining progress percentage (100% down to 0% for shrinking bar).
 */
export function getShrinkingProgress(state: CountdownState): number {
  if (state.totalSeconds <= 0) return 0;
  const ratio = state.secondsRemaining / state.totalSeconds;
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

/**
 * Coarse announcement generator for screen readers.
 * Emits polite announcements ONLY at coarse, important moments:
 * 1. Starting the countdown
 * 2. Exactly 1 minute remaining (60s)
 * 3. Completion ("done")
 * Returns null at all other seconds to prevent chatter.
 */
export function getCoarseAnnouncement(
  prev: CountdownState | null,
  curr: CountdownState
): string | null {
  // 1. Completion announcement
  if (curr.phase === "done" && prev?.phase !== "done") {
    return `Time is up. Next: ${curr.activity}. Take your time.`;
  }

  // 2. Start announcement
  if (curr.phase === "running" && prev?.phase === "idle") {
    const mins = Math.floor(curr.totalSeconds / 60);
    const secs = curr.totalSeconds % 60;
    const timeText =
      mins > 0
        ? `${mins} minute${mins === 1 ? "" : "s"}${secs > 0 ? ` and ${secs} seconds` : ""}`
        : `${secs} seconds`;
    return `Starting countdown. Next: ${curr.activity} in ${timeText}.`;
  }

  // 3. Exactly one minute left (60s)
  if (
    curr.phase === "running" &&
    curr.secondsRemaining === 60 &&
    prev?.secondsRemaining !== 60 &&
    curr.totalSeconds > 60
  ) {
    return `One minute remaining before ${curr.activity}.`;
  }

  return null;
}

/**
 * Derives a full display snapshot from the pure state.
 */
export function getCountdownSnapshot(
  prev: CountdownState | null,
  curr: CountdownState
): CountdownSnapshot {
  return {
    phase: curr.phase,
    activity: curr.activity,
    totalSeconds: curr.totalSeconds,
    secondsRemaining: curr.secondsRemaining,
    progressPercent: getShrinkingProgress(curr),
    coarseAnnouncement: getCoarseAnnouncement(prev, curr),
  };
}
