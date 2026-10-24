# Sprint 3 — Workstream B: UI, Accessibility & Neurodivergent Spaces
**Author:** Workstream B (UI, Accessibility, Autism "My Space", ADHD "Focus Zone")  
**Audience:** Siri (Workstream A — Backend, Database, Auth & Contracts)  
**Status:** Complete on Web (Device-Only Mode) — Ready for Contract & Backend Integration

> **Integration note (role-flow step 8, Siri):** this work is being brought into the app on
> `feat/conditions-tools` (8a–8f): the overlapping schedule, AAC board and themes blend into the
> existing routines, talk board and child themes; storage moves from the device to the database in
> steps. The dev preview harness below was removed in 8a: the tools get real routes instead.
> Sections 2–4 are kept as the original proposal; the integration follows
> `docs/role-flow/CONTRACT.md` (profile_id/child_id ownership, the age-15 sharing rule,
> child-session Edge Functions).

---

## 1. What Was Built & How to View It

All features are implemented on web as accessible, keyboard-operable, low-sensory modules respecting reduced-motion preferences, with 48px+ touch targets, visible focus rings, and zero autoplay audio.

| Feature Area | Folder / File Paths | Description |
| :--- | :--- | :--- |
| **Wellness UI Foundation** | `apps/web/src/features/wellness-ui/` | Accessible design primitives (`BigButton`, `WellnessCard`, `SoftBadge`, `ProgressBar`, `CountdownDisplay`, `EmptyState`, `ErrorState`, `LoadingState`, `DeviceOnlyNote`), `useReducedMotion` hook, and `LocalDeviceStore` browser persistence. |
| **Low-Sensory Styles** | `apps/web/src/features/wellness-ui/accessibility.css` | Self-contained styles defining `html.accessibility-reduced-stimulation`, `html.accessibility-larger-text`, and `html.accessibility-simplified` (`[data-decorative]`), imported via `wellness-ui/index.ts` to preserve zero-conflict boundaries (root `index.css` unchanged). |
| **Autism: Visual Schedule** | `apps/web/src/features/conditions/autism/components/VisualSchedule.tsx` | Step role tagging (`now`, `next`, `later`, `done`), completion toggling, "All Done" celebration, grown-up edit mode (add, reorder, remove, load sample morning routine). |
| **Autism: Emotion Cards** | `apps/web/src/features/conditions/autism/components/EmotionCards.tsx` | 10 accessible feeling cards with non-clinical reassurance prompts and a visual "I want to show a grown-up" indicator. |
| **Autism: Transition Countdown** | `apps/web/src/features/conditions/autism/components/TransitionCountdown.tsx` | Pure countdown state machine (`lib/countdown.ts`), text-first verbal display, shrinking progress, coarse aria-live announcements. |
| **Autism: AAC-Lite Board** | `apps/web/src/features/conditions/autism/components/AacBoard.tsx` | 20 categorized communication tiles (Needs, Social, Feelings, Actions), sentence strip, guarded user-initiated speech synthesis (`window.speechSynthesis`). |
| **Autism: Special-Interest Themes** | `apps/web/src/features/conditions/autism/components/SpecialInterestThemes.tsx` | 6 themes (`calm`, `space`, `animals`, `trains`, `nature`, `ocean`) scoping CSS variables to container. Unconditionally forces `calm` when low-sensory mode is active. |
| **Autism: Hub** | `apps/web/src/features/conditions/autism/components/AutismMySpace.tsx` | Unified container combining Feelings, Schedule, Transitions, and AAC. |
| **ADHD: Focus & Pomodoro Timers** | `apps/web/src/features/conditions/adhd/components/FocusTimer.tsx`, `PomodoroTimer.tsx` | Pure tick state machines (`lib/timerLogic.ts`), Date-based drift correction (`calculateRemainingFromDrift`), safe presets (5/10/15/25 min), stop without penalty, Pomodoro cycle with long break after 4 focus cycles, coarse aria-live announcements, visual end cues. |
| **ADHD: Focus Stats** | `apps/web/src/features/conditions/adhd/components/FocusStats.tsx` | Local aggregation of sessions and minutes today and this week, active streak, encouraging wording. |
| **ADHD: Task Breakdown** | `apps/web/src/features/conditions/adhd/components/TaskBreakdown.tsx` | Strictly user-controlled bite-sized task steps (add, edit, reorder up/down, remove, toggle). Code comment confirming zero AI generation and caregiver review requirement. |
| **ADHD: Daily Habits** | `apps/web/src/features/conditions/adhd/components/HabitTracker.tsx` | Gentle 7-day tracker with month-boundary calendar date math. Missed days are never styled as failures (no red, no streak-loss shaming). |
| **ADHD: Star Bank & Rewards** | `apps/web/src/features/conditions/adhd/components/RewardsProgress.tsx` | Idempotent star ledger (`lib/rewardLogic.ts`), custom goal progress, static calm celebration for reduced motion. |
| **ADHD: Hub** | `apps/web/src/features/conditions/adhd/components/AdhdFocusZone.tsx` | Integrated workspace tabbed across Timers, Step Breakdown, Daily Habits, and Star Bank. |
| **Dev Preview Test Harness** | *(removed in step 8a)* | Was a standalone page (`preview.html`) hosting the tools before they had routes. |

