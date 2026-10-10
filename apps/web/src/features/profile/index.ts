/** SafeSpace Feature: Profile & Onboarding Foundation */
export const PROFILE_FEATURE_NAME = "profile";

export { OnboardingBasicInfoStep } from "./components/OnboardingBasicInfoStep";
export { OnboardingSupportPreferencesStep } from "./components/OnboardingSupportPreferencesStep";
export { OnboardingAccessibilityStep } from "./components/OnboardingAccessibilityStep";
export type { AccessibilityOptionsState } from "./components/OnboardingAccessibilityStep";
export { OnboardingReviewStep } from "./components/OnboardingReviewStep";

export { ProfileScreen } from "./components/ProfileScreen";
export { AccessibilityProvider, useAccessibility } from "./context/AccessibilityContext";
