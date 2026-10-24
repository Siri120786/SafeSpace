# SafeSpace Wellness UI (`@safespace/web/src/features/wellness-ui`)

Warm, sensory-conscious presentational components, hooks, and local persistence tools designed for neurodivergent individuals, visual clarity, and accessible comfort.

---

## Design Principles

1. **Sensory Safety**: No autoplay sounds, respect for both OS `prefers-reduced-motion` and user profile comfort settings.
2. **Accessible Interaction**: Touch targets exceed 48×48px, high-contrast focus rings for keyboard navigation, clear ARIA labeling.
3. **Gentle, Non-Clinical Language**: Descriptive, comforting text rather than diagnostic or anxiety-inducing jargon.
4. **Graceful Simplification**: Purely decorative elements opt in via `data-decorative="true"` to disappear when simplified view is requested.
5. **Transparent Persistence**: Since Workstream B features lack backend cloud APIs initially, all data is stored on-device in `localStorage` with a visible [`DeviceOnlyNote`](#deviceonlynote). Never fake saving silently.

---

## Local Persistence & API Swap Pattern

### `LocalDeviceStore<T>`
Type-safe, crash-proof wrapper over `localStorage` with namespace prefix `"safespace.ws-b."`.
- Wraps every storage call in `try/catch` to safely handle quota limits, privacy blockers, or SSR.
- Supports runtime validator functions; corrupt or unreadable data automatically falls back to `defaultValue`.

```ts
import { createLocalDeviceStore } from "../wellness-ui";

interface RoutineData {
  steps: string[];
}

const routineStore = createLocalDeviceStore<RoutineData>("autism.routines");
const data = routineStore.get({ steps: [] });
routineStore.set({ steps: ["Deep breath", "Water plants"] });
```

### Architecture: How to Swap for a Real Backend API Later
Each condition feature defines a service interface and exposes a single factory function (e.g. `createAutismService()`).

```ts
// 1. Define interface:
export interface RoutineService {
  getRoutines(): Promise<RoutineStep[]>;
  saveRoutine(step: RoutineStep): Promise<void>;
}

// 2. Current Implementation (Local Store with visible note):
class LocalRoutineService implements RoutineService {
  private store = createLocalDeviceStore<RoutineStep[]>("autism.routines");
  async getRoutines() { return this.store.get([]); }
  async saveRoutine(step: RoutineStep) { /* ... */ }
}

// 3. One-line swap point (in feature's services/index.ts):
export function createRoutineService(): RoutineService {
  // When Siri's real API is ready, replace with: return new ApiRoutineService();
  return new LocalRoutineService();
}
```

---

## Components & Hooks

### `useReducedMotion`
Wraps the existing Calm Tools `useLowSensory` hook to provide unified reduced motion signals across both OS media queries and user comfort preferences. Falls back to OS media queries if rendered outside of `AuthProvider`.

- **Returns**: `{ reducedMotion: boolean, isLowSensory: boolean, preferenceError: string | null }`

---

### `DeviceOnlyNote`
Renders a gentle reminder that data is kept on the user's browser device rather than synced to the cloud.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `featureName` | `string` | — | Name of feature for customized context |
| `customExplanation` | `string` | — | Custom explanation paragraph |
| `compact` | `boolean` | `false` | Inline single-line pill style |

---

### `WellnessCard`
A calming card container with soft borders, rounded corners, accessible roles, and optional keyboard interaction.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | — | Card title heading |
| `subtitle` | `string` | — | Secondary subtitle |
| `badge` | `React.ReactNode` | — | Badge or category indicator |
| `action` | `React.ReactNode` | — | Top-level action element |
| `variant` | `"default" \| "subtle" \| "accent" \| "bordered"` | `"default"` | Card surface styling |
| `onClick` | `() => void` | — | Click handler (enables keyboard focus & Enter/Space triggering) |
| `dataDecorative` | `boolean` | `false` | When true, hides under `html.accessibility-simplified` |
| `role` | `string` | `"region"` or `"button"` | Accessible ARIA role |
| `ariaLabel` | `string` | — | Accessible screen reader label |

---

### `BigButton`
Accessible action button ensuring a generous **48px+** touch/click target for motor ease and visible keyboard focus outline.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `children` | `React.ReactNode` | **required** | Button label text or content |
| `onClick` | `(e) => void` | — | Click event callback |
| `variant` | `"primary" \| "secondary" \| "gentle" \| "ghost"` | `"primary"` | Button visual variant |
| `disabled` | `boolean` | `false` | Disabled state (marks `aria-disabled`) |
| `icon` | `React.ReactNode` | — | Leading icon or avatar |
| `fullWidth` | `boolean` | `false` | Expands to full container width |
| `ariaLabel` | `string` | — | Screen reader announcement |

---

### `SoftBadge`
Subtle, calming pill indicator for statuses, routine steps, or module categories.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `children` | `React.ReactNode` | **required** | Badge content |
| `variant` | `"default" \| "success" \| "warm" \| "info" \| "neutral"` | `"default"` | Semantic color scheme |
| `size` | `"sm" \| "md"` | `"sm"` | Text & padding size |
| `icon` | `React.ReactNode` | — | Prepended emoji or SVG icon |

---

### `ProgressBar`
Progress bar with ARIA attributes and **zero animation** when reduced motion is enabled.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `value` | `number` | **required** | Current progress value |
| `max` | `number` | `100` | Target maximum value |
| `label` | `string` | — | Text label and ARIA label |
| `showValue` | `boolean` | `false` | Displays visual percentage label |
| `variant` | `"olive" \| "deepGreen" \| "warm"` | `"olive"` | Fill color theme |
| `reducedMotion` | `boolean` | `useReducedMotion()` | Explicit override to disable fill transitions |

---

### `CountdownDisplay`
Timer component with a **text-first** presentation. Emphasizes readable digital numbers alongside a plain-language sentence describing remaining duration.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `secondsRemaining` | `number` | **required** | Seconds left in countdown |
| `totalSeconds` | `number` | — | Total duration in seconds |
| `label` | `string` | — | Label chip above the digits |
| `isPaused` | `boolean` | `false` | Adds verbal pause notice |
| `size` | `"sm" \| "md" \| "lg"` | `"lg"` | Numerical font scale |

---

### `EmptyState`
Gentle placeholder when a list, routine, or collection is empty.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | **required** | Reassuring heading |
| `description` | `string` | — | Contextual guidance |
| `icon` | `React.ReactNode` | — | Decorative visual indicator |
| `action` | `{ label: string, onClick: () => void }` | — | Primary action button |

---

### `ErrorState`
Calming, non-clinical error notice with an immediate retry button.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `message` | `string` | **required** | Reassuring explanation of what happened |
| `title` | `string` | `"Take a moment"` | Non-clinical heading |
| `onRetry` | `() => void` | — | Callback when user chooses to try again |
| `retryLabel` | `string` | `"Try again"` | Label on retry button |

---

### `LoadingState`
Peaceful loading screen or block that replaces spinning animations with a static icon when reduced motion is active.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `message` | `string` | `"Taking a quiet moment to prepare..."` | Status message |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Spinner / icon size |
| `fullScreen` | `boolean` | `false` | Fills the entire screen |
| `reducedMotion` | `boolean` | `useReducedMotion()` | Overrides motion behavior |
