// apps/web/src/features/mood/utils/moodLogic.ts
// Pure logic for mood check-in validation, normalization, and friendly messaging.
// Completely decoupled from React/UI so it can be thoroughly unit-tested.

import {
  MOOD_VALUES,
  MOOD_INTENSITY_MIN,
  MOOD_INTENSITY_MAX,
  MOOD_NOTE_MAX_LENGTH,
} from "@safespace/shared-types";
import type { MoodValue, CreateMoodCheckinInput } from "@safespace/shared-types";

export interface CleanMoodCheckInInput {
  mood: MoodValue;
  intensity?: number;
  note?: string;
}

/**
 * Normalizes and validates the user's input before sending to the API.
 * Trims note; if the note is empty or whitespace-only, omits it (sends undefined)
 * because the database rejects blank string notes.
 */
export function prepareMoodCheckInPayload(
  mood: MoodValue | null | undefined,
  intensity?: number | null,
  note?: string | null,
): { valid: true; payload: CleanMoodCheckInInput } | { valid: false; error: string } {
  if (!mood || !MOOD_VALUES.includes(mood)) {
    return { valid: false, error: "invalid_mood" };
  }

  let cleanIntensity: number | undefined = undefined;
  if (intensity !== undefined && intensity !== null) {
    if (
      !Number.isInteger(intensity) ||
      intensity < MOOD_INTENSITY_MIN ||
      intensity > MOOD_INTENSITY_MAX
    ) {
      return { valid: false, error: "invalid_intensity" };
    }
    cleanIntensity = intensity;
  }

  let cleanNote: string | undefined = undefined;
  if (note !== undefined && note !== null) {
    const trimmed = note.trim();
    if (trimmed.length > 0) {
      if (trimmed.length > MOOD_NOTE_MAX_LENGTH) {
        return { valid: false, error: "note_too_long" };
      }
      cleanNote = trimmed;
    }
  }

  const payload: CleanMoodCheckInInput = {
    mood,
    ...(cleanIntensity !== undefined ? { intensity: cleanIntensity } : {}),
    ...(cleanNote !== undefined ? { note: cleanNote } : {}),
  };

  return { valid: true, payload };
}

/**
 * Maps system and API error codes to warm, non-clinical, supportive user messages.
 */
export function getFriendlyErrorMessage(error: unknown): string {
  if (!error) return "Something went wrong. Please try again.";

  const rawMessage = error instanceof Error ? error.message : String(error);

  if (rawMessage.includes("invalid_mood")) {
    return "Please select how you're feeling to continue.";
  }
  if (rawMessage.includes("invalid_intensity")) {
    return `Intensity must be between ${MOOD_INTENSITY_MIN} and ${MOOD_INTENSITY_MAX}.`;
  }
  if (rawMessage.includes("note_too_long")) {
    return `Notes can be up to ${MOOD_NOTE_MAX_LENGTH} characters. Please shorten your note.`;
  }
  if (rawMessage.includes("unsupported_session") || rawMessage.includes("invalid_session")) {
    return "Your sign-in session expired or was not recognized. Please sign in again.";
  }
  if (rawMessage.includes("Failed to fetch") || rawMessage.includes("NetworkError") || rawMessage.includes("network")) {
    return "Unable to connect right now. Please check your internet connection and try again.";
  }

  return "We couldn't save your check-in right now. Please try again in a moment.";
}

/**
 * Human-friendly date and time formatter for check-in history.
 */
export function formatCheckInTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const formattedTime = timeFormatter.format(date);

    if (isToday) {
      return `Today at ${formattedTime}`;
    }
    if (isYesterday) {
      return `Yesterday at ${formattedTime}`;
    }

    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
    return `${dateFormatter.format(date)} at ${formattedTime}`;
  } catch {
    return dateString;
  }
}
