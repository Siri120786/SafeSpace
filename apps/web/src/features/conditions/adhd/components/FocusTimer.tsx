/**
 * SafeSpace ADHD Focus Timer Component
 * Sprint 3 Workstream B
 *
 * Standalone focus timer with preset buttons (5, 10, 15, 25 mins),
 * 48px+ touch targets, progress bar, gentle stop without penalty,
 * and a visual end cue (no autoplay sound).
 */

import React, { useId, useState } from "react";
import {
  BigButton,
  DeviceOnlyNote,
  ProgressBar,
  SoftBadge,
  useReducedMotion,
} from "../../../wellness-ui";
import { useFocusTimer } from "../hooks";
import {
  formatTime,
  getCoarseTimerAnnouncement,
} from "../lib/timerLogic";
import { FOCUS_PRESET_SECONDS } from "../types";

export interface FocusTimerProps {
  className?: string;
  defaultDurationSeconds?: number;
  onSessionComplete?: (durationSeconds: number, label?: string) => void;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({
  className = "",
  defaultDurationSeconds = FOCUS_PRESET_SECONDS.twentyFiveMin,
  onSessionComplete,
}) => {
  const [activity, setActivity] = useState("");
  const timerTitleId = useId();
  const { reducedMotion } = useReducedMotion();

  const { state, start, pause, resume, reset, stop } = useFocusTimer({
    initialDurationSeconds: defaultDurationSeconds,
    activityLabel: activity,
    onComplete: (duration, label) => {
      onSessionComplete?.(duration, label);
    },
  });

  const timeFormatted = formatTime(state.remainingSeconds);
  const elapsedSeconds = state.durationSeconds - state.remainingSeconds;
  const coarseAnnouncement = getCoarseTimerAnnouncement(
    state.remainingSeconds,
    state.durationSeconds,
    "Focus Session"
  );

  const handleSelectPreset = (seconds: number) => {
    reset(seconds);
  };

  const handleStart = () => {
    start(state.durationSeconds, activity.trim() || undefined);
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
              Quick Focus
            </span>
            <SoftBadge
              variant={
                state.status === "running"
                  ? "info"
                  : state.status === "paused"
                  ? "warm"
                  : state.status === "completed"
                  ? "success"
                  : "neutral"
              }
            >
              {state.status === "running"
                ? "Active"
                : state.status === "paused"
                ? "Paused"
                : state.status === "completed"
                ? "Done"
                : "Ready"}
            </SoftBadge>
          </div>
          <h3
            id={timerTitleId}
            className="font-display text-2xl font-bold text-textHeading mt-1"
          >
            Focus Timer
          </h3>
          <p className="text-xs sm:text-sm text-textMuted font-light mt-0.5">
            Choose a length that feels right. Stop anytime with zero penalty.
          </p>
        </div>
        <DeviceOnlyNote compact />
      </div>

      {/* Preset Duration Selector (Accessible 48px+ targets) */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-textMuted uppercase tracking-wider block">
          Preset Times
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: "5 min", secs: FOCUS_PRESET_SECONDS.fiveMin },
            { label: "10 min", secs: FOCUS_PRESET_SECONDS.tenMin },
            { label: "15 min", secs: FOCUS_PRESET_SECONDS.fifteenMin },
            { label: "25 min", secs: FOCUS_PRESET_SECONDS.twentyFiveMin },
          ].map((preset) => {
            const isSelected = state.durationSeconds === preset.secs;
            return (
              <button
                key={preset.secs}
                type="button"
                onClick={() => handleSelectPreset(preset.secs)}
                disabled={state.status === "running"}
                aria-pressed={isSelected}
                className={`min-h-[48px] px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all border ${
                  isSelected
                    ? "bg-darkBtn text-white border-darkBtn shadow-pill"
                    : "bg-olive-50/60 text-textHeading border-olive-200/70 hover:bg-olive-100"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional Activity Focus Label */}
      <div className="space-y-1.5">
        <label
          htmlFor="focus-activity-input"
          className="text-xs font-semibold text-textMuted uppercase tracking-wider block"
        >
          What are you focusing on? (Optional)
        </label>
        <input
          id="focus-activity-input"
          type="text"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          disabled={state.status === "running"}
          placeholder="e.g. Math homework, drawing, quiet reading"
          className="w-full p-3.5 rounded-2xl bg-olive-50/40 border border-olive-200 text-sm text-textHeading placeholder:text-textMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-500 disabled:opacity-60"
        />
      </div>

      {/* Main Timer Display */}
      <div
        role="timer"
        aria-labelledby={timerTitleId}
        aria-label={timeFormatted.verbal}
        className="p-6 sm:p-8 rounded-3xl bg-olive-50/50 border border-olive-100 text-center space-y-4"
      >
        {activity.trim() && (
          <p className="text-xs font-semibold text-deepGreen bg-white inline-block px-3 py-1 rounded-full border border-olive-200">
            Focus: {activity.trim()}
          </p>
        )}

        <div className="font-display text-6xl sm:text-7xl font-extrabold text-textHeading tracking-tight">
          {timeFormatted.digital}
        </div>

        <p className="text-xs sm:text-sm text-textMuted font-light">
          {timeFormatted.verbal}
        </p>

        {/* Gentle Progress Bar */}
        <div className="max-w-md mx-auto pt-2">
          <ProgressBar
            value={elapsedSeconds}
            max={state.durationSeconds}
            label="Focus Progress"
            showValue
            variant="olive"
          />
        </div>

        {/* Coarse aria-live announcement */}
        {coarseAnnouncement && (
          <div className="sr-only" role="status" aria-live="polite">
            {coarseAnnouncement}
          </div>
        )}
      </div>

      {/* Visual End Cue (No autoplay audio) */}
      {state.status === "completed" && (
        <div
          role="status"
          aria-live="polite"
          className="p-5 rounded-3xl bg-paleLime/40 border border-olive-300 text-center space-y-2 animate-fade-in"
        >
          <span className="text-3xl" aria-hidden="true">
            🌟
          </span>
          <h4 className="font-display text-lg font-bold text-deepGreen-800">
            Focus Session Complete!
          </h4>
          {/* Content needing review: non-clinical supportive prompt */}
          <p className="text-xs sm:text-sm text-textMuted font-light max-w-sm mx-auto">
            You gave this time your attention. Rest your eyes, take a gentle breath, or stretch your arms.
          </p>
          <div className="pt-2 flex justify-center">
            <BigButton variant="gentle" onClick={() => reset()}>
              Reset for Next Time
            </BigButton>
          </div>
        </div>
      )}

      {/* Timer Controls */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {state.status === "idle" && (
          <BigButton variant="primary" onClick={handleStart} className="min-w-[160px]">
            Start Focus
          </BigButton>
        )}

        {state.status === "running" && (
          <>
            <BigButton variant="gentle" onClick={pause} className="min-w-[130px]">
              Pause
            </BigButton>
            <BigButton
              variant="ghost"
              onClick={stop}
              aria-label="Stop focus timer without penalty"
            >
              Stop (No Penalty)
            </BigButton>
          </>
        )}

        {state.status === "paused" && (
          <>
            <BigButton variant="primary" onClick={resume} className="min-w-[130px]">
              Resume
            </BigButton>
            <BigButton variant="ghost" onClick={() => reset()}>
              Reset
            </BigButton>
          </>
        )}

        {state.status === "completed" && (
          <BigButton variant="primary" onClick={handleStart}>
            Start Again
          </BigButton>
        )}
      </div>
    </div>
  );
};
