/**
 * SafeSpace ADHD Rewards & Progress Pure Logic
 * Sprint 3 Workstream B
 *
 * Implements idempotent star awarding for completed task steps and habit checks.
 * Un-ticking and re-ticking can NEVER farm stars.
 */

import type { RewardGoal, RewardState } from "../types";
import { DEFAULT_REWARD_GOAL, INITIAL_REWARD_STATE } from "../types";

export type RewardSource = "task_step" | "habit_day";

/**
 * Builds a deterministic, unique key identifying a reward-eligible event.
 * Format: `${source}:${sourceId}:${dateKey}`
 */
export function buildRewardEventKey(
  source: RewardSource,
  sourceId: string,
  dateKey: string
): string {
  return `${source}:${sourceId}:${dateKey}`;
}

/**
 * Idempotently awards stars for an event.
 * If the eventKey is already recorded in state.awardedEventKeys,
 * no stars are awarded and the original state is returned unchanged.
 */
export function awardStarsIdempotent(
  state: RewardState = INITIAL_REWARD_STATE,
  source: RewardSource,
  sourceId: string,
  dateKey: string,
  starsToAward = 1
): { updatedState: RewardState; wasAwarded: boolean } {
  const eventKey = buildRewardEventKey(source, sourceId, dateKey);

  // IDEMPOTENCY CHECK: if this event was already awarded, do NOT award again!
  if (state.awardedEventKeys.includes(eventKey)) {
    return {
      updatedState: state,
      wasAwarded: false,
    };
  }

  const safeStars = Math.max(1, Math.round(starsToAward));
  const updatedState: RewardState = {
    ...state,
    currentStars: state.currentStars + safeStars,
    lifetimeStars: state.lifetimeStars + safeStars,
    awardedEventKeys: [...state.awardedEventKeys, eventKey],
  };

  return {
    updatedState,
    wasAwarded: true,
  };
}

/**
 * Calculates current goal completion percentage.
 */
export function calculateGoalProgress(state: RewardState): {
  current: number;
  target: number;
  percent: number;
  isGoalReached: boolean;
} {
  const target = Math.max(1, state.goal.targetStars);
  const current = Math.max(0, state.currentStars);
  const percent = Math.min(100, Math.round((current / target) * 100));
  const isGoalReached = current >= target;

  return { current, target, percent, isGoalReached };
}

/**
 * Redeems the current goal by subtracting targetStars from currentStars.
 * Retains lifetimeStars and all awardedEventKeys to preserve historical idempotency.
 */
export function redeemGoal(state: RewardState): {
  updatedState: RewardState;
  success: boolean;
} {
  const target = state.goal.targetStars;
  if (state.currentStars < target) {
    return { updatedState: state, success: false };
  }

  return {
    updatedState: {
      ...state,
      currentStars: state.currentStars - target,
    },
    success: true,
  };
}

/**
 * Updates the user-chosen reward goal with sanitized values.
 */
export function updateGoal(
  state: RewardState,
  newGoal: Partial<RewardGoal>
): RewardState {
  return {
    ...state,
    goal: {
      ...state.goal,
      ...newGoal,
      title: newGoal.title?.trim() || state.goal.title,
      targetStars: Math.max(1, Math.min(100, Math.round(newGoal.targetStars ?? state.goal.targetStars))),
      icon: newGoal.icon || state.goal.icon,
    },
  };
}
