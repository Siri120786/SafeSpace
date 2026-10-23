// packages/api-client/src/index.ts
// Public surface of the shared API layer. apps/web and apps/mobile import
// ONLY from "@safespace/api-client" — never reach into supabaseClient.ts,
// auth.ts, or children.ts directly, so this file is the enforced boundary.

export { initSafeSpaceClient, getSafeSpaceClient } from "./supabaseClient";
export type { SafeSpaceClientConfig } from "./supabaseClient";

export {
  signUpUser,
  signUpCaregiver,
  logInUser,
  logInCaregiver,
  resetPasswordForEmail,
  updatePassword,
  getUserProfile,
  getExistingSession,
  onAuthStateChange,
  verifyChildPin,
  logOut,
} from "./auth";

export {
  listMyChildren,
  getMyFamilyCode,
  addChild,
  updateChild,
  setChildModules,
  resetChildPin,
  getMyChildProfile,
  submitJournalEntry,
  generateStory,
} from "./children";

export {
  getSupportPreferences,
  saveSupportPreferences,
  getAccessibilityPreferences,
  saveAccessibilityPreferences,
  completeOnboarding,
  updateUserProfile,
} from "./profile";

export type {
  SaveSupportPreferencesInput,
  SaveAccessibilityPreferencesInput,
} from "./profile";
export { listLinkedUsers, getLinkedUserProfile } from "./caregiver";

export {
  createMoodCheckin,
  listMyMoodCheckins,
  listChildMoodCheckins,
} from "./mood";

export {
  listMyRoutines,
  setRoutineStepCompleted,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  addRoutineStep,
  updateRoutineStep,
  reorderRoutineSteps,
  deleteRoutineStep,
  listChildRoutines,
  listChildRoutineSetup,
  listMyRoutineSetup,
  isRoutineScheduledOn,
} from "./routines";
export type { RoutineTarget } from "./routines";
export { ContractError } from "./edge";

export {
  createJournalEntry,
  listMyJournalEntries,
  deleteJournalEntry,
  listChildJournalEntries,
} from "./journal";
export type { ListJournalOptions } from "./journal";

export { getWellnessSummary, getChildWellnessSummary } from "./wellness";
export type { WellnessOptions } from "./wellness";

export {
  listReminders,
  getDueReminders,
  acknowledgeReminder,
  createReminder,
  updateReminder,
  deleteReminder,
  listChildReminders,
  getChildDueReminders,
  computeDueReminders,
  isValidTimeZone,
} from "./reminders";
export { getChildOverview } from "./overview";
export { getChildDetail, listChildAiConversations, getChildAiMessages } from "./childDetail";
export { getMyChildSettings, setMySharing } from "./childSettings";
export { listAlerts, markAlertReviewed, raiseHelpAlert } from "./alerts";
export { childAgeYears, childSharingStatus, isValidChildBirth, activityVisibility } from "./childSharing";

export {
  listChildCaregivers,
  createCaregiverInvite,
  acceptCaregiverInvite,
  removeChildCaregiver,
  getChildFamilyCode,
  normaliseInviteCode,
} from "./childCaregivers";

export {
  sendAiCompanionMessage,
  listAiCompanionConversations,
  getAiCompanionMessages,
} from "./aiCompanion";
