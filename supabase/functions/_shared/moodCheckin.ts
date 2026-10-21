// supabase/functions/_shared/moodCheckin.ts
// Server-side validation for mood check-ins. Pure TypeScript (no Deno APIs) so
// it runs under Node in supabase/tests/mood.test.mts.
//
// Edge Functions cannot import workspace packages, so MOOD_VALUES is repeated
// here. The test asserts it matches packages/shared-types and the
// mood_checkins.mood check constraint.

export const MOOD_VALUES = ["ecstatic", "happy", "neutral", "sad", "stressed", "overwhelmed"] as const;
export type MoodValue = (typeof MOOD_VALUES)[number];

export const INTENSITY_MIN = 1;
export const INTENSITY_MAX = 5;
export const NOTE_MAX_LENGTH = 500;
export const DEFAULT_LIMIT = 30;
export const MAX_LIMIT = 100;

export interface ValidMoodCheckin {
  mood: MoodValue;
  intensity: number | null;
  note: string | null;
  is_private_note: boolean;
}

export type MoodValidation =
  | { ok: true; value: ValidMoodCheckin }
  | { ok: false; error: string };

export function validateMoodCheckin(body: Record<string, unknown>): MoodValidation {
  const { mood, intensity, note, is_private_note } = body;

  if (typeof mood !== "string" || !(MOOD_VALUES as readonly string[]).includes(mood)) {
    return { ok: false, error: "invalid_mood" };
  }

  if (intensity !== undefined && intensity !== null &&
      (!Number.isInteger(intensity) || (intensity as number) < INTENSITY_MIN || (intensity as number) > INTENSITY_MAX)) {
    return { ok: false, error: "invalid_intensity" };
  }

  if (note !== undefined && note !== null && typeof note !== "string") {
    return { ok: false, error: "invalid_note" };
  }
  const cleanNote = typeof note === "string" && note.trim() ? note.trim() : null;
  if (cleanNote !== null && cleanNote.length > NOTE_MAX_LENGTH) {
    return { ok: false, error: "note_too_long" };
  }

  if (is_private_note !== undefined && typeof is_private_note !== "boolean") {
    return { ok: false, error: "invalid_private_note" };
  }

  return {
    ok: true,
    value: {
      mood: mood as MoodValue,
      intensity: (intensity as number | null | undefined) ?? null,
      note: cleanNote,
      is_private_note: is_private_note === true,
    },
  };
}

export function clampLimit(limit: unknown): number {
  if (!Number.isInteger(limit) || (limit as number) < 1) return DEFAULT_LIMIT;
  return Math.min(limit as number, MAX_LIMIT);
}