---

## 2. Proposed Persistence Contracts for Siri

> [!NOTE]
> These are suggestions for Siri's schema design and contracts, **not migrations**. No SQL or backend migration files have been created by Workstream B.

| Feature | Storage Today (Device Only) | Proposed Contract (Type Name + Fields + Operations) | Proposed Owner Column & Access Policy | RLS Notes | One-Line Swap Point File Path |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Visual Schedule** | `safespace.ws-b.autism.schedule` | `ScheduleStep`<br>• `id: string`<br>• `owner_id: string`<br>• `label: string`<br>• `icon: string`<br>• `is_complete: boolean`<br>• `order_index: number`<br>• `role?: string`<br>*Ops:* `listSteps`, `addStep`, `updateStep`, `reorder`, `removeStep`, `resetSamples` | Owner: `child_id` (UUID) or `user_id` (adult).<br>• Adult reads/writes own.<br>• Caregiver reads/writes assigned children.<br>• Child session reads/writes own steps. | Needs child-session token auth or Edge Function proxy since child sessions have no Supabase Auth JWT. | `apps/web/src/features/conditions/autism/services/index.ts` (`createScheduleService()`) |
| **Emotion Card Choices** | `safespace.ws-b.autism.emotion-taps` | `EmotionCardTap`<br>• `id: string`<br>• `owner_id: string`<br>• `card_id: string`<br>• `label: string`<br>• `timestamp: number`<br>• `shared_with_grownup: boolean`<br>*Ops:* `recordTap`, `listRecentTaps` | Owner: `child_id` or `user_id`.<br>• Adult reads own.<br>• Caregiver reads if shared with grownup (subject to privacy tier).<br>• Child writes append-only. | Append-only audit/check-in stream similar to `mood_checkins`. | `apps/web/src/features/conditions/autism/services/index.ts` (`createEmotionCardsService()`) |
| **AAC Custom Tiles** | `safespace.ws-b.autism.aac` | `AacConfig`<br>• `owner_id: string`<br>• `custom_labels: Record<string, string>`<br>• `updated_at: number`<br>*Ops:* `getConfig`, `setCustomLabel`, `reset` | Owner: `child_id` or `user_id`.<br>• Adult reads/writes own.<br>• Caregiver configures for child.<br>• Child session reads. | Read-mostly configuration; caregiver can customize tiles for child. | `apps/web/src/features/conditions/autism/services/index.ts` (`createAacService()`) |
| **Special-Interest Themes** | `safespace.ws-b.autism.theme` | `ThemePreference`<br>• `owner_id: string`<br>• `active_theme: "calm" \| "space" \| "animals" \| "trains" \| "nature" \| "ocean"`<br>*Ops:* `getTheme`, `setTheme` | Owner: `child_id` or `user_id`.<br>• Adult reads/writes own.<br>• Caregiver sets or child session selects. | Low-sensory override logic (`resolveActiveTheme`) runs client-side regardless of DB value. | `apps/web/src/features/conditions/autism/services/index.ts` (`createThemeService()`) |
| **Focus Stats** | `safespace.ws-b.adhd.stats` | `FocusSessionRecord`<br>• `id: string`<br>• `owner_id: string`<br>• `timestamp: number`<br>• `duration_seconds: number`<br>• `mode: "simple" \| "pomodoro"`<br>• `completed: boolean`<br>• `activity_label?: string`<br>*Ops:* `recordSession`, `listSessions`, `getSummary` | Owner: `user_id` or `child_id`.<br>• Adult reads/writes own.<br>• Caregiver views summary report.<br>• Child appends completed focus sessions. | Append-only logging. Aggregate summary (`sessionsToday`, `sessionsThisWeek`, `streakDays`) can be computed via RPC or client-side. | `apps/web/src/features/conditions/adhd/services/index.ts` (`createFocusStatsService()`) |
| **Task Breakdown** | `safespace.ws-b.adhd.tasks` | `TaskItem`<br>• `id: string`<br>• `owner_id: string`<br>• `title: string`<br>• `steps: TaskStep[]`<br>• `created_at: number`<br>*Ops:* `listTasks`, `createTask`, `updateTask`, `deleteTask` | Owner: `user_id` or `child_id`.<br>• User reads/writes own.<br>• Strictly user-controlled (no automated modification). | Separate from routine steps: tasks are individual user-managed breakdowns. | `apps/web/src/features/conditions/adhd/services/index.ts` (`createTaskService()`) |
| **Habits & Log** | `safespace.ws-b.adhd.habits` & `...habit-log` | `HabitItem` & `HabitLogEntry`<br>• `id: string`<br>• `owner_id: string`<br>• `title: string`<br>• `icon: string`<br>• `date_key: string` (YYYY-MM-DD)<br>• `completed: boolean`<br>*Ops:* `listHabits`, `addHabit`, `removeHabit`, `toggleDay`, `getLog` | Owner: `user_id` or `child_id`.<br>• User reads/writes own.<br>• Caregiver views gentle consistency view. | Unique constraint on `(habit_id, date_key)` for atomic upsert. Missed days have no negative DB flag. | `apps/web/src/features/conditions/adhd/services/index.ts` (`createHabitService()`) |
| **Rewards & Stars** | `safespace.ws-b.adhd.rewards` | `RewardLedger`<br>• `owner_id: string`<br>• `current_stars: number`<br>• `lifetime_stars: number`<br>• `goal: RewardGoal`<br>• `event_key: string` (unique)<br>*Ops:* `getState`, `awardStars` (idempotent), `setGoal`, `claimReward` | Owner: `user_id` or `child_id`.<br>• User reads/writes own.<br>• Caregiver can view or customize goals. | Unique constraint on `(owner_id, event_key)` guarantees idempotency so un-ticking and re-ticking never farms stars. | `apps/web/src/features/conditions/adhd/services/index.ts` (`createRewardService()`) |

