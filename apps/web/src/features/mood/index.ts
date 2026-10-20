// apps/web/src/features/mood/index.ts
// Public surface of the web mood check-in feature.

export const MOOD_FEATURE_NAME = "mood";

// Components
export { MoodSelector } from "./components/MoodSelector";
export { IntensitySelector } from "./components/IntensitySelector";
export { MoodNoteInput } from "./components/MoodNoteInput";
export { MoodHistoryList } from "./components/MoodHistoryList";
export { MoodCheckInForm } from "./components/MoodCheckInForm";

// Page
export { MoodCheckInPage } from "./pages/MoodCheckInPage";

// Hook & Types
export { useMoodCheckIn } from "./hooks/useMoodCheckIn";
export type {
  UseMoodCheckInReturn,
  MoodCheckInStatus,
  MoodHistoryStatus,
} from "./hooks/useMoodCheckIn";

// Utilities
export {
  prepareMoodCheckInPayload,
  getFriendlyErrorMessage,
  formatCheckInTime,
} from "./utils/moodLogic";
