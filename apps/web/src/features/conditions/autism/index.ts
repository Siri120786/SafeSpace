/**
 * SafeSpace Feature: Autism Spectrum Support ("My Space")
 * Foundation for visual emotions, calm routines, predictable transitions, AAC, and sensory theming.
 */

export const AUTISM_MODULE_KEY = "autism";
export const AUTISM_DISPLAY_NAME = "My Space";

// Types
export * from "./types";

// Countdown Pure State Machine
export {
  initCountdown,
  startCountdown,
  pauseCountdown,
  resumeCountdown,
  resetCountdown,
  tickCountdown,
  getShrinkingProgress,
  getCoarseAnnouncement,
  getCountdownSnapshot,
} from "./lib/countdown";
export type { CountdownState } from "./lib/countdown";

// RoutineStep Adapter
export { toScheduleStep } from "./types";

// Services
export {
  LocalEmotionCardsService,
  createEmotionCardsService,
  LocalTransitionService,
  createTransitionService,
  DEFAULT_TRANSITION_CONFIG,
  LocalScheduleService,
  createScheduleService,
  DEFAULT_SAMPLE_STEPS,
  LocalAacService,
  createAacService,
  DEFAULT_AAC_TILES,
  LocalThemeService,
  createThemeService,
  THEME_DEFINITIONS,
  resolveActiveTheme,
} from "./services";
export type {
  EmotionCardsService,
  TransitionService,
  ScheduleService,
  AacService,
  ThemeService,
} from "./services";

// Components
export { EmotionCards, DEFAULT_EMOTION_CARDS } from "./components/EmotionCards";
export type { EmotionCardsProps } from "./components/EmotionCards";

export { TransitionCountdown } from "./components/TransitionCountdown";
export type { TransitionCountdownProps } from "./components/TransitionCountdown";

export { VisualSchedule } from "./components/VisualSchedule";
export type { VisualScheduleProps, ScheduleSource } from "./components/VisualSchedule";

export { AacBoard } from "./components/AacBoard";
export type { AacBoardProps } from "./components/AacBoard";

export { SpecialInterestThemes } from "./components/SpecialInterestThemes";
export type { SpecialInterestThemesProps } from "./components/SpecialInterestThemes";

export { AutismMySpace } from "./components/AutismMySpace";
export type { AutismMySpaceProps } from "./components/AutismMySpace";
