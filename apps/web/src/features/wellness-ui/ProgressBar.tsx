import React from "react";
import { useReducedMotion } from "./useReducedMotion";

export interface ProgressBarProps {
  /** Current progress value (between 0 and max). */
  value: number;
  /** Maximum progress value. Defaults to 100. */
  max?: number;
  /** Optional accessible label for the progress bar. */
  label?: string;
  /** Whether to render the percentage/numeric progress text. Defaults to false. */
  showValue?: boolean;
  /** Color theme variant. Defaults to "olive". */
  variant?: "olive" | "deepGreen" | "warm";
  /** Explicit override for reduced motion; falls back to `useReducedMotion()` hook. */
  reducedMotion?: boolean;
  /** Additional CSS class names for the outer container. */
  className?: string;
}

const BAR_VARIANTS: Record<NonNullable<ProgressBarProps["variant"]>, string> = {
  olive: "bg-olive-500",
  deepGreen: "bg-deepGreen",
  warm: "bg-accent-warm",
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showValue = false,
  variant = "olive",
  reducedMotion: explicitReducedMotion,
  className = "",
}) => {
  const hookResult = useReducedMotion();
  const isReduced = explicitReducedMotion ?? hookResult.reducedMotion;

  const safeMax = max > 0 ? max : 100;
  const clampedValue = Math.min(Math.max(value, 0), safeMax);
  const percentage = Math.round((clampedValue / safeMax) * 100);

  return (
    <div className={`w-full space-y-1.5 ${className}`.trim()}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs font-medium text-textBody">
          {label ? <span>{label}</span> : <span />}
          {showValue && <span aria-hidden="true">{percentage}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label || "Progress"}
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuetext={`${percentage}%`}
        className="w-full h-3 rounded-full bg-olive-100/80 overflow-hidden relative"
      >
        <div
          style={{ width: `${percentage}%` }}
          className={`h-full rounded-full ${BAR_VARIANTS[variant]} ${
            isReduced ? "transition-none" : "transition-[width] duration-300 ease-out"
          }`}
        />
      </div>
    </div>
  );
};
