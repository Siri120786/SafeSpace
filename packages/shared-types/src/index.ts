// packages/shared-types/src/index.ts
// Single source of truth for domain types. apps/web and apps/mobile both
// import from here — never redeclare these shapes locally in either app.

export type UserRole = "caregiver" | "user";

export type OnboardingState = "pending" | "completed";

export const MODULE_KEYS = ["autism", "adhd", "anxiety", "depression", "ptsd", "pcos_pcod"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

/** @deprecated Role flow: replaced by ChildSharingStatus (age 15 rule). Kept only for legacy readers. */
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
  caregiverId: string;            // the primary caregiver
  name: string;
  birthYear: number;
  birthMonth: number;             // 1 to 12
  ageYears: number;               // calculated from birth month/year
  sharing: ChildSharingStatus;    // docs/role-flow/CONTRACT.md section 5
  theme: ChildTheme | null;
  lowSensoryDefault: boolean;
  assignedModules: ModuleKey[];
  myRole?: ChildCaregiverRole;    // caregiver views only: the caller's role
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
}

// ----------------------------------------------------------------------------
// Routines (Sprint 3). A routine is an ordered list of steps; completion is
// recorded per step per local calendar day, so progress and streaks persist.
// ----------------------------------------------------------------------------
// Icons a caregiver can give a routine step (role-flow 4c). Stored as the key;
// the apps draw the emoji. Must match the check in
// supabase/migrations/20261027300000_routine_step_icons.sql.
export const ROUTINE_STEP_ICONS = {
  wake: { emoji: "⏰", label: "Wake up" },
  toilet: { emoji: "🚽", label: "Toilet" },
  wash: { emoji: "🧼", label: "Wash" },
  brush_teeth: { emoji: "🪥", label: "Brush teeth" },
  dress: { emoji: "👕", label: "Get dressed" },
  breakfast: { emoji: "🥣", label: "Breakfast" },
  lunch: { emoji: "🥪", label: "Lunch" },
  dinner: { emoji: "🍝", label: "Dinner" },
  snack: { emoji: "🍎", label: "Snack" },
  water: { emoji: "💧", label: "Water" },
  medicine: { emoji: "💊", label: "Medicine" },
  school: { emoji: "🏫", label: "School" },
  homework: { emoji: "✏️", label: "Homework" },
  reading: { emoji: "📖", label: "Reading" },
  play: { emoji: "🧸", label: "Play" },
  outdoor: { emoji: "🌳", label: "Outside" },
  exercise: { emoji: "⚽", label: "Exercise" },
  music: { emoji: "🎵", label: "Music" },
  screen: { emoji: "📺", label: "Screen time" },
  tidy: { emoji: "🧺", label: "Tidy up" },
  bath: { emoji: "🛁", label: "Bath" },
  calm: { emoji: "🌿", label: "Calm time" },
  bed: { emoji: "🛏️", label: "Bed" },
} as const;

export type RoutineStepIcon = keyof typeof ROUTINE_STEP_ICONS;
export const ROUTINE_STEP_ICON_KEYS = Object.keys(ROUTINE_STEP_ICONS) as RoutineStepIcon[];

export interface RoutineStep {
  id: string;
  routineId: string;
  label: string;
  scheduledTime: string | null; // "HH:MM" (24h), optional
  orderIndex: number;
  icon: RoutineStepIcon | null; // optional (role-flow 4c)
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
  steps: { label: string; scheduledTime?: string | null; icon?: RoutineStepIcon | null }[];
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
export const REMINDER_LEAD_MAX_MINUTES = 120;

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
  leadMinutes: number;          // heads-up: due this many minutes before timeOfDay
  createdAt: string;
  updatedAt: string;
}

