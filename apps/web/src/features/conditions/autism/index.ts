/**
 * SafeSpace Feature: Autism Spectrum Support ("My Space")
 * Foundation for visual emotions, calm routines, and predictable transitions.
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

// Services
export {
  LocalEmotionCardsService,
  createEmotionCardsService,
  LocalTransitionService,
  createTransitionService,
  DEFAULT_TRANSITION_CONFIG,
} from "./services";
export type { EmotionCardsService, TransitionService } from "./services";

// Components
export { EmotionCards, DEFAULT_EMOTION_CARDS } from "./components/EmotionCards";
export type { EmotionCardsProps } from "./components/EmotionCards";

export { TransitionCountdown } from "./components/TransitionCountdown";
export type { TransitionCountdownProps } from "./components/TransitionCountdown";

export { AutismMySpace } from "./components/AutismMySpace";
export type { AutismMySpaceProps } from "./components/AutismMySpace";
