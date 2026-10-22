/**
 * SafeSpace ADHD Services Barrel & API Swap Points
 * Sprint 3 Workstream B
 *
 * Provides factory swap points for ADHD module persistence (Focus Stats, Tasks, Habits, Rewards).
 * Currently backed by LocalDeviceStore (localStorage).
 * When Siri's backend API is available, swap the factory return lines below.
 */

import { FocusStatsService, LocalFocusStatsService } from "./focusStatsService";
import { HabitService, LocalHabitService } from "./habitService";
import { RewardService, LocalRewardService } from "./rewardService";
import { LocalTaskService, TaskService } from "./taskService";

export * from "./focusStatsService";
export * from "./taskService";
export * from "./habitService";
export * from "./rewardService";

/**
 * Factory for FocusStatsService.
 * ONE-LINE SWAP POINT for future cloud API integration:
 * Return new RemoteFocusStatsService(apiClient) once backend persistence is ready.
 */
export function createFocusStatsService(): FocusStatsService {
  return new LocalFocusStatsService();
}

/**
 * Factory for TaskService.
 * ONE-LINE SWAP POINT for future cloud API integration:
 * Return new RemoteTaskService(apiClient) once backend persistence is ready.
 */
export function createTaskService(): TaskService {
  return new LocalTaskService();
}

/**
 * Factory for HabitService.
 * ONE-LINE SWAP POINT for future cloud API integration:
 * Return new RemoteHabitService(apiClient) once backend persistence is ready.
 */
export function createHabitService(): HabitService {
  return new LocalHabitService();
}

/**
 * Factory for RewardService.
 * ONE-LINE SWAP POINT for future cloud API integration:
 * Return new RemoteRewardService(apiClient) once backend persistence is ready.
 */
export function createRewardService(): RewardService {
  return new LocalRewardService();
}
