/**
 * SafeSpace ADHD Habit Tracker Pure Logic
 * Sprint 3 Workstream B
 *
 * Gentle 7-day view with resilient date math across month/year boundaries.
 * Missed days are never treated or styled as failures (no red, no shaming).
 */

import type { DayCheck, HabitItem, HabitLog } from "../types";

/**
 * Returns the past 7 calendar days (ending on today), handling month
 * and leap-year boundaries reliably via standard JavaScript Date arithmetic.
 */
export function getPast7Days(nowMs = Date.now()): DayCheck[] {
  const result: DayCheck[] = [];
  const baseDate = new Date(nowMs);
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate() - offset
    );

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;

    result.push({
      dateKey,
      dayLabel: dayLabels[d.getDay()],
      dayNumber: d.getDate(),
      isToday: offset === 0,
    });
  }

  return result;
}

export function isHabitChecked(
  log: HabitLog,
  habitId: string,
  dateKey: string
): boolean {
  return Boolean(log[habitId]?.[dateKey]);
}

/**
 * Toggles a habit's checked state on a specific dateKey.
 */
export function toggleHabitLog(
  log: HabitLog,
  habitId: string,
  dateKey: string
): { updatedLog: HabitLog; isNowChecked: boolean } {
  const currentHabitMap = log[habitId] || {};
  const currentStatus = Boolean(currentHabitMap[dateKey]);
  const isNowChecked = !currentStatus;

  const updatedHabitMap = {
    ...currentHabitMap,
    [dateKey]: isNowChecked,
  };

  const updatedLog: HabitLog = {
    ...log,
    [habitId]: updatedHabitMap,
  };

  return { updatedLog, isNowChecked };
}

/**
 * Calculates completed days count for a given habit over a set of days.
 */
export function calculateHabitWeeklyRate(
  log: HabitLog,
  habitId: string,
  past7Days: DayCheck[]
): { completedCount: number; totalDays: number } {
  const habitMap = log[habitId] || {};
  let completedCount = 0;

  for (const day of past7Days) {
    if (habitMap[day.dateKey]) {
      completedCount++;
    }
  }

  return { completedCount, totalDays: past7Days.length };
}

export const DEFAULT_SAMPLE_HABITS: Omit<HabitItem, "id" | "createdAt">[] = [
  { title: "Drink a glass of water", icon: "💧" },
  { title: "Stretch or gentle movement", icon: "🧘" },
  { title: "Step outside or open a window", icon: "🌿" },
  { title: "Quiet 2-minute reset", icon: "🌱" },
];
