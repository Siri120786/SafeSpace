import type { MoodValue } from "@safespace/shared-types";

/**
 * Friendly emotion card representation for visual selection.
 */
export interface EmotionCardItem {
  id: string;
  label: string;
  emoji: string;
  /** Matches shared-types MoodValue when applicable. */
  sharedMoodValue?: MoodValue;
  /** Gentle supportive phrase shown upon selection. */
  // Content needing review: non-clinical supportive prompt
  reassurance: string;
}

/**
 * Saved historical record of a card tapped by the child on-device.
 * Only stores the selected card identifier and timestamp (never free text).
 */
export interface EmotionSelection {
  cardId: string;
  label: string;
  emoji: string;
  selectedAt: string; // ISO 8601 string
}

/**
 * Countdown state machine phase.
 */
export type CountdownPhase = "idle" | "running" | "paused" | "done";

/**
 * Transition countdown configuration.
 */
export interface TransitionConfig {
  activity: string;
  totalSeconds: number;
}

/**
 * Pure state machine snapshot for the transition timer.
 */
export interface CountdownSnapshot {
  phase: CountdownPhase;
  activity: string;
  totalSeconds: number;
  secondsRemaining: number;
  progressPercent: number; // 0 to 100
  coarseAnnouncement: string | null;
}