---

## 3. The Blocked Item: Child Session Access to Routine Steps

### The Problem
Child sessions authenticate via an HMAC-signed child-session token issued by an Edge Function (stored in `localStorage` via `childSessionStorage.ts`), not via Supabase Auth JWT (`auth.users`). Consequently:
- Client-side Supabase client calls made from a child session fail PostgreSQL RLS checks (`auth.uid() is null`).
- Migration `0002` created `routine_steps` and `child_routines` tables guarded by RLS policies for `caregiver_id` and authenticated parents.
- Children currently have zero read or write access to `routine_steps`.

### Architecture Options for Siri (Without Choosing):
- **Option A (Edge Function Gateway — like `/mood-checkin`)**: Create an Edge Function (e.g. `/child-routine-steps`) that accepts the child-session token, verifies the cryptographic signature, extracts `child_id`, and queries/updates `routine_steps` using `SUPABASE_SERVICE_ROLE_KEY`.
- **Option B (PostgreSQL RPC / Session Claim)**: Provide a Postgres RPC that accepts a valid child session payload, verifies HMAC within Postgres or through an auth hook, sets `request.jwt.claim.child_id`, and allows scoped RLS policies on `routine_steps`.
- **Option C (Dedicated Child Space API)**: Build a consolidated Edge Function endpoint (e.g. `/child-space`) that returns the child's routine steps, emotion check-in log, AAC config, and theme preferences in a single authenticated round-trip.

