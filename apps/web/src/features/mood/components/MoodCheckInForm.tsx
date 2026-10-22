// apps/web/src/features/mood/components/MoodCheckInForm.tsx
// Check-in form composing the mood selector, optional intensity, note input, and save action.

import React from "react";
import type { MoodValue } from "@safespace/shared-types";
import { MoodSelector } from "./MoodSelector";
import { IntensitySelector } from "./IntensitySelector";
import { MoodNoteInput } from "./MoodNoteInput";
import { Button } from "../../../components/ui/Button";
import type { MoodCheckInStatus } from "../hooks/useMoodCheckIn";

interface MoodCheckInFormProps {
  selectedMood: MoodValue | null;
  onSelectMood: (mood: MoodValue) => void;
  intensity: number | null;
  onChangeIntensity: (intensity: number | null) => void;
  note: string;
  onChangeNote: (note: string) => void;
  status: MoodCheckInStatus;
  errorMessage: string | null;
  onSave: () => void;
  onReset: () => void;
}

export const MoodCheckInForm: React.FC<MoodCheckInFormProps> = ({
  selectedMood,
  onSelectMood,
  intensity,
  onChangeIntensity,
  note,
  onChangeNote,
  status,
  errorMessage,
  onSave,
  onReset,
}) => {
  const isSaving = status === "saving";
  const isSaved = status === "saved";
  const canSave = selectedMood !== null && !isSaving;

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Success Notification Banner */}
      {isSaved && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-olive-50 border border-olive-300 rounded-2xl gap-3"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl" role="img" aria-label="leaf">
              🌿
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-olive-800">
                Check-in saved!
              </span>
              <span className="text-xs text-olive-700">
                Thank you for taking a moment to check in with yourself.
              </span>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={onReset} className="self-end sm:self-center">
            Check in again
          </Button>
        </div>
      )}

      {/* Error Banner */}
      {status === "error" && errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between p-4 bg-red-50/70 border border-red-200 rounded-2xl text-xs sm:text-sm text-red-700 gap-3"
        >
          <span>{errorMessage}</span>
          <Button size="sm" variant="outline" onClick={onSave} className="shrink-0">
            Retry
          </Button>
        </div>
      )}

      {/* Mood Selector (Radio Group) */}
      <MoodSelector
        value={selectedMood}
        onChange={onSelectMood}
        disabled={isSaving}
      />

      <hr className="border-olive-100/80 my-1" />

      {/* Optional Intensity Selector */}
      <IntensitySelector
        value={intensity}
        onChange={onChangeIntensity}
        disabled={isSaving}
      />

      <hr className="border-olive-100/80 my-1" />

      {/* Optional Note Input */}
      <MoodNoteInput
        value={note}
        onChange={onChangeNote}
        disabled={isSaving}
      />

      {/* Save Button */}
      <div className="pt-2">
        <Button
          fullWidth
          variant="primary"
          size="lg"
          disabled={!canSave}
          onClick={onSave}
          aria-busy={isSaving}
        >
          {isSaving ? "Saving your check-in…" : "Save Check-in"}
        </Button>
      </div>
    </div>
  );
};
