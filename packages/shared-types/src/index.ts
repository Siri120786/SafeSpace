// packages/shared-types/src/index.ts
// Single source of truth for domain types. apps/web and apps/mobile both
// import from here — never redeclare these shapes locally in either app.

export type UserRole = "caregiver" | "user";

export type OnboardingState = "pending" | "completed";

export const MODULE_KEYS = ["autism", "adhd", "anxiety", "depression", "ptsd", "pcos_pcod"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

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

// ----------------------------------------------------------------------------
// Journaling (Sprint 3). Owned by exactly one identity: an adult (profileId)
// or a child (childId), like MoodCheckin. See docs/sprint-3/CONTRACTS.md.
// ----------------------------------------------------------------------------
export const JOURNAL_ENTRY_TYPES = ["journal", "gratitude"] as const;
export type JournalEntryType = (typeof JOURNAL_ENTRY_TYPES)[number];
export const JOURNAL_CONTENT_MAX_LENGTH = 5000;

export interface JournalEntry {
  id: string;
  profileId: string | null;    // set for adult auth users
  childId: string | null;      // set for child sessions
  moduleKey: ModuleKey | null; // null = shared journal, not tied to a module
  entryType: JournalEntryType;
  content: string;
  isPrivateNote: boolean;      // child 'partial' tier only: hidden from the caregiver
  createdAt: string;
  updatedAt: string;
}

export interface CreateJournalEntryInput {
  content: string;
  entryType?: JournalEntryType; // default "journal"
  moduleKey?: ModuleKey | null;
  isPrivateNote?: boolean;      // ignored for adults; rejected unless child tier is 'partial'
}

// ----------------------------------------------------------------------------
// Routines (Sprint 3). A routine is an ordered list of steps; completion is
// recorded per step per local calendar day, so progress and streaks persist.
// ----------------------------------------------------------------------------
export interface RoutineStep {
  id: string;
  routineId: string;
  label: string;
  scheduledTime: string | null; // "HH:MM" (24h), optional
  orderIndex: number;
}

export interface RoutineStepWithProgress extends RoutineStep {
  completedOnDate: boolean;     // completed on the date the list was requested for
}

export interface Routine {
  id: string;
  profileId: string | null;
  childId: string | null;
  moduleKey: ModuleKey | null;  // null = shared routine
  title: string;
  daysOfWeek: number[];         // 0 = Sunday ... 6 = Saturday; empty = every day
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineWithSteps extends Routine {
  steps: RoutineStepWithProgress[];
}

export interface CreateRoutineInput {
  title: string;
  moduleKey?: ModuleKey | null;
  daysOfWeek?: number[];
  steps: { label: string; scheduledTime?: string | null }[];
}

export interface UpdateRoutineInput {
  title?: string;
  moduleKey?: ModuleKey | null;
  daysOfWeek?: number[];
  isActive?: boolean;
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

// ----------------------------------------------------------------------------
// Reminders (Sprint 3). Delivered IN-APP only this sprint: schedules are
// stored, and the app works out what is due while it is open. No push, SMS or
// email. Same owner rule as journals and routines (exactly one of
// profileId / childId).
// ----------------------------------------------------------------------------
export const REMINDER_KINDS = ["routine", "water", "medication", "wellness", "custom"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];
export const REMINDER_TITLE_MAX_LENGTH = 80;

export interface Reminder {
  id: string;
  profileId: string | null;
  childId: string | null;
  kind: ReminderKind;
  title: string;                // e.g. "Drink a glass of water"; keep medication titles generic
  routineId: string | null;     // set when kind === "routine"
  timeOfDay: string;            // "HH:MM" (24h) in `timezone`
  daysOfWeek: number[];         // 0 = Sunday ... 6 = Saturday; empty = every day
  timezone: string;             // IANA name, e.g. "Asia/Kolkata"
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// A reminder occurrence that is due (or past due) today.
export interface DueReminder {
  reminder: Reminder;
  dueAt: string;                // ISO timestamp of today's occurrence
  occursOn: string;             // local date "YYYY-MM-DD" in the reminder's timezone
  acknowledged: boolean;        // marked done or dismissed for occursOn
}

export interface CreateReminderInput {
  kind: ReminderKind;
  title: string;
  routineId?: string | null;
  timeOfDay: string;
  daysOfWeek?: number[];
  timezone: string;
  isEnabled?: boolean;
}

export type UpdateReminderInput = Partial<Omit<CreateReminderInput, "kind">> & { isEnabled?: boolean };

// ----------------------------------------------------------------------------
// Wellness summary (Sprint 3). Counts only: no scores, labels or diagnostic
// wording. Journal content is never included, only how many entries exist;
// for a caregiver, a partial-tier child's private notes aren't counted.
// ----------------------------------------------------------------------------
export type WellnessPeriodDays = 7 | 30;

export interface WellnessSummary {
  periodDays: WellnessPeriodDays;
  from: string;                 // local date "YYYY-MM-DD" (inclusive)
  to: string;                   // local date "YYYY-MM-DD" (inclusive)
  mood: {
    checkins: number;
    daysWithCheckin: number;
    counts: Record<MoodValue, number>;
    latest: { mood: MoodValue; createdAt: string } | null;
  };
  routines: {
    scheduledSteps: number;     // step occurrences due in the period
    completedSteps: number;
  };
  journal: {
    entries: number;
  };
}

// Caregiver dashboard card for one child.
export interface ChildOverview {
  child: Child;
  summary: WellnessSummary;
  dueRemindersToday: number;
}