---

## 4. Integration Snippets for Later (Unapplied)

> [!WARNING]
> Do NOT apply these snippets now. They are provided for Siri or future integration tasks when shared files are opened for routing.

### (a) Route Lines for `routes/index.ts` & `App.tsx`

**In `apps/web/src/routes/index.ts`:**
```typescript
export const ROUTES = {
  // ... existing routes
  AUTISM_MY_SPACE: "/conditions/autism",
  ADHD_FOCUS_ZONE: "/conditions/adhd",
};
```

**In `apps/web/src/App.tsx`:**
```tsx
import { AutismMySpace } from "./features/conditions/autism";
import { AdhdFocusZone } from "./features/conditions/adhd";

// Inside <Routes>:
<Route
  path="/conditions/autism"
  element={
    <ProtectedRoute>
      <AutismMySpace />
    </ProtectedRoute>
  }
/>
<Route
  path="/conditions/adhd"
  element={
    <ProtectedRoute>
      <AdhdFocusZone />
    </ProtectedRoute>
  }
/>
```

---

### (b) How `UserViewPage.tsx` Can Render Autism & ADHD Screens

In `apps/web/src/pages/UserViewPage.tsx`, replace the module placeholder around line 76 with the live condition components:

```tsx
import { AutismMySpace } from "../features/conditions/autism";
import { AdhdFocusZone } from "../features/conditions/adhd";

// Inside UserViewPage:
if (openModule === "autism") {
  return (
    <div className="min-h-screen bg-[#FAF7F2] p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex justify-between items-center">
          {child.assignedModules.length > 1 && (
            <button
              onClick={() => setOpenModule(null)}
              className="text-xs font-semibold text-botanical-700 hover:underline"
            >
              &larr; Choose a different space
            </button>
          )}
          <button onClick={handleLogOut} className="text-xs text-charcoal/60 hover:text-charcoal">
            Log out
          </button>
        </div>
        <AutismMySpace />
      </div>
    </div>
  );
}

if (openModule === "adhd") {
  return (
    <div className="min-h-screen bg-[#FAF7F2] p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex justify-between items-center">
          {child.assignedModules.length > 1 && (
            <button
              onClick={() => setOpenModule(null)}
              className="text-xs font-semibold text-botanical-700 hover:underline"
            >
              &larr; Choose a different space
            </button>
          )}
          <button onClick={handleLogOut} className="text-xs text-charcoal/60 hover:text-charcoal">
            Log out
          </button>
        </div>
        <AdhdFocusZone />
      </div>
    </div>
  );
}
```

---

### (c) Entry Links from `DashboardPage.tsx`

In `apps/web/src/pages/DashboardPage.tsx`, inside the Support Areas list or Recommended Tools section:

