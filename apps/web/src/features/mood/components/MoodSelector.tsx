// apps/web/src/features/mood/components/MoodSelector.tsx
// Accessible radiogroup for mood selection, reusing MoodAvatar and MOOD_LIST.

import React, { useRef, useEffect } from "react";
import type { MoodValue } from "@safespace/shared-types";
import {
  MoodAvatar,
  MOOD_LIST,
  type MoodOption,
} from "../../../components/vectors/MoodAvatars";
import { useAccessibility } from "../../profile/context/AccessibilityContext";

interface MoodSelectorProps {
  value: MoodValue | null;
  onChange: (mood: MoodValue) => void;
  disabled?: boolean;
}

export const MoodSelector: React.FC<MoodSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const { preferences } = useAccessibility();
  const isReducedMotion = preferences?.reducedSensoryStimulation ?? false;
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keep button refs array synchronized
  useEffect(() => {
    buttonRefs.current = buttonRefs.current.slice(0, MOOD_LIST.length);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (disabled) return;

    let nextIndex: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (index + 1) % MOOD_LIST.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (index - 1 + MOOD_LIST.length) % MOOD_LIST.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = MOOD_LIST.length - 1;
    }

    if (nextIndex !== null) {
      const nextOption = MOOD_LIST[nextIndex];
      onChange(nextOption.id as MoodValue);
      buttonRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <label id="mood-selector-label" className="text-base font-semibold text-textHeading">
        How are you feeling right now?
      </label>
      <p className="text-xs text-textMuted">
        Pick the feeling that closest matches your state. Take your time.
      </p>

      <div
        role="radiogroup"
        aria-labelledby="mood-selector-label"
        className={`grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4 mt-1 ${
          isReducedMotion ? "[&_*]:transition-none [&_*]:transform-none" : ""
        }`}
      >
        {MOOD_LIST.map((option: MoodOption, index: number) => {
          const isSelected = value === option.id;
          const tabIndex =
            isSelected || (!value && index === 0) ? 0 : -1;

          return (
            <button
              key={option.id}
              ref={(el) => (buttonRefs.current[index] = el)}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={tabIndex}
              disabled={disabled}
              onClick={() => onChange(option.id as MoodValue)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-olive-500 focus-visible:ring-offset-2 ${
                isSelected
                  ? "bg-olive-50/80 border-olive-500 shadow-md ring-2 ring-olive-500/20"
                  : "bg-white/80 hover:bg-white border-olive-100 hover:border-olive-200 shadow-sm"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:-translate-y-0.5 active:translate-y-0"}`}
            >
              <div className="pointer-events-none mb-2">
                <MoodAvatar
                  type={option.id}
                  size={48}
                  selected={isSelected}
                />
              </div>
              <span
                className={`text-xs sm:text-sm font-medium tracking-tight text-center ${
                  isSelected ? "text-olive-700 font-semibold" : "text-textBody"
                }`}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
