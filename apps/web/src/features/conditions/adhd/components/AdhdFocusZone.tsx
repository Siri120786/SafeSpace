/**
 * SafeSpace ADHD Focus Zone Hub Component
 * Sprint 3 Workstream B
 *
 * Top-level ADHD module interface integrating:
 * 1. Quick Focus Timer (5/10/15/25 mins)
 * 2. Pomodoro Cycle Timer (Focus / Short Break / Long Break)
 * 3. Local Focus Stats Summary
 */

import React, { useState } from "react";
import { BigButton, DeviceOnlyNote, SoftBadge } from "../../../wellness-ui";
import { createFocusStatsService } from "../services";
import type { PomodoroPhase } from "../types";
import { FocusStats } from "./FocusStats";
import { FocusTimer } from "./FocusTimer";
import { PomodoroTimer } from "./PomodoroTimer";

export interface AdhdFocusZoneProps {
  className?: string;
}

export const AdhdFocusZone: React.FC<AdhdFocusZoneProps> = ({
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState<"quick" | "pomodoro">("quick");
  const [statsTrigger, setStatsTrigger] = useState(0);
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
      setStatsTrigger((prev) => prev + 1);
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
        setStatsTrigger((prev) => prev + 1);
      } catch {
        // Graceful local handling
      }
    }
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
              <SoftBadge variant="default">Gentle Pacing</SoftBadge>
            </div>
            <h2 className="font-display text-3xl font-bold text-textHeading mt-2">
              Calm Focus Space
            </h2>
            {/* Content needing review: non-clinical supportive prompt */}
            <p className="text-sm text-textMuted font-light mt-1 max-w-xl">
              Flexible timers designed for steady minds. Choose a quick sprint or a guided rhythm with built-in breaks.
            </p>
          </div>
          <DeviceOnlyNote compact />
        </div>

        {/* Mode Selector Tabs (48px+ targets) */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-olive-100">
          <button
            type="button"
            onClick={() => setActiveTab("quick")}
            aria-selected={activeTab === "quick"}
            role="tab"
            className={`min-h-[48px] px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all border ${
              activeTab === "quick"
                ? "bg-darkBtn text-white border-darkBtn shadow-pill"
                : "bg-white text-textHeading border-olive-200 hover:bg-olive-50"
            }`}
          >
            ⏱️ Quick Focus Timer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pomodoro")}
            aria-selected={activeTab === "pomodoro"}
            role="tab"
            className={`min-h-[48px] px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all border ${
              activeTab === "pomodoro"
                ? "bg-darkBtn text-white border-darkBtn shadow-pill"
                : "bg-white text-textHeading border-olive-200 hover:bg-olive-50"
            }`}
          >
            🍅 Pomodoro Flow
          </button>
        </div>
      </div>

      {/* Active Mode View */}
      {activeTab === "quick" ? (
        <FocusTimer onSessionComplete={handleSimpleTimerComplete} />
      ) : (
        <PomodoroTimer onPhaseComplete={handlePomodoroPhaseComplete} />
      )}

      {/* Local Focus Stats Section */}
      <FocusStats refreshTrigger={statsTrigger} />
    </div>
  );
};
