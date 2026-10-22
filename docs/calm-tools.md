# Calm tools (Sprint 2)

Breathing exercise and 5-4-3-2-1 grounding, on web and Flutter. Text only: there is **no audio** anywhere.

## Where the code is
- Web: `apps/web/src/features/calm-tools/` (routes `/calm-tools`, `/calm-tools/breathing`, `/calm-tools/grounding`, all behind `ProtectedRoute`)
- Flutter: `apps/mobile/lib/features/calm_tools/` (same routes via go_router)
- Web tests: `apps/web/tests/calm-tools.test.mts` (runs in `pnpm test`)
- Flutter tests: `apps/mobile/test/calm_tools_test.dart`

## Behavior
- Breathing: inhale 4s, hold 4s, exhale 6s, 5 breaths (70s). Start / Pause / Resume / Reset. State is calculated from real elapsed time (not by counting ticks), so it does not drift.
- Grounding: 5 steps (see, feel, hear, smell, taste) with Back / Next / Done and Exit.
- Exit: every screen has an Exit button and the Escape key; both return to the dashboard.

## Low-sensory mode
One rule, `resolveLowSensory(os, saved)`: on if **either** the OS reduce-motion setting **or** the saved `reducedSensoryStimulation` preference is on.
- Web: `useLowSensory()` hook. Uses `AccessibilityContext` when it is filled; otherwise loads the preference with `getAccessibilityPreferences`. If loading fails a visible notice is shown and the OS setting still applies.
- Flutter: `watchLowSensory()` using `MediaQuery.disableAnimations` and `ProfileService.getAccessibilityPreferences`.
- When on: the breathing circle does not move (no transition), and the calmer flat background is used. Instructions stay as text.

## Not changed
`SessionPlayerModal` (the dashboard "Guided Calming Resets" player) is still a mock: its timer runs but the volume and "Sound" chips do nothing and there is no audio. It is left as-is and flagged for review.
