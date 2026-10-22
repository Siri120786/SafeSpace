// apps/web/src/features/mood/components/IntensitySelector.tsx
// Optional self-rated intensity selector (1 to 5), with clear/reset ability.

import React from "react";
import {
  MOOD_INTENSITY_MIN,
  MOOD_INTENSITY_MAX,
} from "@safespace/shared-types";

interface IntensitySelectorProps {
  value: number | null;
  onChange: (intensity: number | null) => void;
  disabled?: boolean;
}

const INTENSITY_DESCRIPTIONS: Record<number, string> = {
  1: "A little",
  2: "Mild",
  3: "Moderate",
  4: "Noticeable",
  5: "Very strong",
};

export const IntensitySelector: React.FC<IntensitySelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const levels = Array.from(
    { length: MOOD_INTENSITY_MAX - MOOD_INTENSITY_MIN + 1 },
    (_, i) => MOOD_INTENSITY_MIN + i,
  );

  const handleSelect = (level: number) => {
    if (disabled) return;
    // Clicking the same number again clears it (toggle behavior)
    if (value === level) {
      onChange(null);
    } else {
      onChange(level);
    }
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label id="intensity-selector-label" className="text-sm font-medium text-textHeading">
          Intensity <span className="text-xs text-textMuted font-normal">(Optional)</span>
        </label>
        {value !== null && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-textMuted hover:text-olive-700 underline underline-offset-2 transition-colors cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      <p className="text-xs text-textMuted">
        How strong is this feeling? Pick a number from {MOOD_INTENSITY_MIN} to {MOOD_INTENSITY_MAX}, or leave it unselected.
      </p>

      <div
        role="group"
        aria-labelledby="intensity-selector-label"
        className="flex items-center justify-between gap-2 sm:gap-3 mt-1"
      >
        {levels.map((level) => {
          const isSelected = value === level;
          const description = INTENSITY_DESCRIPTIONS[level] || `Level ${level}`;

          return (
            <button
              key={level}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(level)}
              aria-pressed={isSelected}
              aria-label={`Intensity ${level} of 5: ${description}`}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 px-1 min-h-[44px] rounded-xl border transition-all duration-200 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-olive-500 focus-visible:ring-offset-2 ${
                isSelected
                  ? "bg-olive-500 text-white border-olive-600 shadow-sm font-bold scale-[1.02]"
                  : "bg-white/90 hover:bg-white text-textHeading border-olive-200/80 hover:border-olive-300 shadow-sm font-medium"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:-translate-y-0.5"}`}
            >
              <span className="text-base font-semibold">{level}</span>
              <span
                className={`text-[10px] mt-0.5 tracking-tight ${
                  isSelected ? "text-white/90" : "text-textMuted"
                }`}
              >
                {description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
