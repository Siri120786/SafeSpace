/**
 * SafeSpace ADHD Pomodoro Timer Component
 * Sprint 3 Workstream B
 *
 * Configurable Pomodoro cycle timer (focus / short break / long break after N cycles).
 * Features cycle counter, gentle ProgressBar, big touch targets,
 * visual end cue (no autoplay sound), and coarse aria-live announcements.
 */

import React, { useId, useState } from "react";
import {
  BigButton,
  DeviceOnlyNote,
  ProgressBar,
  SoftBadge,
  useReducedMotion,
} from "../../../wellness-ui";
import { usePomodoro } from "../hooks";
import {
  formatTime,
  getCoarseTimerAnnouncement,
} from "../lib/timerLogic";
import type { PomodoroConfig, PomodoroPhase } from "../types";

export interface PomodoroTimerProps {
  className?: string;
  initialConfig?: Partial<PomodoroConfig>;
  onPhaseComplete?: (phase: PomodoroPhase, cycle: number) => void;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  className = "",
  initialConfig,
  onPhaseComplete,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [customConfig, setCustomConfig] = useState<Partial<PomodoroConfig>>(
    initialConfig ?? {}
  );
  const titleId = useId();
  const { reducedMotion } = useReducedMotion();

  const { state, start, pause, resume, reset, skip, advance } = usePomodoro({
    initialConfig: customConfig,
    onPhaseComplete: (phase, cycle) => {
      onPhaseComplete?.(phase, cycle);
    },
  });

  const timeFormatted = formatTime(state.remainingSeconds);
  const elapsedSeconds =
    state.phaseDurationSeconds - state.remainingSeconds;

  const phaseTitle =
    state.currentPhase === "focus"
      ? "Focus Time"
      : state.currentPhase === "shortBreak"
      ? "Short Break"
      : "Long Break";

  const coarseAnnouncement = getCoarseTimerAnnouncement(
    state.remainingSeconds,
    state.phaseDurationSeconds,
    phaseTitle
  );

  const handleApplyConfig = (e: React.FormEvent) => {
    e.preventDefault();
    reset(customConfig);
    setShowConfig(false);
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
              Pomodoro Flow
            </span>
            <SoftBadge
              variant={
                state.currentPhase === "focus"
                  ? "success"
                  : state.currentPhase === "shortBreak"
                  ? "warm"
                  : "info"
              }
            >
              {phaseTitle}
            </SoftBadge>
            <SoftBadge variant="neutral">
              Cycle {state.currentCycle} of {state.config.cyclesBeforeLongBreak}
            </SoftBadge>
          </div>
          <h3
            id={titleId}
            className="font-display text-2xl font-bold text-textHeading mt-1"
          >
            Focus & Break Cycles
          </h3>
          <p className="text-xs sm:text-sm text-textMuted font-light mt-0.5">
            Balanced focus sessions paired with restorative breaks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfig((prev) => !prev)}
            aria-expanded={showConfig}
            className="min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-semibold bg-olive-50/80 text-textBody border border-olive-200 hover:bg-olive-100 transition-all"
          >
            {showConfig ? "Close Settings" : "⚙️ Timer Settings"}
          </button>
          <DeviceOnlyNote compact />
        </div>
      </div>

      {/* Cycle Progress Dots */}
      <div className="flex items-center gap-2 py-1">
        <span className="text-xs font-semibold text-textMuted mr-1">
          Cycle Progress:
        </span>
        {Array.from({ length: state.config.cyclesBeforeLongBreak }).map(
          (_, index) => {
            const cycleNumber = index + 1;
            const isCompleted = cycleNumber < state.currentCycle;
            const isCurrent = cycleNumber === state.currentCycle;

            return (
              <div
                key={cycleNumber}
                aria-label={`Cycle ${cycleNumber}: ${
                  isCompleted
                    ? "completed"
                    : isCurrent
                    ? "current"
                    : "upcoming"
                }`}
                className={`h-4 rounded-full transition-all flex items-center justify-center text-[10px] font-bold ${
                  isCurrent
                    ? "w-10 bg-deepGreen text-white shadow-sm"
                    : isCompleted
                    ? "w-6 bg-paleLime text-deepGreen-900 border border-olive-300"
                    : "w-6 bg-olive-100/70 text-textMuted"
                }`}
              >
                {isCompleted ? "✓" : cycleNumber}
              </div>
            );
          }
        )}
      </div>

