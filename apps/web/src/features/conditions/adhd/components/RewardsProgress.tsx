/**
 * SafeSpace ADHD Rewards & Progress Component
 * Sprint 3 Workstream B
 *
 * Visual star collection progress toward a user-chosen reward goal.
 * Calm celebration state uses static text/emoji when reduced motion is on.
 */

import React, { useEffect, useState } from "react";
import {
  BigButton,
  DeviceOnlyNote,
  ProgressBar,
  SoftBadge,
  useReducedMotion,
} from "../../../wellness-ui";
import { calculateGoalProgress } from "../lib/rewardLogic";
import { createRewardService } from "../services";
import type { RewardState } from "../types";
import { INITIAL_REWARD_STATE } from "../types";

export interface RewardsProgressProps {
  className?: string;
  refreshTrigger?: number;
  // False for a child: a caregiver sets their goal (role-flow 8e).
  canEditGoal?: boolean;
}

export const RewardsProgress: React.FC<RewardsProgressProps> = ({
  className = "",
  refreshTrigger = 0,
  canEditGoal = true,
}) => {
  const rewardService = createRewardService();
  const { reducedMotion } = useReducedMotion();

  const [state, setState] = useState<RewardState>(INITIAL_REWARD_STATE);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState(10);
  const [justClaimed, setJustClaimed] = useState(false);

  const loadState = async () => {
    try {
      const s = await rewardService.getState();
      setState(s);
      setGoalTitle(s.goal.title);
      setGoalTarget(s.goal.targetStars);
    } catch {
      // Graceful local handling
    }
  };

  useEffect(() => {
    loadState();
  }, [refreshTrigger]);

  const { current, target, percent, isGoalReached } = calculateGoalProgress(state);

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;

    try {
      const updated = await rewardService.setGoal({
        title: goalTitle.trim(),
        targetStars: goalTarget,
      });
      setState(updated);
      setIsEditingGoal(false);
    } catch {
      // Graceful local handling
    }
  };

  const handleClaimReward = async () => {
    try {
      const { updatedState, success } = await rewardService.claimReward();
      if (success) {
        setState(updatedState);
        setJustClaimed(true);
      }
    } catch {
      // Graceful local handling
    }
  };

  return (
    <div
      className={`p-6 sm:p-8 rounded-4xl bg-white border border-olive-200/80 shadow-soft text-left font-sans space-y-6 ${className}`.trim()}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-olive-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
              Rewards & Progress
            </span>
            <SoftBadge variant="warm">Positive Momentum</SoftBadge>
          </div>
          <h3 className="font-display text-2xl font-bold text-textHeading mt-1">
            Star Bank
          </h3>
          <p className="text-xs sm:text-sm text-textMuted font-light mt-0.5">
            Earn stars for completing steps and gentle daily habits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEditGoal ? (
          <button
            type="button"
            onClick={() => setIsEditingGoal((prev) => !prev)}
            className="min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-semibold bg-olive-50/80 text-textBody border border-olive-200 hover:bg-olive-100 transition-all"
          >
            {isEditingGoal ? "Cancel" : "🎯 Change Goal"}
          </button>
          ) : (
            <span className="text-xs text-textMuted">Your grown-up chooses your goal.</span>
          )}
          <DeviceOnlyNote compact />
        </div>
      </div>

      {/* Goal Customizer Form */}
      {canEditGoal && isEditingGoal && (
        <form
          onSubmit={handleSaveGoal}
          className="p-5 rounded-3xl bg-olive-50/60 border border-olive-200 space-y-3"
        >
          <h4 className="text-sm font-bold text-textHeading">
            Personalize Your Reward Goal
          </h4>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="e.g. Choose a fun weekend activity"
              className="flex-1 p-3 rounded-2xl bg-white border border-olive-200 text-sm"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-textMuted font-semibold">
                Stars Needed:
              </span>
              <select
                value={goalTarget}
                onChange={(e) => setGoalTarget(Number(e.target.value))}
                className="p-3 rounded-2xl bg-white border border-olive-200 text-sm"
              >
                <option value={5}>5 ⭐</option>
                <option value={10}>10 ⭐</option>
                <option value={15}>15 ⭐</option>
                <option value={20}>20 ⭐</option>
                <option value={30}>30 ⭐</option>
              </select>
            </div>
            <BigButton variant="primary" type="submit" className="min-h-[44px]">
              Save Goal
            </BigButton>
          </div>
        </form>
      )}

      {/* Star Balance & Goal Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-olive-50/50 border border-olive-200/80 text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl" aria-hidden="true">
            ⭐
          </span>
          <span className="font-display text-5xl sm:text-6xl font-extrabold text-textHeading tracking-tight">
            {current}
          </span>
          <span className="text-sm font-semibold text-textMuted self-end pb-2">
            stars available
          </span>
        </div>

        <div className="space-y-1">
          <h4 className="font-display text-lg font-bold text-textHeading">
            Current Goal: {state.goal.title}
          </h4>
          <p className="text-xs sm:text-sm text-textMuted font-light">
            {current} of {target} stars collected ({percent}%)
          </p>
        </div>

        {/* Progress Bar */}
        <div className="max-w-md mx-auto pt-2">
          <ProgressBar
            value={current}
            max={target}
            label={`Progress toward ${state.goal.title}`}
            showValue
            variant="warm"
          />
        </div>
      </div>

      {/* Goal Reached Celebration Box */}
      {isGoalReached && (
        <div
          role="status"
          aria-live="polite"
          className={`p-6 rounded-3xl bg-paleLime/40 border border-olive-300 text-center space-y-3 ${
            reducedMotion ? "" : "animate-fade-in"
          }`}
        >
          <span className="text-4xl" aria-hidden="true">
            🎉
          </span>
          <h4 className="font-display text-xl font-bold text-deepGreen-800">
            Goal Reached! {state.goal.title}
          </h4>
          {/* Content needing review: non-clinical supportive prompt */}
          <p className="text-xs sm:text-sm text-textMuted font-light max-w-sm mx-auto">
            You reached your {target}-star goal with steady effort. Enjoy your reward!
          </p>
          <div className="pt-2 flex justify-center">
            <BigButton variant="primary" onClick={handleClaimReward}>
              Claim Reward &amp; Start Next Goal
            </BigButton>
          </div>
        </div>
      )}

      {/* Just Claimed Banner */}
      {justClaimed && !isGoalReached && (
        <div className="p-4 rounded-2xl bg-deepGreen-50 border border-deepGreen-200 text-center text-xs font-semibold text-deepGreen-800">
          🌟 Reward claimed! You&apos;re starting your next goal fresh.
        </div>
      )}

      {/* Lifetime Stars Counter */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-olive-50/60 border border-olive-100 text-xs text-textMuted">
        <span>Lifetime stars earned: <strong>{state.lifetimeStars} ⭐</strong></span>
        <span>All progress saved locally</span>
      </div>
    </div>
  );
};
