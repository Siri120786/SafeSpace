// Profile and onboarding data access.
//
// This module is the shared API boundary for authenticated-user
// profile preferences. Web and Flutter must use these functions rather
// than accessing Supabase tables directly.

import { getSafeSpaceClient } from "./supabaseClient";
import type {
  ModuleKey,
  ProfileAccessibilityPreferences,
  ProfileSupportPreferences,
  UserProfile,
} from "@safespace/shared-types";

export interface SaveSupportPreferencesInput {
  profileId: string;
  supportAreas: ModuleKey[];
}

export interface SaveAccessibilityPreferencesInput {
  profileId: string;
  reducedSensoryStimulation: boolean;
  largerText: boolean;
  readAloud: boolean;
  simplifiedPresentation: boolean;
}

/**
 * Fetch the authenticated user's support preferences.
 *
 * RLS is the ownership boundary. The profileId is included in the query
 * for an explicit lookup, but RLS must still reject access to another
 * user's row.
 */
export async function getSupportPreferences(
  profileId: string,
): Promise<ProfileSupportPreferences | null> {
  const supabase = getSafeSpaceClient();

  const { data, error } = await supabase
    .from("profile_support_preferences")
    .select("profile_id, support_areas, created_at, updated_at")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    profileId: data.profile_id,
    supportAreas: data.support_areas as ModuleKey[],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Create or replace the authenticated user's support preferences.
 */
export async function saveSupportPreferences(
  input: SaveSupportPreferencesInput,
): Promise<ProfileSupportPreferences> {
  const supabase = getSafeSpaceClient();

  const { data, error } = await supabase
    .from("profile_support_preferences")
    .upsert(
      {
        profile_id: input.profileId,
        support_areas: input.supportAreas,
      },
      {
        onConflict: "profile_id",
      },
    )
    .select("profile_id, support_areas, created_at, updated_at")
    .single();

  if (error) throw error;

  return {
    profileId: data.profile_id,
    supportAreas: data.support_areas as ModuleKey[],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Fetch the authenticated user's accessibility preferences.
 */
export async function getAccessibilityPreferences(
  profileId: string,
): Promise<ProfileAccessibilityPreferences | null> {
  const supabase = getSafeSpaceClient();

  const { data, error } = await supabase
    .from("profile_accessibility_preferences")
    .select(
      "profile_id, reduced_sensory_stimulation, larger_text, read_aloud, simplified_presentation, created_at, updated_at",
    )
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    profileId: data.profile_id,
    reducedSensoryStimulation: data.reduced_sensory_stimulation,
    largerText: data.larger_text,
    readAloud: data.read_aloud,
    simplifiedPresentation: data.simplified_presentation,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Create or replace the authenticated user's accessibility preferences.
 */
export async function saveAccessibilityPreferences(
  input: SaveAccessibilityPreferencesInput,
): Promise<ProfileAccessibilityPreferences> {
  const supabase = getSafeSpaceClient();

  const { data, error } = await supabase
    .from("profile_accessibility_preferences")
    .upsert(
      {
        profile_id: input.profileId,
        reduced_sensory_stimulation: input.reducedSensoryStimulation,
        larger_text: input.largerText,
        read_aloud: input.readAloud,
        simplified_presentation: input.simplifiedPresentation,
      },
      {
        onConflict: "profile_id",
      },
    )
    .select(
      "profile_id, reduced_sensory_stimulation, larger_text, read_aloud, simplified_presentation, created_at, updated_at",
    )
    .single();

  if (error) throw error;

  return {
    profileId: data.profile_id,
    reducedSensoryStimulation: data.reduced_sensory_stimulation,
    largerText: data.larger_text,
    readAloud: data.read_aloud,
    simplifiedPresentation: data.simplified_presentation,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Mark the authenticated user's onboarding as completed.
 *
 * RLS on profiles ensures that only the owner can update their own
 * profile row.
 */
export async function completeOnboarding(
  profileId: string,
): Promise<UserProfile> {
  const supabase = getSafeSpaceClient();

  const { data, error } = await supabase
    .from("profiles")
    .update({
      onboarding_state: "completed",
    })
    .eq("id", profileId)
    .select(
      "id, role, display_name, onboarding_state, created_at, updated_at",
    )
    .single();

  if (error) throw error;

  return {
    id: data.id,
    role: data.role,
    displayName: data.display_name,
    onboardingState: data.onboarding_state,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update user profile fields (e.g. displayName).
 */
export async function updateUserProfile(
  profileId: string,
  updates: { displayName?: string },
): Promise<UserProfile> {
  const supabase = getSafeSpaceClient();
  const payload: Record<string, unknown> = {};
  if (updates.displayName !== undefined) {
    payload.display_name = updates.displayName;
  }

  if (Object.keys(payload).length === 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, role, display_name, onboarding_state, created_at, updated_at",
      )
      .eq("id", profileId)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      role: data.role,
      displayName: data.display_name,
      onboardingState: data.onboarding_state,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", profileId)
    .select(
      "id, role, display_name, onboarding_state, created_at, updated_at",
    )
    .single();

  if (error) throw error;

  return {
    id: data.id,
    role: data.role,
    displayName: data.display_name,
    onboardingState: data.onboarding_state,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}