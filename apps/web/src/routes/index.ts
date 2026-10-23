/** SafeSpace Web Routes Configuration (docs/role-flow/CONTRACT.md section 3). */
export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  ONBOARDING: "/onboarding",
  PROFILE: "/profile",

  // Individual
  DASHBOARD: "/dashboard",
  MOOD_CHECK_IN: "/mood/check-in",
  CALM_TOOLS: "/calm-tools",

  // Caregiver
  CAREGIVER_HOME: "/caregiver",
  CAREGIVER_ALERTS: "/caregiver/alerts",
  CAREGIVER_ADD_CHILD: "/caregiver/add-child",
  CAREGIVER_JOIN: "/caregiver/join",
  CAREGIVER_CHILD: "/caregiver/children/:childId",
  CAREGIVER_CHILD_ROUTINES: "/caregiver/children/:childId/routines",
  CAREGIVER_CHILD_REMINDERS: "/caregiver/children/:childId/reminders",
  CAREGIVER_CHILD_SETTINGS: "/caregiver/children/:childId/settings",
  CAREGIVER_CHILD_CAREGIVERS: "/caregiver/children/:childId/caregivers",

  // Child
  CHILD_PIN: "/child/pin",
  CHILD_HOME: "/child",
  CHILD_MOOD: "/child/mood",
  CHILD_CALM_TOOLS: "/child/calm-tools",
  CHILD_SETTINGS: "/child/settings",
  CHILD_ROUTINES: "/child/routines",
  CHILD_JOURNAL: "/child/journal",
  CHILD_REMINDERS: "/child/reminders",
  CHILD_COMPANION: "/child/companion",
  CHILD_MODULES: "/child/modules",
  CHILD_TALK: "/child/talk",
};
