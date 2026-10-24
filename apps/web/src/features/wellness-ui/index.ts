/**
 * SafeSpace Wellness UI Component Library (Workstream B - Sprint 3)
 * Accessible, gentle, sensory-aware presentational components, hooks, and device storage.
 */

// In browser/Vite runtime, dynamically import accessibility CSS rules.
// Wrapped so Node.js test runners (tsx) do not throw ERR_UNKNOWN_FILE_EXTENSION.
if (typeof window !== "undefined") {
  import("./accessibility.css");
}

export { useReducedMotion, resolveLowSensory } from "./useReducedMotion";
export type { ReducedMotionResult } from "./useReducedMotion";

export { WellnessCard } from "./WellnessCard";
export type { WellnessCardProps } from "./WellnessCard";

export { BigButton } from "./BigButton";
export type { BigButtonProps } from "./BigButton";

export { SoftBadge } from "./SoftBadge";
export type { SoftBadgeProps } from "./SoftBadge";

export { ProgressBar } from "./ProgressBar";
export type { ProgressBarProps } from "./ProgressBar";

export { CountdownDisplay, formatTimeDigits, formatVerbalTime } from "./CountdownDisplay";
export type { CountdownDisplayProps } from "./CountdownDisplay";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { ErrorState } from "./ErrorState";
export type { ErrorStateProps } from "./ErrorState";

export { LoadingState } from "./LoadingState";
export type { LoadingStateProps } from "./LoadingState";

export { DeviceOnlyNote } from "./DeviceOnlyNote";
export type { DeviceOnlyNoteProps } from "./DeviceOnlyNote";

export {
  LocalDeviceStore,
  createLocalDeviceStore,
  STORAGE_PREFIX,
  setDeviceStoreOwner,
  getDeviceStoreOwner,
  clearDeviceStore,
} from "./store/LocalDeviceStore";
export type { StorageOptions } from "./store/LocalDeviceStore";
