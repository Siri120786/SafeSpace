// packages/shared-types/src/index.ts
// Single source of truth for domain types. apps/web and apps/mobile both
// import from here — never redeclare these shapes locally in either app.

export type UserRole = "caregiver" | "user";

export type OnboardingState = "pending" | "completed";

export type ModuleKey = "autism" | "adhd" | "anxiety" | "depression" | "ptsd" | "pcos_pcod";

export type PrivacyTier = "full" | "partial" | "private";

export interface ConditionModule {
  key: ModuleKey;
  displayName: string;   // friendly, non-clinical name shown to the child
  isBuilt: boolean;      // honesty flag — only "autism" is true right now
}

export interface UserProfile {
  id: string;
  role: UserRole;
  displayName: string | null;
  onboardingState: OnboardingState;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileSupportPreferences {
  profileId: string;
  supportAreas: ModuleKey[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfileAccessibilityPreferences {
  profileId: string;
  reducedSensoryStimulation: boolean;
  largerText: boolean;
  readAloud: boolean;
  simplifiedPresentation: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Child {
  id: string;
  caregiverId: string;
  name: string;
  age: number;
  privacyTier: PrivacyTier;
  assignedModules: ModuleKey[];
}

export interface Caregiver {
  id: string;
  displayName: string | null;
}

export interface JournalEntry {
  id: string;
  childId: string;
  moduleKey: ModuleKey;
  content: string;
  sentimentFlags: Record<string, unknown> | null;
  isPrivateNote: boolean;
  createdAt: string;
}

export interface RoutineStep {
  id: string;
  childId: string;
  moduleKey: ModuleKey;
  label: string;
  scheduledTime: string | null;
  isComplete: boolean;
  orderIndex: number;
}

export interface EmergencyEvent {
  id: string;
  childId: string;
  triggeredBy: "check_in" | "aac_tap" | "journal_flag";
  classifierScore: number;
  aiAlertSummary: string;
  caregiverNotifiedAt: string | null;
  reviewedAt: string | null;
}

// ----------------------------------------------------------------------------
// Session types — distinguishes a registered user's Supabase Auth session from
// a child's scoped, PIN-issued session.
// ----------------------------------------------------------------------------
export interface UserAuthSession {
  kind: "auth_user";
  user: {
    id: string;
    email: string;
  };
  profile: UserProfile;
  supabaseAccessToken: string;
}

// Retained for backward compatibility with existing caregiver session interfaces
export interface CaregiverSession {
  kind: "caregiver";
  supabaseAccessToken: string;
}

export interface ChildSession {
  kind: "child";
  childSessionToken: string;
  childId: string;
}

export type AppSession = UserAuthSession | CaregiverSession | ChildSession | null;
// ----------------------------------------------------------------------------
// Caregiver view of a linked user (Sprint 1). Read-only.
// ----------------------------------------------------------------------------
export interface LinkedUser {
  linkId: string;
  userId: string;
  displayName: string | null;
  onboardingState: OnboardingState;
  linkedAt: string;
}

export interface LinkedUserProfileView {
  profile: UserProfile;
  supportPreferences: ProfileSupportPreferences | null;
  accessibilityPreferences: ProfileAccessibilityPreferences | null;
}