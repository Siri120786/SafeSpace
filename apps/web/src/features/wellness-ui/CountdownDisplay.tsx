import React from "react";

export interface CountdownDisplayProps {
  /** Seconds remaining on the countdown. */
  secondsRemaining: number;
  /** Total duration in seconds, optional for context. */
  totalSeconds?: number;
  /** Label describing what is counting down. */
  label?: string;
  /** Whether the countdown is paused. */
  isPaused?: boolean;
  /** Text display size. Defaults to "lg". */
  size?: "sm" | "md" | "lg";
  /** Additional CSS class names. */
  className?: string;
}

const SIZE_CLASSES = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-5xl sm:text-6xl",
};

export function formatTimeDigits(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function formatVerbalTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  if (safeSeconds === 0) return "Time is complete — take a gentle pause";
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  if (minutes > 0 && seconds > 0) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} and ${seconds} second${seconds === 1 ? "" : "s"} remaining`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} remaining`;
  }
  return `${seconds} second${seconds === 1 ? "" : "s"} remaining`;
}

export const CountdownDisplay: React.FC<CountdownDisplayProps> = ({
  secondsRemaining,
  totalSeconds,
  label,
  isPaused = false,
  size = "lg",
  className = "",
}) => {
  const formattedDigits = formatTimeDigits(secondsRemaining);
  const verbalDescription = formatVerbalTime(secondsRemaining);

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      className={`text-center space-y-2 font-sans select-none ${className}`.trim()}
    >
      {label && (
        <p className="text-xs uppercase tracking-wider font-semibold text-deepGreen bg-deepGreen-50 inline-block px-3 py-1 rounded-full">
          {label}
        </p>
      )}

      {/* Primary readable digital text presentation */}
      <div
        aria-hidden="true"
        className={`font-display font-medium text-textHeading tracking-widest tabular-nums ${SIZE_CLASSES[size]}`}
      >
        {formattedDigits}
      </div>

      {/* Accessible verbal text representation for screen readers and low-sensory users */}
      <p className="text-xs sm:text-sm text-textMuted font-light">
        {isPaused ? `Paused • ${verbalDescription}` : verbalDescription}
      </p>
    </div>
  );
};
