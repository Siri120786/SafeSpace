/**
 * SafeSpace ADHD Services Barrel & API Swap Point
 * Sprint 3 Workstream B
 *
 * Provides a single factory swap point for ADHD focus zone persistence.
 * Currently uses LocalFocusStatsService (localStorage).
 * When Siri's backend API is available, swap the factory return line below.
 */

import {
  FocusStatsService,
  LocalFocusStatsService,
} from "./focusStatsService";

export * from "./focusStatsService";

/**
 * Factory for FocusStatsService.
 * ONE-LINE SWAP POINT for future cloud API integration:
 * Return new RemoteFocusStatsService(apiClient) once backend persistence is ready.
 */
export function createFocusStatsService(): FocusStatsService {
  return new LocalFocusStatsService();
}
