/**
 * SafeSpace ADHD Focus Stats Component
 * Sprint 3 Workstream B
 *
 * Displays local focus statistics (sessions today & this week, focus minutes)
 * with encouraging, non-clinical messaging and a clear DeviceOnlyNote.
 */

import React, { useEffect, useState } from "react";
import { DeviceOnlyNote, SoftBadge, WellnessCard } from "../../../wellness-ui";
import { createFocusStatsService } from "../services";
import type { FocusStatsSummary } from "../types";

export interface FocusStatsProps {
  className?: string;
  refreshTrigger?: number;
}

export const FocusStats: React.FC<FocusStatsProps> = ({
  className = "",
  refreshTrigger = 0,
}) => {
  const service = createFocusStatsService();
  const [stats, setStats] = useState<FocusStatsSummary>({
    sessionsToday: 0,
    focusMinutesToday: 0,
    sessionsThisWeek: 0,
    focusMinutesThisWeek: 0,
    streakDays: 0,
  });

  useEffect(() => {
    service.getStatsSummary().then(setStats).catch(() => {});
  }, [refreshTrigger]);

  return (
    <div
      className={`p-6 sm:p-8 rounded-4xl bg-white border border-olive-200/80 shadow-soft text-left font-sans space-y-6 ${className}`.trim()}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-olive-100 pb-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
            Your Pacing
          </span>
          <h3 className="font-display text-2xl font-bold text-textHeading mt-1">
            Focus Activity
          </h3>
          {/* Content needing review: non-clinical supportive prompt */}
          <p className="text-xs sm:text-sm text-textMuted font-light mt-0.5">
            Every minute of calm attention is worth celebrating.
          </p>
        </div>
        <DeviceOnlyNote compact />
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <WellnessCard
          title={`${stats.sessionsToday} Session${stats.sessionsToday === 1 ? "" : "s"}`}
          subtitle={`${stats.focusMinutesToday} focus minutes completed`}
          badge={
            <SoftBadge variant={stats.sessionsToday > 0 ? "success" : "neutral"}>
              Today
            </SoftBadge>
          }
          variant="default"
        />

        <WellnessCard
          title={`${stats.sessionsThisWeek} Session${stats.sessionsThisWeek === 1 ? "" : "s"}`}
          subtitle={`${stats.focusMinutesThisWeek} focus minutes total`}
          badge={
            <SoftBadge variant={stats.sessionsThisWeek > 0 ? "info" : "neutral"}>
              This Week
            </SoftBadge>
          }
          variant="default"
        />

        <WellnessCard
          title={
            stats.streakDays > 0
              ? `${stats.streakDays}-Day Flow`
              : "Starting Fresh"
          }
          subtitle={
            stats.streakDays > 0
              ? "Consistent focus days"
              : "Ready whenever you are"
          }
          badge={
            <SoftBadge variant={stats.streakDays > 0 ? "warm" : "neutral"}>
              Streak
            </SoftBadge>
          }
          variant="default"
        />
      </div>

      {/* Encouraging Affirmation */}
      <div className="p-4 rounded-2xl bg-olive-50/60 border border-olive-100 text-xs text-textMuted font-light flex items-center gap-2">
        <span className="text-base" aria-hidden="true">
          🌱
        </span>
        {/* Content needing review: non-clinical supportive prompt */}
        <span>
          Take things one focus block at a time. Breaks are just as important as working sessions.
        </span>
      </div>
    </div>
  );
};
