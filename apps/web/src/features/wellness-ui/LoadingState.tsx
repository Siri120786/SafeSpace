import React from "react";
import { useReducedMotion } from "./useReducedMotion";
import { MeadowPage } from "../landing/hero/MeadowPage";

export interface LoadingStateProps {
  /** Reassuring message shown while loading. Defaults to "Taking a quiet moment to prepare..." */
  message?: string;
  /** Size variant. Defaults to "md". */
  size?: "sm" | "md" | "lg";
  /** Whether to center the loader across the full viewport. Defaults to false. */
  fullScreen?: boolean;
  /** Optional override for reduced motion; falls back to `useReducedMotion()` hook. */
  reducedMotion?: boolean;
  /** Additional CSS class names. */
  className?: string;
}

const ICON_SIZES = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Taking a quiet moment to prepare...",
  size = "md",
  fullScreen = false,
  reducedMotion: explicitReducedMotion,
  className = "",
}) => {
  const hookResult = useReducedMotion();
  const isReduced = explicitReducedMotion ?? hookResult.reducedMotion;

  const content = (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 p-6 text-center select-none ${className}`.trim()}
    >
      <div
        className={`${ICON_SIZES[size]} text-olive-500 flex items-center justify-center`}
        data-decorative="true"
      >
        {isReduced ? (
          // Still icon for reduced sensory / motion users
          <span className="text-2xl" aria-hidden="true">
            🌱
          </span>
        ) : (
          // Gentle SVG spinner when motion is welcomed
          <svg
            className="animate-spin text-olive-500 w-full h-full"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
      </div>
      <p className="font-sans text-xs sm:text-sm text-textMuted font-light">
        {message}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <MeadowPage>
        <div className="rounded-3xl bg-white/90 px-6 py-5 shadow-[0_8px_20px_rgba(20,60,100,0.18)]">{content}</div>
      </MeadowPage>
    );
  }

  return content;
};
