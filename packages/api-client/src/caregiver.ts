// packages/api-client/src/caregiver.ts
// Caregiver-side read access to a linked user's basic profile.
// RLS (20261009170000_caregiver_user_links.sql) is the access boundary.
// No client-side filtering or access logic is applied here.

import { getSafeSpaceClient } from "./supabaseClient";
import {
  getSupportPreferences,
  getAccessibilityPreferences,
} from "./profile";
import type {
  LinkedUser,
  LinkedUserProfileView,
} from "@safespace/shared-types";

export async function listLinkedUsers(
  caregiverId: string,
): Promise<LinkedUser[]> {
  const supabase = getSafeSpaceClient();

  const { data: links, error } = await supabase
    .from("caregiver_user_links")
    .select("id, user_id, created_at")
    .eq("caregiver_id", caregiverId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!links || links.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, onboarding_state")
    .in(
      "id",
      links.map((l) => l.user_id),
    );

  if (profilesError) throw profilesError;

  return links.flatMap((link) => {
    const p = (profiles ?? []).find((x) => x.id === link.user_id);
    if (!p) return [];
    return [
      {
        linkId: link.id,
        userId: link.user_id,
        displayName: p.display_name,
        onboardingState: p.onboarding_state,
        linkedAt: link.created_at,
      },
    ];
  });
}

/**
 * Returns null when the caller is not actively linked to this user
 * (RLS returns no row).
 */
export async function getLinkedUserProfile(
  linkedUserId: string,
): Promise<LinkedUserProfileView | null> {
  const supabase = getSafeSpaceClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, onboarding_state, created_at, updated_at")
    .eq("id", linkedUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [supportPreferences, accessibilityPreferences] = await Promise.all([
    getSupportPreferences(linkedUserId),
    getAccessibilityPreferences(linkedUserId),
  ]);

  return {
    profile: {
      id: data.id,
      role: data.role,
      displayName: data.display_name,
      onboardingState: data.onboarding_state,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
    supportPreferences,
    accessibilityPreferences,
  };
}
