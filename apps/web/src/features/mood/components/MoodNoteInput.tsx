// apps/web/src/features/mood/components/MoodNoteInput.tsx
// Optional note input for mood check-in with live character count.

import React from "react";
import { MOOD_NOTE_MAX_LENGTH } from "@safespace/shared-types";

interface MoodNoteInputProps {
  value: string;
  onChange: (note: string) => void;
  disabled?: boolean;
}

export const MoodNoteInput: React.FC<MoodNoteInputProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const currentLength = value.length;
  const isNearLimit = currentLength > MOOD_NOTE_MAX_LENGTH * 0.85;
  const isAtLimit = currentLength >= MOOD_NOTE_MAX_LENGTH;

  return (
    <div className="w-full flex flex-col gap-1.5 text-left font-sans">
      <div className="flex items-center justify-between">
        <label htmlFor="mood-note-textarea" className="text-sm font-medium text-textHeading">
          Add a note <span className="text-xs text-textMuted font-normal">(Optional)</span>
        </label>
        <span
          aria-live="polite"
          className={`text-xs ${
            isAtLimit
              ? "text-red-500 font-semibold"
              : isNearLimit
              ? "text-amber-600 font-medium"
              : "text-textMuted"
          }`}
        >
          {currentLength} / {MOOD_NOTE_MAX_LENGTH}
        </span>
      </div>

      <div className="relative">
        <textarea
          id="mood-note-textarea"
          rows={3}
          value={value}
          maxLength={MOOD_NOTE_MAX_LENGTH}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="What's on your mind? (Only if you'd like to share, take your time)"
          className={`w-full px-4 py-3 rounded-2xl bg-white border text-textHeading placeholder:text-textMuted/60 text-sm md:text-base transition-all duration-200 resize-none focus:outline-none focus:ring-2 focus:ring-olive-500 focus:border-transparent ${
            isAtLimit ? "border-amber-400 bg-amber-50/10" : "border-olive-200/80 shadow-sm"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        />
      </div>

      <p className="text-xs text-textMuted">
        Your notes are just for you to look back on how you were doing.
      </p>
    </div>
  );
};
