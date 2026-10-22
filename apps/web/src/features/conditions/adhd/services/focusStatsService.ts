/**
 * SafeSpace ADHD Focus Stats Service
 * Sprint 3 Workstream B
 *
 * Local device persistence for focus sessions and encouraging summary stats.
 * Uses LocalDeviceStore with the "safespace.ws-b.adhd.stats" key.
 */

import { LocalDeviceStore } from "../../../wellness-ui";
import type { FocusSessionRecord, FocusStatsSummary } from "../types";

export interface FocusStatsService {
  recordSession(
    session: Omit<FocusSessionRecord, "id" | "timestamp">
  ): Promise<FocusSessionRecord>;
  listSessions(): Promise<FocusSessionRecord[]>;
  getStatsSummary(nowMs?: number): Promise<FocusStatsSummary>;
  clearStats(): Promise<void>;
}

export const FOCUS_STATS_FEATURE_KEY = "adhd.stats";

/**
 * Pure aggregation helper for focus stats.
 * Computes today's count, weekly count, and daily streak based on local calendar dates.
 */
export function aggregateFocusStats(
  sessions: FocusSessionRecord[] = [],
  nowMs = Date.now()
): FocusStatsSummary {
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const completedSessions = safeSessions.filter((s) => s.completed);

  const nowDate = new Date(nowMs);
  const startOfToday = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate()
  ).getTime();

  // Week starts 7 days ago at midnight
  const sevenDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;

  let sessionsToday = 0;
  let focusSecondsToday = 0;
  let sessionsThisWeek = 0;
  let focusSecondsThisWeek = 0;

  const activeDates = new Set<string>();

  for (const session of completedSessions) {
    const sDate = new Date(session.timestamp);
    const dateKey = `${sDate.getFullYear()}-${sDate.getMonth() + 1}-${sDate.getDate()}`;
    activeDates.add(dateKey);

    if (session.timestamp >= startOfToday) {
      sessionsToday += 1;
      focusSecondsToday += session.durationSeconds;
    }
    if (session.timestamp >= sevenDaysAgo) {
      sessionsThisWeek += 1;
      focusSecondsThisWeek += session.durationSeconds;
    }
  }

  // Calculate consecutive active streak ending today or yesterday
  let streakDays = 0;
  const testDate = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());

  // Check if today is active; if not, check if yesterday was active to keep streak alive
  const todayKey = `${testDate.getFullYear()}-${testDate.getMonth() + 1}-${testDate.getDate()}`;
  let cursor = testDate.getTime();
  if (!activeDates.has(todayKey)) {
    cursor -= 24 * 60 * 60 * 1000;
  }

  while (true) {
    const d = new Date(cursor);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (activeDates.has(key)) {
      streakDays += 1;
      cursor -= 24 * 60 * 60 * 1000;
    } else {
      break;
    }
  }

  return {
    sessionsToday,
    focusMinutesToday: Math.round(focusSecondsToday / 60),
    sessionsThisWeek,
    focusMinutesThisWeek: Math.round(focusSecondsThisWeek / 60),
    streakDays,
  };
}

export class LocalFocusStatsService implements FocusStatsService {
  private store: LocalDeviceStore<FocusSessionRecord[]>;

  constructor(customStore?: LocalDeviceStore<FocusSessionRecord[]>) {
    this.store =
      customStore ??
      new LocalDeviceStore<FocusSessionRecord[]>(FOCUS_STATS_FEATURE_KEY, {
        validator: (data): data is FocusSessionRecord[] => Array.isArray(data),
      });
  }

  async recordSession(
    session: Omit<FocusSessionRecord, "id" | "timestamp">
  ): Promise<FocusSessionRecord> {
    const record: FocusSessionRecord = {
      ...session,
      id: `adhd-session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };

    const current = this.store.get([]);
    // Keep most recent 200 sessions locally to prevent storage bloat
    const updated = [record, ...current].slice(0, 200);
    this.store.set(updated);
    return record;
  }

  async listSessions(): Promise<FocusSessionRecord[]> {
    return this.store.get([]);
  }

  async getStatsSummary(nowMs = Date.now()): Promise<FocusStatsSummary> {
    const sessions = this.store.get([]);
    return aggregateFocusStats(sessions, nowMs);
  }

  async clearStats(): Promise<void> {
    this.store.remove();
  }
}
