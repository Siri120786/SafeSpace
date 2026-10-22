import type { MoodValue, RoutineStep } from "@safespace/shared-types";

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

// ============================================================================
// VISUAL SCHEDULE TYPES & ADAPTER
// ============================================================================

export interface ScheduleStep {
  id: string;
  label: string;
  timeEstimate?: string;
  icon?: string;
  isComplete: boolean;
  orderIndex: number;
}

export type ScheduleStepRole = "now" | "next" | "later" | "done";

/**
 * NOT connected to routine_steps: child sessions have no DB access yet.
 * A future adapter must map RoutineStep from @safespace/shared-types to this interface.
 */
export function toScheduleStep(routineStep: RoutineStep): ScheduleStep {
  return {
    id: routineStep.id,
    label: routineStep.label,
    timeEstimate: routineStep.scheduledTime ?? undefined,
    isComplete: routineStep.isComplete,
    orderIndex: routineStep.orderIndex,
  };
}

// ============================================================================
// AAC-LITE TYPES
// ============================================================================

export interface AacTile {
  id: string;
  label: string;
  emoji: string;
  category: "needs" | "social" | "feelings" | "actions";
}

export interface AacConfig {
  customLabels: Record<string, string>;
}

// ============================================================================
// SPECIAL-INTEREST THEMES
// ============================================================================

export type AutismThemeKey = "calm" | "space" | "animals" | "trains" | "nature" | "ocean";

export interface ThemeDefinition {
  key: AutismThemeKey;
  label: string;
  icon: string;
  description: string;
  cssVariables: Record<string, string>;
}