      {/* Optional Settings Drawer */}
      {showConfig && (
        <form
          onSubmit={handleApplyConfig}
          className="p-5 rounded-3xl bg-olive-50/60 border border-olive-200 space-y-4"
        >
          <h4 className="text-sm font-bold text-textHeading">
            Customize Cycle Durations
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="font-semibold text-textMuted block mb-1">
                Focus (mins)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={customConfig.focusMinutes ?? state.config.focusMinutes}
                onChange={(e) =>
                  setCustomConfig((prev) => ({
                    ...prev,
                    focusMinutes: Number(e.target.value),
                  }))
                }
                className="w-full p-2.5 rounded-xl bg-white border border-olive-200"
              />
            </div>
            <div>
              <label className="font-semibold text-textMuted block mb-1">
                Short Break (mins)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={
                  customConfig.shortBreakMinutes ??
                  state.config.shortBreakMinutes
                }
                onChange={(e) =>
                  setCustomConfig((prev) => ({
                    ...prev,
                    shortBreakMinutes: Number(e.target.value),
                  }))
                }
                className="w-full p-2.5 rounded-xl bg-white border border-olive-200"
              />
            </div>
            <div>
              <label className="font-semibold text-textMuted block mb-1">
                Long Break (mins)
              </label>
              <input
                type="number"
                min="5"
                max="60"
                value={
                  customConfig.longBreakMinutes ?? state.config.longBreakMinutes
                }
                onChange={(e) =>
                  setCustomConfig((prev) => ({
                    ...prev,
                    longBreakMinutes: Number(e.target.value),
                  }))
                }
                className="w-full p-2.5 rounded-xl bg-white border border-olive-200"
              />
            </div>
            <div>
              <label className="font-semibold text-textMuted block mb-1">
                Cycles / Long Break
              </label>
              <input
                type="number"
                min="1"
                max="8"
                value={
                  customConfig.cyclesBeforeLongBreak ??
                  state.config.cyclesBeforeLongBreak
                }
                onChange={(e) =>
                  setCustomConfig((prev) => ({
                    ...prev,
                    cyclesBeforeLongBreak: Number(e.target.value),
                  }))
                }
                className="w-full p-2.5 rounded-xl bg-white border border-olive-200"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <BigButton variant="primary" type="submit" className="min-h-[44px]">
              Apply Settings
            </BigButton>
          </div>
        </form>
      )}

      {/* Main Timer Display */}
      <div
        role="timer"
        aria-labelledby={titleId}
        aria-label={`${phaseTitle}: ${timeFormatted.verbal}`}
        className={`p-6 sm:p-8 rounded-3xl border text-center space-y-4 ${
          state.currentPhase === "focus"
            ? "bg-olive-50/50 border-olive-200"
            : state.currentPhase === "shortBreak"
            ? "bg-amber-50/40 border-amber-200/80"
            : "bg-blue-50/40 border-blue-200/80"
        }`}
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-textMuted">
          Current Phase
        </span>
        <h4 className="font-display text-2xl font-bold text-textHeading">
          {phaseTitle}
        </h4>

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
            max={state.phaseDurationSeconds}
            label={`${phaseTitle} Progress`}
            showValue
            variant={state.currentPhase === "focus" ? "deepGreen" : "olive"}
          />
        </div>

        {/* Screen Reader Announcement */}
        {coarseAnnouncement && (
          <div className="sr-only" role="status" aria-live="polite">
            {coarseAnnouncement}
          </div>
        )}
      </div>

      {/* Visual End Cue (No autoplay audio) */}
      {state.status === "phaseCompleted" && (
        <div
          role="status"
          aria-live="polite"
          className="p-5 rounded-3xl bg-paleLime/40 border border-olive-300 text-center space-y-2 animate-fade-in"
        >
          <span className="text-3xl" aria-hidden="true">
            {state.currentPhase === "focus" ? "🎉" : "🌱"}
          </span>
          <h4 className="font-display text-lg font-bold text-deepGreen-800">
            {state.currentPhase === "focus"
              ? "Focus Phase Complete!"
              : "Break Time Concluded!"}
          </h4>
          {/* Content needing review: non-clinical supportive prompt */}
          <p className="text-xs sm:text-sm text-textMuted font-light max-w-sm mx-auto">
            {state.currentPhase === "focus"
              ? "You did great focusing. Ready to step back and take a friendly rest?"
              : "Your break is finished. Ready to gently transition back to focus?"}
          </p>
          <div className="pt-2 flex justify-center">
            <BigButton variant="primary" onClick={advance}>
              Begin Next Phase
            </BigButton>
          </div>
        </div>
      )}

      {/* Controls (Accessible 48px+ targets) */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {state.status === "idle" && (
          <BigButton variant="primary" onClick={start} className="min-w-[160px]">
            Start {phaseTitle}
          </BigButton>
        )}

        {state.status === "running" && (
          <>
            <BigButton variant="gentle" onClick={pause} className="min-w-[130px]">
              Pause
            </BigButton>
            <BigButton
              variant="ghost"
              onClick={skip}
              aria-label="Skip to next phase without penalty"
            >
              Skip Phase
            </BigButton>
          </>
        )}

        {state.status === "paused" && (
          <>
            <BigButton variant="primary" onClick={resume} className="min-w-[130px]">
              Resume
            </BigButton>
            <BigButton variant="ghost" onClick={() => reset()}>
              Reset Cycle
            </BigButton>
          </>
        )}
      </div>
    </div>
  );
};