// A reminder occurrence that is due: today's from (time - heads-up) on, or
// tomorrow's when the heads-up crosses midnight.
export interface DueReminder {
  reminder: Reminder;
  dueAt: string;                // ISO timestamp it becomes due (occursAt minus the heads-up)
  occursAt: string;             // ISO timestamp of the occurrence itself
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
  leadMinutes?: number;         // 0 to 120, default 0
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

// Caregiver dashboard card for one child. When the young person has chosen not
// to share (activity.visible === false), summary and dueRemindersToday are null.
export interface ChildOverview {
  child: Child;
  activity: ActivityVisibility;
  summary: WellnessSummary | null;
  dueRemindersToday: number | null;
  unreviewedAlerts: number;       // never gated by the sharing choice
}

// ----------------------------------------------------------------------------
// Role-based flow (docs/role-flow/CONTRACT.md).
// ----------------------------------------------------------------------------

// The three roles as the app presents them. Profiles store "user" for an
// Individual; children have no profile.
export type AppRole = "individual" | "caregiver" | "child";

export const USER_ROLE_TO_APP_ROLE: Record<UserRole, Exclude<AppRole, "child">> = {
  user: "individual",
  caregiver: "caregiver",
};

// Where each role lands after signing in.
export const ROLE_HOME_ROUTES: Record<AppRole, string> = {
  individual: "/dashboard",
  caregiver: "/caregiver",
  child: "/child",
};

// Child accounts cover ages 4 to 17. From 15 the young person decides whether
// their caregiver sees their activity.
export const CHILD_MIN_AGE = 4;
export const CHILD_MAX_AGE = 17;
export const CAREGIVER_VISIBILITY_AGE = 15;

// Calculated from age and the stored choice, never stored directly:
//   under_15    caregiver sees activity
//   not_asked   15+, no choice yet: caregiver sees activity
//   shared      15+, chose to share
//   not_shared  15+, chose not to share: caregiver sees no activity
export type ChildSharingStatus = "under_15" | "not_asked" | "shared" | "not_shared";

export type ActivityVisibility =
  | { visible: true; reason: "under_15" | "not_asked" | "shared" }
  | { visible: false; reason: "not_shared" };

// Birth month precision is enough for the age rule; month is 1 to 12.
export interface CreateChildInput {
  name: string;
  birthYear: number;
  birthMonth: number;
  pin: string;              // exactly 4 digits; hashed server-side
  modules: ModuleKey[];
}

export interface UpdateChildInput {
  name?: string;
  birthYear?: number;
  birthMonth?: number;
}

// What a signed-in child can read about their own settings.
export interface ChildSettings {
  ageYears: number;
  sharing: ChildSharingStatus;
  canChangeSharing: boolean;      // true only at 15 or over
  sharingDecidedAt: string | null;
}

// Caregiver's detail page for one child. Each activity list is null when the
// young person has chosen not to share (activity.visible === false).
export interface CaregiverChildDetail {
  child: Child;
  ageYears: number;
  sharing: ChildSharingStatus;
  myRole: ChildCaregiverRole;
  unreviewedAlerts: number;
  activity: ActivityVisibility;
  periodDays: WellnessPeriodDays;
  summary: WellnessSummary | null;
  recentMoods: MoodCheckin[] | null;
  recentJournal: JournalEntry[] | null;
  aiConversations: AiCompanionConversation[] | null;
  routines: RoutineWithSteps[];   // set up by the caregiver: always visible
  reminders: Reminder[];          // set up by the caregiver: always visible
}

// Several caregivers per child. The creator is the primary; others join with a
// one-time invite code.
export type ChildCaregiverRole = "primary" | "co_caregiver";

export interface ChildCaregiver {
  caregiverId: string;
  displayName: string | null;
  role: ChildCaregiverRole;
  addedAt: string;
}

export const CAREGIVER_INVITE_CODE_LENGTH = 8;
export const CAREGIVER_INVITE_TTL_HOURS = 48;

export interface CaregiverInvite {
  code: string;
  childId: string;
  expiresAt: string;
}

// Child appearance and sensory defaults, set by a caregiver.
export const CHILD_THEMES = ["calm", "space", "ocean", "dinosaurs", "trains", "animals", "nature"] as const;
export type ChildTheme = (typeof CHILD_THEMES)[number];

// Talk board. Phrases are spoken on the device and not stored, except
// "I need help", which raises an alert to every caregiver of the child.
export const TALK_BOARD_PHRASES = [
  "I need a break",
  "Too loud",
  "I'm hungry",
  "Not right now",
  "Yes",
  "No",
  "I feel happy",
  "I need help",
] as const;
export type TalkBoardPhrase = (typeof TALK_BOARD_PHRASES)[number];
export const HELP_PHRASE: TalkBoardPhrase = "I need help";
export const HELP_ALERT_REPEAT_WINDOW_SECONDS = 120;

// An alert as caregivers see it (an emergency_events row). Always visible to
// every caregiver of the child, whatever the sharing choice.
export type AlertSource = "aac_tap" | "check_in" | "journal_flag";

export interface CaregiverAlert {
  id: string;
  childId: string;
  childName: string;
  source: AlertSource;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface ListAlertsOptions {
  unreviewedOnly?: boolean;
  limit?: number;
}

// Stories (only if the team confirms they're ours; docs/role-flow/CONTRACT.md D15).
export const STORY_TITLE_MAX_LENGTH = 80;
export const STORY_TEXT_MAX_LENGTH = 4000;

export interface Story {
  id: string;
  childId: string;
  title: string;
  text: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoryInput {
  title: string;
  text: string;
}
