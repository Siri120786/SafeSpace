/**
 * SafeSpace ADHD Timer Pure State Machines
 * Sprint 3 Workstream B
 *
 * Deterministic, tick-driven timer state machines.
 * Strictly no window.setInterval, Date.now, or side-effects inside these functions.
 */

import type {
  FocusTimerState,
  PomodoroConfig,
  PomodoroPhase,
  PomodoroState,
} from "../types";
import { DEFAULT_POMODORO_CONFIG, FOCUS_PRESET_SECONDS } from "../types";
export { FOCUS_PRESET_SECONDS };

// ─── Pomodoro Config & Duration Clamping ──────────────────────────────────────

export function clampPomodoroConfig(config?: Partial<PomodoroConfig>): PomodoroConfig {
  const c = { ...DEFAULT_POMODORO_CONFIG, ...config };
  return {
    focusMinutes: Math.max(1, Math.min(60, Math.round(c.focusMinutes || 25))),
    shortBreakMinutes: Math.max(1, Math.min(30, Math.round(c.shortBreakMinutes || 5))),
    longBreakMinutes: Math.max(5, Math.min(60, Math.round(c.longBreakMinutes || 15))),
    cyclesBeforeLongBreak: Math.max(1, Math.min(10, Math.round(c.cyclesBeforeLongBreak || 4))),
  };
}

export function getPhaseDurationSeconds(
  phase: PomodoroPhase,
  config: PomodoroConfig
): number {
  switch (phase) {
    case "focus":
      return config.focusMinutes * 60;
    case "shortBreak":
      return config.shortBreakMinutes * 60;
    case "longBreak":
      return config.longBreakMinutes * 60;
  }
}

// ─── Simple Focus Timer State Machine ─────────────────────────────────────────

export function initFocusTimer(
  durationSeconds: number,
  activityLabel?: string
): FocusTimerState {
  const safeSeconds = Math.max(1, Math.round(durationSeconds));
  return {
    durationSeconds: safeSeconds,
    remainingSeconds: safeSeconds,
    status: "idle",
    activityLabel: activityLabel?.trim() || undefined,
  };
}

export function startFocusTimer(state: FocusTimerState): FocusTimerState {
  if (state.status === "running") return state;
  const resetRemaining =
    state.remainingSeconds <= 0 || state.status === "completed"
      ? state.durationSeconds
      : state.remainingSeconds;
  return {
    ...state,
    remainingSeconds: resetRemaining,
    status: "running",
  };
}

export function pauseFocusTimer(state: FocusTimerState): FocusTimerState {
  if (state.status !== "running") return state;
  return {
    ...state,
    status: "paused",
  };
}

export function resumeFocusTimer(state: FocusTimerState): FocusTimerState {
  if (state.status !== "paused") return state;
  return {
    ...state,
    status: "running",
  };
}

export function resetFocusTimer(
  state: FocusTimerState,
  newDurationSeconds?: number
): FocusTimerState {
  const duration = newDurationSeconds
    ? Math.max(1, Math.round(newDurationSeconds))
    : state.durationSeconds;
  return {
    ...state,
    durationSeconds: duration,
    remainingSeconds: duration,
    status: "idle",
  };
}

/**
 * Gracefully stop a focus session without penalty or guilt.
 * Preserves gentle ADHD-friendly pacing.
 */
export function stopFocusTimerWithoutPenalty(state: FocusTimerState): FocusTimerState {
  return {
    ...state,
    remainingSeconds: state.durationSeconds,
    status: "idle",
  };
}

export function tickFocusTimer(
  state: FocusTimerState,
  elapsedSeconds = 1
): FocusTimerState {
  if (state.status !== "running") return state;
  const safeElapsed = Math.max(0, Math.round(elapsedSeconds));
  const nextRemaining = Math.max(0, state.remainingSeconds - safeElapsed);

  return {
    ...state,
    remainingSeconds: nextRemaining,
    status: nextRemaining === 0 ? "completed" : "running",
  };
}

// ─── Pomodoro Cycle State Machine ─────────────────────────────────────────────

export function initPomodoro(config?: Partial<PomodoroConfig>): PomodoroState {
  const clamped = clampPomodoroConfig(config);
  const phaseSeconds = getPhaseDurationSeconds("focus", clamped);
  return {
    config: clamped,
    currentPhase: "focus",
    currentCycle: 1,
    completedCycles: 0,
    remainingSeconds: phaseSeconds,
    phaseDurationSeconds: phaseSeconds,
    status: "idle",
  };
}

