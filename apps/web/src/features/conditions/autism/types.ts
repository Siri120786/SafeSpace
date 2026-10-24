import { ROUTINE_STEP_ICONS, type MoodValue, type RoutineStepWithProgress } from "@safespace/shared-types";

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
 * Maps a routine step (with today's completion) from @safespace/shared-types
 * to a schedule step: the step's icon key becomes its emoji, and "complete"
 * means completed on the day the list was loaded for.
 */
export function toScheduleStep(routineStep: RoutineStepWithProgress): ScheduleStep {
  return {
    id: routineStep.id,
    label: routineStep.label,
    timeEstimate: routineStep.scheduledTime ?? undefined,
    icon: routineStep.icon ? ROUTINE_STEP_ICONS[routineStep.icon].emoji : undefined,
    isComplete: routineStep.completedOnDate,
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
