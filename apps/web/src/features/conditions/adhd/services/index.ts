/**
 * SafeSpace ADHD Services Barrel & API Swap Points
 * Sprint 3 Workstream B
 *
 * Provides factory swap points for ADHD module persistence (Focus Stats, Tasks, Habits, Rewards).
 * Role-flow 8e: whenever someone is signed in, the factories return the
 * database-backed services (./remoteServices.ts), saving to that person's
 * account; with nobody signed in, the device-only services (which save
 * nothing without an owner, 8b).
 */

import { FocusStatsService, LocalFocusStatsService } from "./focusStatsService";
import { HabitService, LocalHabitService } from "./habitService";
import { RewardService, LocalRewardService } from "./rewardService";
import { LocalTaskService, TaskService } from "./taskService";
import { RemoteFocusStatsService, RemoteHabitService, RemoteRewardService, RemoteTaskService } from "./remoteServices";
import { getToolsSession } from "../../toolsSession";

export * from "./focusStatsService";
export * from "./taskService";
export * from "./habitService";
export * from "./rewardService";
export * from "./remoteServices";

/**
 * Factory for FocusStatsService.
 * ONE-LINE SWAP POINT for future cloud API integration:
 * Return new RemoteFocusStatsService(apiClient) once backend persistence is ready.
 */
export function createFocusStatsService(): FocusStatsService {
  const s = getToolsSession();
  return s ? new RemoteFocusStatsService(s) : new LocalFocusStatsService();
}

/**
 * Factory for TaskService.
 * ONE-LINE SWAP POINT for future cloud API integration:
 * Return new RemoteTaskService(apiClient) once backend persistence is ready.
 */
export function createTaskService(): TaskService {
  const s = getToolsSession();
  return s ? new RemoteTaskService(s) : new LocalTaskService();
}

/**
 * Factory for HabitService.
 * ONE-LINE SWAP POINT for future cloud API integration:
 * Return new RemoteHabitService(apiClient) once backend persistence is ready.
 */
export function createHabitService(): HabitService {
  const s = getToolsSession();
  return s ? new RemoteHabitService(s) : new LocalHabitService();
}

/**
 * Factory for RewardService.
 * ONE-LINE SWAP POINT for future cloud API integration:
 * Return new RemoteRewardService(apiClient) once backend persistence is ready.
 */
export function createRewardService(): RewardService {
  const s = getToolsSession();
  return s ? new RemoteRewardService(s) : new LocalRewardService();
}