```tsx
// Inside DashboardPage support area render (near line 240):
{supportAreas.includes("autism") && (
  <Card hoverable onClick={() => navigate("/conditions/autism")} className="p-4 border-olive-200">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🌿</span>
        <div>
          <h4 className="font-display font-medium text-textHeading">My Space (Autism Support)</h4>
          <p className="text-xs text-textMuted">Visual schedule, calm themes, emotion cards & AAC</p>
        </div>
      </div>
      <span className="text-deepGreen font-bold">&rarr;</span>
    </div>
  </Card>
)}

{supportAreas.includes("adhd") && (
  <Card hoverable onClick={() => navigate("/conditions/adhd")} className="p-4 border-olive-200">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl">⚡</span>
        <div>
          <h4 className="font-display font-medium text-textHeading">Focus Zone (ADHD Support)</h4>
          <p className="text-xs text-textMuted">Focus timers, bite-sized tasks, daily habits & star rewards</p>
        </div>
      </div>
      <span className="text-deepGreen font-bold">&rarr;</span>
    </div>
  </Card>
)}
```

---

## 5. Existing Code Reused Rather Than Rebuilt

1. **`features/calm-tools/`**:
   - `resolveLowSensory` (`lib/lowSensory.ts`) and `useLowSensory` (`hooks/useLowSensory.ts`) were imported directly by `wellness-ui/useReducedMotion.ts` to ensure unified sensory preference resolution.
   - Low-sensory animation removal conventions were mirrored for timer progress bars and loading spinners.
2. **`features/profile/context/AccessibilityContext.tsx`**:
   - The CSS classes applied to `document.documentElement` (`accessibility-reduced-stimulation`, `accessibility-larger-text`, `accessibility-simplified`) were missing CSS definitions. Rather than modifying `apps/web/src/index.css` or touching `AccessibilityContext.tsx` (preserving strict zero-conflict boundaries), full accessible definitions were implemented in `apps/web/src/features/wellness-ui/accessibility.css` and loaded automatically via `wellness-ui/index.ts`. Neither `index.css` nor `AccessibilityContext.tsx` was modified.
3. **`features/mood/` & `MoodAvatars.tsx`**:
   - Neither `features/mood/` nor `MoodAvatars.tsx` was imported or reused. The mood check-in UI was developed on a separate Sprint 2 PR branch (`feature/sprint-2-mood-checkin`) and has not been merged into `main` or this branch. Emotion cards in Autism "My Space" are implemented independently with non-clinical visual representations and touch-friendly cards without creating any dependency on unmerged mood components.
4. **`packages/shared-types`**:
   - Existing types (`RoutineStep`, `MoodValue`) were imported in `autism/types.ts` to provide compatibility and shape adapters for future contract synchronization without modifying `packages/shared-types`.
5. **Tailwind Design System Tokens**:
   - Standard palette (`deepGreen`, `paleLime`, `olive`, `ivory`, `botanical`) from `apps/web/index.html` used throughout.

---

## 6. Content Needing Review (Non-Clinical Supportive Copy)

All wellness-sounding prompts are non-clinical, gentle, and marked in code with `// Content needing review: non-clinical supportive prompt`.

