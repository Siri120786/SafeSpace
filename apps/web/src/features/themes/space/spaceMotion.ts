// The Space theme's motion, kept slow and soft. Nova's head turns only by
// scrubbing the head-turn clip (frame 0 looks left, the last frame right).
// No React here, so apps/web/tests/space-theme.test.mts can check it.

// Videos play at this speed when the person presses Play.
export const SPACE_PLAYBACK_RATE = 0.6;

// How far Nova's gaze moves toward the pointer per 60th of a second (gentle,
// so the head turns slowly rather than snapping).
export const HEAD_EASE = 0.06;
const FRAME_MS = 1000 / 60;

// After this long without the pointer moving, the gaze drifts on its own.
export const IDLE_MS = 3500;

// One slow look from side to side and back while idle.
export const DRIFT_PERIOD_MS = 16000;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Where the pointer is across the stage (0 = left edge, 1 = right edge),
// as a share of the clip: the middle 14%..86% of the stage covers it all.
export function headTarget(pointerShare: number): number {
  return clamp01((pointerShare - 0.14) / 0.72);
}

// The idle gaze: a slow sine around the middle, a quarter of the clip each way.
export function driftTarget(idleMs: number): number {
  return 0.5 + 0.25 * Math.sin((2 * Math.PI * idleMs) / DRIFT_PERIOD_MS);
}

// One eased step from the shown position toward the target (both 0..1),
// over elapsedMs, so the head turns at the same pace on slow screens.
export function easeToward(shown: number, target: number, elapsedMs = FRAME_MS, ease = HEAD_EASE): number {
  const k = 1 - Math.pow(1 - ease, Math.min(elapsedMs, 250) / FRAME_MS);
  const next = shown + (target - shown) * k;
  return Math.abs(target - next) < 0.0005 ? target : next;
}