export function startPomodoro(state: PomodoroState): PomodoroState {
  if (state.status === "running") return state;
  const resetRemaining =
    state.remainingSeconds <= 0 || state.status === "phaseCompleted"
      ? state.phaseDurationSeconds
      : state.remainingSeconds;
  return {
    ...state,
    remainingSeconds: resetRemaining,
    status: "running",
  };
}

export function pausePomodoro(state: PomodoroState): PomodoroState {
  if (state.status !== "running") return state;
  return {
    ...state,
    status: "paused",
  };
}

export function resumePomodoro(state: PomodoroState): PomodoroState {
  if (state.status !== "paused") return state;
  return {
    ...state,
    status: "running",
  };
}

export function resetPomodoro(
  state: PomodoroState,
  newConfig?: Partial<PomodoroConfig>
): PomodoroState {
  return initPomodoro(newConfig ?? state.config);
}

/**
 * Transitions to the next phase in the Pomodoro cycle:
 * Focus (cycle 1..N-1) -> Short Break -> Focus
 * Focus (cycle N)      -> Long Break  -> Focus (cycle 1)
 */
export function advancePomodoroPhase(state: PomodoroState): PomodoroState {
  let nextPhase: PomodoroPhase;
  let nextCycle = state.currentCycle;
  let nextCompletedCycles = state.completedCycles;

  if (state.currentPhase === "focus") {
    nextCompletedCycles += 1;
    if (state.currentCycle >= state.config.cyclesBeforeLongBreak) {
      nextPhase = "longBreak";
    } else {
      nextPhase = "shortBreak";
    }
  } else if (state.currentPhase === "shortBreak") {
    nextPhase = "focus";
    nextCycle = state.currentCycle + 1;
  } else {
    // completed longBreak -> restart cycle 1
    nextPhase = "focus";
    nextCycle = 1;
  }

  const phaseDuration = getPhaseDurationSeconds(nextPhase, state.config);

  return {
    ...state,
    currentPhase: nextPhase,
    currentCycle: nextCycle,
    completedCycles: nextCompletedCycles,
    phaseDurationSeconds: phaseDuration,
    remainingSeconds: phaseDuration,
    status: "idle",
  };
}

export function skipPomodoroPhase(state: PomodoroState): PomodoroState {
  return advancePomodoroPhase(state);
}

export function tickPomodoro(
  state: PomodoroState,
  elapsedSeconds = 1
): PomodoroState {
  if (state.status !== "running") return state;
  const safeElapsed = Math.max(0, Math.round(elapsedSeconds));
  const nextRemaining = Math.max(0, state.remainingSeconds - safeElapsed);

  if (nextRemaining === 0) {
    return {
      ...state,
      remainingSeconds: 0,
      status: "phaseCompleted",
    };
  }

  return {
    ...state,
    remainingSeconds: nextRemaining,
    status: "running",
  };
}

// ─── Drift Correction & Format Utilities ──────────────────────────────────────

/**
 * Computes remaining seconds from target end timestamp, avoiding interval drift
 * caused by throttled browser background tabs.
 */
export function calculateRemainingFromDrift(
  expectedEndTimeMs: number,
  nowMs: number
): number {
  if (nowMs >= expectedEndTimeMs) return 0;
  return Math.max(0, Math.ceil((expectedEndTimeMs - nowMs) / 1000));
}

export function formatTime(seconds: number): {
  minutes: number;
  seconds: number;
  digital: string;
  verbal: string;
} {
  const s = Math.max(0, Math.round(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  const digital = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  const verbal =
    mins === 0
      ? `${secs} seconds remaining`
      : secs === 0
      ? `${mins} minute${mins === 1 ? "" : "s"} remaining`
      : `${mins} minute${mins === 1 ? "" : "s"} and ${secs} second${secs === 1 ? "" : "s"} remaining`;

  return { minutes: mins, seconds: secs, digital, verbal };
}

/**
 * Coarse announcement logic: announces only at start, at 60 seconds left, and upon completion.
 * Avoids constant screen reader chatter.
 */
export function getCoarseTimerAnnouncement(
  remainingSeconds: number,
  totalDurationSeconds: number,
  phaseTitle = "Timer"
): string | null {
  if (remainingSeconds === totalDurationSeconds) {
    return `${phaseTitle} started. ${Math.round(totalDurationSeconds / 60)} minutes total.`;
  }
  if (remainingSeconds === 60) {
    return `One minute remaining in ${phaseTitle}.`;
  }
  if (remainingSeconds === 0) {
    return `${phaseTitle} complete. Great job!`;
  }
  return null;
}