| File Path | Line Range | Text Content Needing Clinical / Content Review |
| :--- | :--- | :--- |
| `apps/web/src/features/conditions/autism/components/EmotionCards.tsx` | L18–19 | `"It feels wonderful to have a smiling heart today."` (Happy) |
| `apps/web/src/features/conditions/autism/components/EmotionCards.tsx` | L25–26 | `"Your body is peaceful and resting like a gentle leaf."` (Calm) |
| `apps/web/src/features/conditions/autism/components/EmotionCards.tsx` | L33–34 | `"So much sparkle and energy inside you today!"` (Very Joyful) |
| `apps/web/src/features/conditions/autism/components/EmotionCards.tsx` | L41–42 | `"It is completely okay to simply feel okay or in-between."` (In-Between) |
| `apps/web/src/features/conditions/autism/components/EmotionCards.tsx` | L49–50 | `"It's okay to feel sad. You don't have to rush your feelings."` (Sad) |
| `apps/web/src/features/conditions/autism/components/EmotionCards.tsx` | L56–57 | `"Rest is gentle and productive. Take all the quiet time you need."` (Tired) |
| `apps/web/src/features/conditions/autism/components/EmotionCards.tsx` | L64–65 | `"Things feel full right now. One slow, easy breath at a time."` (A Bit Full) |
| `apps/web/src/features/conditions/autism/components/EmotionCards.tsx` | L72–73 | `"When things feel too big, it is okay to pause and soften the room."` (Too Much Noise) |
| `apps/web/src/features/conditions/autism/components/EmotionCards.tsx` | L79–80 | `"You tried your best or did something kind, and that matters."` (Proud) |
| `apps/web/src/features/conditions/autism/components/EmotionCards.tsx` | L86–87 | `"Your wondering mind is ready to explore gently."` (Curious) |
| `apps/web/src/features/conditions/autism/components/EmotionCards.tsx` | L250–254 | `"You can show this screen to a parent, caregiver, or teacher and tell them how you feel. Take a gentle breath — you are never in trouble for sharing your feelings."` |
| `apps/web/src/features/conditions/autism/components/TransitionCountdown.tsx` | L199–202 | `"Take a quiet moment to finish what you are doing. You are ready."` |
| `apps/web/src/features/conditions/autism/components/VisualSchedule.tsx` | L208–211 | `"You completed every step in your routine. Take a peaceful breath and enjoy your day."` |
| `apps/web/src/features/conditions/adhd/components/AdhdFocusZone.tsx` | L95–98 | `"Flexible tools designed for how your mind works best. Take steady steps, celebrate small wins, and rest without guilt."` |
| `apps/web/src/features/conditions/adhd/components/FocusStats.tsx` | L49–51 | `"Every minute of calm attention is worth celebrating."` |
| `apps/web/src/features/conditions/adhd/components/FocusStats.tsx` | L106–109 | `"Take things one focus block at a time. Breaks are just as important as working sessions."` |
| `apps/web/src/features/conditions/adhd/components/FocusTimer.tsx` | L213–216 | `"You gave this time your attention. Rest your eyes, take a gentle breath, or stretch your arms."` |
| `apps/web/src/features/conditions/adhd/components/HabitTracker.tsx` | L246–249 | `"Habits grow through gentle consistency, not perfection. Every step forward counts."` |
| `apps/web/src/features/conditions/adhd/components/PomodoroTimer.tsx` | L320–325 | `"You did great focusing. Ready to step back and take a friendly rest?"` / `"Your break is finished. Ready to gently transition back to focus?"` |
| `apps/web/src/features/conditions/adhd/components/RewardsProgress.tsx` | L208–211 | `"You reached your {target}-star goal with steady effort. Enjoy your reward!"` |
| `apps/web/src/features/conditions/adhd/components/TaskBreakdown.tsx` | L426–429 | `"You broke down this challenge and completed each step. Take pride in your effort!"` |

---

## 7. Known Limitations

1. **Web Only**: All Sprint 3 Workstream B code is currently implemented in `apps/web`. No Flutter mobile widgets have been written yet; Flutter implementation will follow once mobile navigation contracts are established.
2. **Device-Only Storage**: All data is stored in the browser's `localStorage` (`LocalDeviceStore`). There is no cloud persistence, multi-device synchronization, or backup until Siri's backend contracts and Edge Functions are completed.
3. **No Cross-Device Child-Caregiver Sync**: Because child sessions lack direct DB access, a caregiver on another device cannot yet view the child's live schedule completion, emotion card taps, or habit check-offs.
4. **Idempotency is Local-Only**: The star reward ledger prevents farming within the current device's storage. Distributed multi-device idempotency will require a unique constraint in PostgreSQL.
