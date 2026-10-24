import React, { useEffect, useRef, useState } from "react";
import {
  BigButton,
  CountdownDisplay,
  DeviceOnlyNote,
  SoftBadge,
  useReducedMotion,
} from "../../../wellness-ui";
import {
  getCoarseAnnouncement,
  getShrinkingProgress,
  initCountdown,
  pauseCountdown,
  resetCountdown,
  resumeCountdown,
  startCountdown,
  tickCountdown,
  type CountdownState,
} from "../lib/countdown";
import {
  createTransitionService,
  DEFAULT_TRANSITION_CONFIG,
} from "../services";
import type { TransitionConfig } from "../types";

export interface TransitionCountdownProps {
  initialConfig?: TransitionConfig;
  className?: string;
  onDone?: () => void;
}

const PRESET_ACTIVITIES = [
  { activity: "Quiet Reading", seconds: 300, label: "5 min" },
  { activity: "Tidying Up", seconds: 180, label: "3 min" },
  { activity: "Lunch & Snack", seconds: 600, label: "10 min" },
  { activity: "Leaving the House", seconds: 900, label: "15 min" },
];

export const TransitionCountdown: React.FC<TransitionCountdownProps> = ({
  initialConfig = DEFAULT_TRANSITION_CONFIG,
  className = "",
  onDone,
}) => {
  const service = createTransitionService();
  const { reducedMotion } = useReducedMotion();

  const [state, setState] = useState<CountdownState>(() =>
    initCountdown(initialConfig.activity, initialConfig.totalSeconds)
  );

  // Tracks previous state for coarse screen-reader announcements
  const prevStateRef = useRef<CountdownState | null>(null);
  const [coarseMessage, setCoarseMessage] = useState<string | null>(null);
  const [customActivity, setCustomActivity] = useState(initialConfig.activity);

  // Load saved preference on mount
  useEffect(() => {
    service
      .getSavedConfig()
      .then((cfg) => {
        setCustomActivity(cfg.activity);
        setState((prev) =>
          prev.phase === "idle"
            ? initCountdown(cfg.activity, cfg.totalSeconds)
            : prev
        );
      })
      .catch(() => {});
  }, []);

  // Timer loop when running
  useEffect(() => {
    if (state.phase !== "running") return;

    const interval = setInterval(() => {
      setState((prev) => {
        const next = tickCountdown(prev, 1);
        if (next.phase === "done" && prev.phase !== "done") {
          onDone?.();
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.phase, onDone]);

  // Evaluate coarse screen-reader announcements on state changes
  useEffect(() => {
    const announcement = getCoarseAnnouncement(prevStateRef.current, state);
    if (announcement) {
      setCoarseMessage(announcement);
    }
    prevStateRef.current = state;
  }, [state]);

  const handleStart = () => {
    setState((prev) => startCountdown(prev));
  };

  const handlePause = () => {
    setState((prev) => pauseCountdown(prev));
  };

  const handleResume = () => {
    setState((prev) => resumeCountdown(prev));
  };

  const handleReset = () => {
    setState((prev) => resetCountdown(prev));
  };

  const handleSelectPreset = (activity: string, seconds: number) => {
    setCustomActivity(activity);
    const next = resetCountdown(state, seconds, activity);
    setState(next);
    service.saveConfig({ activity, totalSeconds: seconds }).catch(() => {});
  };

  const shrinkingPercent = getShrinkingProgress(state);

  return (
    <div className={`space-y-6 text-left font-sans ${className}`.trim()}>
      {/* Hidden Coarse Announcement for Screen Readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {coarseMessage}
      </div>

      {/* Header and Device Note */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
            Transition Pacing
          </span>
          <h3 className="font-display text-2xl font-bold text-textHeading mt-1">
            Next: {state.activity}
          </h3>
          <p className="text-xs sm:text-sm text-textMuted font-light mt-0.5">
            Clear visual countdown to help prepare gently for the next change in routine.
          </p>
        </div>
        <DeviceOnlyNote compact />
      </div>

      {/* Main Timer Display Box */}
      <div className="p-6 sm:p-8 rounded-4xl bg-white border border-olive-100 shadow-card flex flex-col items-center justify-center space-y-6 text-center">
        {/* Text-First Countdown Display */}
        <CountdownDisplay
          secondsRemaining={state.secondsRemaining}
          totalSeconds={state.totalSeconds}
          label={`Next: ${state.activity}`}
          isPaused={state.phase === "paused"}
          size="lg"
        />

        {/* Shrinking Visual Progress Bar (Zero animation in reduced motion mode) */}
        <div className="w-full max-w-md space-y-1.5">
          <div className="flex items-center justify-between text-xs text-textMuted">
            <span>Remaining time bar</span>
            <span aria-hidden="true">{shrinkingPercent}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Transition countdown progress"
            aria-valuenow={shrinkingPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full h-3 rounded-full bg-olive-100 overflow-hidden"
          >
            <div
              style={{ width: `${shrinkingPercent}%` }}
              className={`h-full rounded-full bg-olive-500 ${
                reducedMotion
                  ? "transition-none"
                  : "transition-[width] duration-1000 linear"
              }`}
            />
          </div>
        </div>

        {/* Visual End Cue (Zero Autoplay Audio) */}
        {state.phase === "done" && (
          <div
            role="status"
            aria-live="polite"
            className="w-full max-w-md p-4 rounded-2xl bg-olive-50 border border-olive-300 text-textHeading animate-fade-in text-center space-y-1"
          >
            <span className="text-2xl" aria-hidden="true">
              🌿
            </span>
            <h4 className="font-display text-base font-bold text-deepGreen-800">
              Time for {state.activity}
            </h4>
            {/* Content needing review: non-clinical supportive prompt */}
            <p className="text-xs text-textMuted font-light">
              Take a quiet moment to finish what you are doing. You are ready.
            </p>
          </div>
        )}

        {/* Timer Control Buttons (48px+ targets) */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {state.phase === "idle" && (
            <BigButton
              variant="primary"
              icon={<span>▶</span>}
              onClick={handleStart}
            >
              Start Countdown
            </BigButton>
          )}

          {state.phase === "running" && (
            <BigButton
              variant="primary"
              icon={<span>⏸</span>}
              onClick={handlePause}
            >
              Pause
            </BigButton>
          )}

          {state.phase === "paused" && (
            <BigButton
              variant="primary"
              icon={<span>▶</span>}
              onClick={handleResume}
            >
              Resume
            </BigButton>
          )}

          <BigButton
            variant="ghost"
            onClick={handleReset}
            disabled={state.phase === "idle" && state.secondsRemaining === state.totalSeconds}
          >
            Reset
          </BigButton>
        </div>
      </div>

      {/* Activity Presets & Custom Configuration */}
      <div className="space-y-3 pt-2 border-t border-olive-100">
        <h4 className="font-display text-sm font-semibold text-textHeading">
          Quick Transition Presets
        </h4>
        <div className="flex flex-wrap gap-2.5">
          {PRESET_ACTIVITIES.map((preset) => {
            const isCurrent =
              state.activity === preset.activity &&
              state.totalSeconds === preset.seconds;
            return (
              <button
                key={preset.activity}
                type="button"
                onClick={() => handleSelectPreset(preset.activity, preset.seconds)}
                aria-pressed={isCurrent}
                className={`min-h-[44px] px-4 py-2 rounded-2xl border text-xs font-medium transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 ${
                  isCurrent
                    ? "bg-darkBtn text-white border-darkBtn shadow-pill"
                    : "bg-white text-textBody border-olive-200/80 hover:bg-olive-50"
                }`}
              >
                <span>{preset.activity}</span>
                <SoftBadge
                  size="sm"
                  variant={isCurrent ? "neutral" : "default"}
                >
                  {preset.label}
                </SoftBadge>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
