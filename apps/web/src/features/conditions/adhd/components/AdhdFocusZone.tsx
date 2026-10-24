/**
 * SafeSpace ADHD Focus Zone Hub Component
 * Sprint 3 Workstream B
 *
 * Integrated ADHD workspace featuring:
 * 1. Focus Timers (Quick Focus & Pomodoro Cycles)
 * 2. Task Breakdown (Bite-sized steps, user-controlled)
 * 3. Daily Habits (Gentle 7-day tracker, no failure shaming)
 * 4. Star Rewards & Goals (Idempotent positive reinforcement)
 * 5. Local Focus Statistics
 */

import React, { useState } from "react";
import { DeviceOnlyNote, SoftBadge } from "../../../wellness-ui";
import { createFocusStatsService } from "../services";
import type { PomodoroPhase } from "../types";
import { FocusStats } from "./FocusStats";
import { FocusTimer } from "./FocusTimer";
import { HabitTracker } from "./HabitTracker";
import { PomodoroTimer } from "./PomodoroTimer";
import { RewardsProgress } from "./RewardsProgress";
import { TaskBreakdown } from "./TaskBreakdown";

export interface AdhdFocusZoneProps {
  className?: string;
}

export type FocusZoneTab = "timers" | "tasks" | "habits" | "rewards";

export const AdhdFocusZone: React.FC<AdhdFocusZoneProps> = ({
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState<FocusZoneTab>("timers");
  const [timerSubTab, setTimerSubTab] = useState<"quick" | "pomodoro">("quick");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const statsService = createFocusStatsService();

  const handleSimpleTimerComplete = async (
    durationSeconds: number,
    label?: string
  ) => {
    try {
      await statsService.recordSession({
        durationSeconds,
        mode: "simple",
        completed: true,
        activityLabel: label,
      });
      setRefreshTrigger((prev) => prev + 1);
    } catch {
      // Graceful local handling
    }
  };

  const handlePomodoroPhaseComplete = async (
    phase: PomodoroPhase,
    cycle: number
  ) => {
    if (phase === "focus") {
      try {
        await statsService.recordSession({
          durationSeconds: 1500, // 25 mins
          mode: "pomodoro",
          phase: "focus",
          completed: true,
          activityLabel: `Pomodoro Cycle ${cycle}`,
        });
        setRefreshTrigger((prev) => prev + 1);
      } catch {
        // Graceful local handling
      }
    }
  };

  const handleActivityRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className={`space-y-6 text-left font-sans ${className}`.trim()}>
      {/* Top Banner */}
      <div className="p-6 rounded-4xl bg-gradient-to-r from-olive-50 via-white to-paleLime/30 border border-olive-200/80 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
                ADHD Focus Zone
              </span>
              <SoftBadge variant="default">Calm Pacing</SoftBadge>
            </div>
            <h2 className="font-display text-3xl font-bold text-textHeading mt-2">
              Gentle Focus Space
            </h2>
            {/* Content needing review: non-clinical supportive prompt */}
            <p className="text-sm text-textMuted font-light mt-1 max-w-xl">
              Flexible tools designed for how your mind works best. Take steady steps, celebrate small wins, and rest without guilt.
            </p>
          </div>
          <DeviceOnlyNote compact />
        </div>

        {/* Primary Navigation Tabs (Accessible 48px+ touch targets) */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-olive-100 overflow-x-auto pb-1">
          {[
            { id: "timers", label: "⏱️ Timers" },
            { id: "tasks", label: "📋 Step Breakdown" },
            { id: "habits", label: "🌱 Daily Habits" },
            { id: "rewards", label: "⭐ Star Bank" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as FocusZoneTab)}
              aria-selected={activeTab === tab.id}
              role="tab"
              className={`min-h-[48px] px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all border whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-darkBtn text-white border-darkBtn shadow-pill"
                  : "bg-white text-textHeading border-olive-200 hover:bg-olive-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Timers */}
      {activeTab === "timers" && (
        <div className="space-y-6">
          {/* Sub-selector for Timer Mode */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTimerSubTab("quick")}
              className={`min-h-[44px] px-4 py-2 rounded-2xl text-xs font-semibold border transition-all ${
                timerSubTab === "quick"
                  ? "bg-olive-600 text-white border-olive-600 shadow-sm"
                  : "bg-white text-textBody border-olive-200 hover:bg-olive-50"
              }`}
            >
              Quick Focus Timer
            </button>
            <button
              type="button"
              onClick={() => setTimerSubTab("pomodoro")}
              className={`min-h-[44px] px-4 py-2 rounded-2xl text-xs font-semibold border transition-all ${
                timerSubTab === "pomodoro"
                  ? "bg-olive-600 text-white border-olive-600 shadow-sm"
                  : "bg-white text-textBody border-olive-200 hover:bg-olive-50"
              }`}
            >
              Pomodoro Flow
            </button>
          </div>

          {timerSubTab === "quick" ? (
            <FocusTimer onSessionComplete={handleSimpleTimerComplete} />
          ) : (
            <PomodoroTimer onPhaseComplete={handlePomodoroPhaseComplete} />
          )}

          <FocusStats refreshTrigger={refreshTrigger} />
        </div>
      )}

      {/* Tab: Tasks */}
      {activeTab === "tasks" && (
        <TaskBreakdown onStepCompleted={handleActivityRefresh} />
      )}

      {/* Tab: Habits */}
      {activeTab === "habits" && (
        <HabitTracker onHabitChecked={handleActivityRefresh} />
      )}

      {/* Tab: Rewards */}
      {activeTab === "rewards" && (
        <RewardsProgress refreshTrigger={refreshTrigger} />
      )}
    </div>
  );
};
