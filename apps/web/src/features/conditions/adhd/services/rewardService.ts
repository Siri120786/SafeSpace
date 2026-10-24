/**
 * SafeSpace ADHD Rewards & Progress Service
 * Sprint 3 Workstream B
 *
 * Local device persistence for earned stars and progress toward user-chosen goals.
 * Backed by LocalDeviceStore with the "safespace.ws-b.adhd.rewards" key.
 */

import { LocalDeviceStore } from "../../../wellness-ui";
import {
  awardStarsIdempotent,
  redeemGoal,
  RewardSource,
  updateGoal,
} from "../lib/rewardLogic";
import type { RewardGoal, RewardState } from "../types";
import { INITIAL_REWARD_STATE } from "../types";

export interface RewardService {
  getState(): Promise<RewardState>;
  awardStars(
    source: RewardSource,
    sourceId: string,
    dateKey: string,
    count?: number
  ): Promise<{ updatedState: RewardState; wasAwarded: boolean }>;
  setGoal(goal: Partial<RewardGoal>): Promise<RewardState>;
  claimReward(): Promise<{ updatedState: RewardState; success: boolean }>;
  reset(): Promise<void>;
}

export const REWARDS_FEATURE_KEY = "adhd.rewards";

export class LocalRewardService implements RewardService {
  private store: LocalDeviceStore<RewardState>;

  constructor(customStore?: LocalDeviceStore<RewardState>) {
    this.store =
      customStore ??
      new LocalDeviceStore<RewardState>(REWARDS_FEATURE_KEY, {
        validator: (data): data is RewardState =>
          typeof data === "object" &&
          data !== null &&
          typeof (data as RewardState).currentStars === "number" &&
          Array.isArray((data as RewardState).awardedEventKeys),
      });
  }

  async getState(): Promise<RewardState> {
    return this.store.get(INITIAL_REWARD_STATE);
  }

  async awardStars(
    source: RewardSource,
    sourceId: string,
    dateKey: string,
    count = 1
  ): Promise<{ updatedState: RewardState; wasAwarded: boolean }> {
    const currentState = await this.getState();
    const { updatedState, wasAwarded } = awardStarsIdempotent(
      currentState,
      source,
      sourceId,
      dateKey,
      count
    );

    if (wasAwarded) {
      this.store.set(updatedState);
    }

    return { updatedState, wasAwarded };
  }

  async setGoal(goal: Partial<RewardGoal>): Promise<RewardState> {
    const currentState = await this.getState();
    const updatedState = updateGoal(currentState, goal);
    this.store.set(updatedState);
    return updatedState;
  }

  async claimReward(): Promise<{ updatedState: RewardState; success: boolean }> {
    const currentState = await this.getState();
    const { updatedState, success } = redeemGoal(currentState);
    if (success) {
      this.store.set(updatedState);
    }
    return { updatedState, success };
  }

  async reset(): Promise<void> {
    this.store.remove();
  }
}
