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
  getMyChildProfile,
  submitJournalEntry,
  generateStory,
  listRoutineSteps,
  markRoutineStepComplete,
} from "./children";

export {
  getSupportPreferences,
  saveSupportPreferences,
  getAccessibilityPreferences,
  saveAccessibilityPreferences,
  completeOnboarding,
} from "./profile";

export type {
  SaveSupportPreferencesInput,
  SaveAccessibilityPreferencesInput,
} from "./profile";
