// packages/api-client/src/auth.ts
// Implements full Phase 1 authentication, identity & session management.

import { getSafeSpaceClient } from "./supabaseClient";
import type {
  AppSession,
  UserAuthSession,
  ChildSession,
  UserProfile,
  UserRole,
} from "@safespace/shared-types";

/**
 * Sign up a user with Supabase Auth and metadata (role + display name).
 */
export async function signUpUser(
  email: string,
  password: string,
  role: UserRole = "caregiver",
  displayName?: string
) {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        display_name: displayName || "",
      },
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Deprecated alias for signUpUser specifically for caregivers.
 */
export async function signUpCaregiver(email: string, password: string) {
  return signUpUser(email, password, "caregiver");
}

/**
 * Log in a user with email and password via Supabase Auth.
 */
export async function logInUser(email: string, password: string) {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Deprecated alias for logInUser specifically for caregivers.
 */
export async function logInCaregiver(email: string, password: string) {
  return logInUser(email, password);
}

/**
 * Request password reset email.
 */
export async function resetPasswordForEmail(email: string, redirectTo?: string) {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
  return data;
}

/**
 * Update password for currently authenticated user.
 */
export async function updatePassword(newPassword: string) {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
  return data;
}

/**
 * Fetch profile data for a given user ID from PostgreSQL `profiles` table.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, onboarding_state, created_at, updated_at")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    role: data.role as UserRole,
    displayName: data.display_name,
    onboardingState: data.onboarding_state,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Retrieve current active session and profile.
 */
export async function getExistingSession(): Promise<AppSession> {
  const supabase = getSafeSpaceClient();
  const { data } = await supabase.auth.getSession();
  if (data.session && data.session.user) {
    const profile = await getUserProfile(data.session.user.id);
    const userSession: UserAuthSession = {
      kind: "auth_user",
      user: {
        id: data.session.user.id,
        email: data.session.user.email || "",
      },
      profile: profile || {
        id: data.session.user.id,
        role: (data.session.user.user_metadata?.role as UserRole) || "caregiver",
        displayName: data.session.user.user_metadata?.display_name || null,
        onboardingState: "pending",
        createdAt: data.session.user.created_at,
        updatedAt: data.session.user.created_at,
      },
      supabaseAccessToken: data.session.access_token,
    };
    return userSession;
  }
  return null;
}

/**
 * Listen for Supabase Auth state changes.
 */
export function onAuthStateChange(
  callback: (event: string, session: AppSession) => void
) {
  const supabase = getSafeSpaceClient();
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
      const profile = await getUserProfile(session.user.id);
      const userSession: UserAuthSession = {
        kind: "auth_user",
        user: {
          id: session.user.id,
          email: session.user.email || "",
        },
        profile: profile || {
          id: session.user.id,
          role: (session.user.user_metadata?.role as UserRole) || "caregiver",
          displayName: session.user.user_metadata?.display_name || null,
          onboardingState: "pending",
          createdAt: session.user.created_at,
          updatedAt: session.user.created_at,
        },
        supabaseAccessToken: session.access_token,
      };
      callback(event, userSession);
    } else {
      callback(event, null);
    }
  });
}

/**
 * Child: PIN verification via server-side Edge Function.
 */
export async function verifyChildPin(
  familyCode: string,
  pin: string
): Promise<ChildSession> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.functions.invoke("verify-child-pin", {
    body: { family_code: familyCode, pin },
  });
  if (error) throw error;
  if (!data?.child_session_token || !data?.child_id) {
    throw new Error("invalid_pin");
  }
  return {
    kind: "child",
    childSessionToken: data.child_session_token,
    childId: data.child_id,
  };
}

/**
 * Sign out of Supabase Auth.
 */
export async function logOut() {
  const supabase = getSafeSpaceClient();
  await supabase.auth.signOut();
}
