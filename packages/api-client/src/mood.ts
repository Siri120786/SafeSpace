// packages/api-client/src/mood.ts
// Shared mood check-in contract (Sprint 2). Web and Flutter use this shape;
// UI code calls these functions and never touches mood_checkins directly.
//
// Two identity tracks, one API:
//   - Adult auth users: direct table access, RLS is the ownership boundary
//     (20261019120000_mood_checkins.sql).
//   - Children: the mood-checkin Edge Function, scoped by the signed
//     child-session token (children have no auth.users row).
// The Supabase client attaches the current auth token itself, so no access
// token is passed around here.

import { getSafeSpaceClient } from "./supabaseClient";
import {
  MOOD_VALUES,
  MOOD_INTENSITY_MIN,
  MOOD_INTENSITY_MAX,
  MOOD_NOTE_MAX_LENGTH,
} from "@safespace/shared-types";
import type {
  AppSession,
  CreateMoodCheckinInput,
  ListMoodCheckinsOptions,
  MoodCheckin,
  MoodValue,
} from "@safespace/shared-types";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const COLUMNS =
  "id, profile_id, child_id, mood, intensity, note, is_private_note, created_at";

function toMoodCheckin(row: any): MoodCheckin {
  return {
    id: row.id,
    profileId: row.profile_id,
    childId: row.child_id,
    mood: row.mood as MoodValue,
    intensity: row.intensity,
    note: row.note,
    isPrivateNote: row.is_private_note,
    createdAt: row.created_at,
  };
}

function clampLimit(limit: number | undefined): number {
  if (!limit || !Number.isInteger(limit) || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

// Validates and normalises input so the UI gets a readable error instead of a
// raw constraint violation. The database and Edge Function re-check all of it.
function normaliseInput(input: CreateMoodCheckinInput) {
  if (!MOOD_VALUES.includes(input.mood)) {
    throw new Error("invalid_mood");
  }
  const intensity = input.intensity ?? null;
  if (
    intensity !== null &&
    (!Number.isInteger(intensity) ||
      intensity < MOOD_INTENSITY_MIN ||
      intensity > MOOD_INTENSITY_MAX)
  ) {
    throw new Error("invalid_intensity");
  }
  const note = input.note?.trim() || null;
  if (note !== null && note.length > MOOD_NOTE_MAX_LENGTH) {
    throw new Error("note_too_long");
  }
  // Private notes were removed (role flow): refuse callers that still send one.
  if ((input as { isPrivateNote?: unknown }).isPrivateNote === true) throw new Error("invalid_input");
  return { mood: input.mood, intensity, note };
}

async function invokeMoodFunction(body: Record<string, unknown>) {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.functions.invoke("mood-checkin", { body });
  if (error) {
    // Non-2xx responses carry our { error } JSON in the response body.
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === "function"
      ? await ctx.json().catch(() => null)
      : null;
    throw new Error(payload?.error ?? error.message);
  }
  return data;
}

/**
 * Save a mood check-in for whoever is signed in (adult or child).
 */
export async function createMoodCheckin(
  session: AppSession,
  input: CreateMoodCheckinInput,
): Promise<MoodCheckin> {
  const clean = normaliseInput(input);

  if (session?.kind === "child") {
    const data = await invokeMoodFunction({
      action: "create",
      child_session_token: session.childSessionToken,
      mood: clean.mood,
      intensity: clean.intensity,
      note: clean.note,
    });
    return toMoodCheckin(data.checkin);
  }

  if (session?.kind === "auth_user") {
    const supabase = getSafeSpaceClient();
    const { data, error } = await supabase
      .from("mood_checkins")
      .insert({
        profile_id: session.profile.id,
        mood: clean.mood,
        intensity: clean.intensity,
        note: clean.note,
      })
      .select(COLUMNS)
      .single();
    if (error) throw error;
    return toMoodCheckin(data);
  }

  throw new Error("unsupported_session");
}

/**
 * The signed-in user's (or child's) own mood history, newest first.
 */
export async function listMyMoodCheckins(
  session: AppSession,
  options: ListMoodCheckinsOptions = {},
): Promise<MoodCheckin[]> {
  const limit = clampLimit(options.limit);

  if (session?.kind === "child") {
    const data = await invokeMoodFunction({
      action: "list",
      child_session_token: session.childSessionToken,
      limit,
    });
    return (data.checkins ?? []).map(toMoodCheckin);
  }

  if (session?.kind === "auth_user") {
    const supabase = getSafeSpaceClient();
    const { data, error } = await supabase
      .from("mood_checkins")
      .select(COLUMNS)
      .eq("profile_id", session.profile.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toMoodCheckin);
  }

  throw new Error("unsupported_session");
}

/**
 * Caregiver view of one of their children's check-ins, newest first.
 * RLS hides other families' children and a partial-tier child's private
 * notes; this function applies no filtering of its own.
 */
export async function listChildMoodCheckins(
  childId: string,
  options: ListMoodCheckinsOptions = {},
): Promise<MoodCheckin[]> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase
    .from("mood_checkins")
    .select(COLUMNS)
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(clampLimit(options.limit));
  if (error) throw error;
  return (data ?? []).map(toMoodCheckin);
}
