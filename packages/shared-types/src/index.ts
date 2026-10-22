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

// ----------------------------------------------------------------------------
// Mood check-in (Sprint 2 shared wellbeing). User-selected feelings, not a
// clinical assessment. Values match the existing MoodAvatars icons and the
// mood_checkins.mood check constraint (20261019120000_mood_checkins.sql).
// ----------------------------------------------------------------------------
export const MOOD_VALUES = [
  "ecstatic",
  "happy",
  "neutral",
  "sad",
  "stressed",
  "overwhelmed",
] as const;

export type MoodValue = (typeof MOOD_VALUES)[number];

export const MOOD_INTENSITY_MIN = 1;
export const MOOD_INTENSITY_MAX = 5;
export const MOOD_NOTE_MAX_LENGTH = 500;

export interface MoodCheckin {
  id: string;
  profileId: string | null;   // set for adult auth users
  childId: string | null;     // set for child sessions
  mood: MoodValue;
  intensity: number | null;   // 1-5, optional
  note: string | null;        // optional, max 500 chars
  isPrivateNote: boolean;     // child 'partial' privacy tier only
  createdAt: string;
}

export interface CreateMoodCheckinInput {
  mood: MoodValue;
  intensity?: number | null;
  note?: string | null;
  isPrivateNote?: boolean;    // ignored for adults; rejected unless child tier is 'partial'
}

export interface ListMoodCheckinsOptions {
  limit?: number;             // default 30, max 100
}

// ----------------------------------------------------------------------------
// AI Companion types. Mirrors ai_companion_conversations / ai_companion_messages
// (column `language` -> preferredLanguage, `detected_language` -> language).
// ----------------------------------------------------------------------------
export type LanguageCode = "en" | "hi" | "te" | "ta" | "kn" | "mr" | "bn" | "ur";

export interface AiCompanionConversation {
  id: string;
  profileId: string | null;
  childId: string | null;
  preferredLanguage: LanguageCode;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiCompanionMessage {
  id: string;
  conversationId: string;
  sender: "user" | "assistant";
  content: string;
  language: LanguageCode;
  isSafetyResponse: boolean; // fixed crisis-screen exchange, not model output
  createdAt: string;
}

export interface AiCompanionSendResult {
  conversation: AiCompanionConversation;
  userMessage: AiCompanionMessage;
  assistantMessage: AiCompanionMessage;
  // true when the message matched the crisis screen: the reply is a fixed
  // safety message, not model output, and the UI should keep it prominent.
  safetyResponse: boolean;
}
