# Sprint 3 — Shared Services Contracts (Siri, Workstream A)

**Status: draft v1, published for UI work. The types are final for this
sprint; the functions are planned and land feature by feature (see
"Implementation status").**

Manju and Thrisha can build screens now against the types in
`@safespace/shared-types`, using mock data shaped exactly like these
contracts. Swap the mocks for the real `@safespace/api-client` functions as
each one is marked **Implemented**.

## Decisions recorded

| Decision | Choice |
| --- | --- |
| Who can own routines, journals, reminders? | **Adults and children.** Same dual-identity pattern as mood check-ins. |
| Reminder delivery | **In-app only** this sprint. Schedules are stored, and the app shows what's due while it's open. No push, SMS or email. |
| Privacy tiers | **Unchanged.** A partial-tier child's private notes stay hidden from caregivers. The 13+ "private" tier is still an open project decision, so nothing new is hidden for it yet. |
| AI | None of these features call AI. Routines never do (architecture rule). |

## Rules that apply to everything

- **One owner per record:** `profileId` (adult) **or** `childId` (child),
  never both. The database enforces this.
- **Adults** use the tables directly under RLS. **Children** (no Supabase
  login) go through an Edge Function that verifies their signed child-session
  token. Clients never send an owner id; the server derives it.
- **Caregivers** read and manage their own children's records through RLS.
  They never see an adult user's journals, routines or reminders, even when
  linked (`docs/caregiver-privacy-boundary.md`).
- **Dates:** "local date" means `YYYY-MM-DD` in the user's own timezone,
  computed by the client. Times of day are `HH:MM` (24h).
- **No AI**, no diagnosis, and no clinical wording in any of these features.
- All functions take the current `AppSession` where the caller acts as
  themselves, and a `childId` where a caregiver acts for a child.

## Common errors

The api-client throws an `Error` whose `message` is one of these codes:

| Code | Meaning |
| --- | --- |
| `unsupported_session` | No session, or the session kind can't use this feature |
| `invalid_session` / `unauthorized` | Child token or login invalid or expired |
| `not_found` | The record doesn't exist **or** isn't yours (indistinguishable on purpose) |
| `invalid_input` | A field is missing, the wrong type, or out of range (details in the UI copy, not the code) |
| `content_too_long` | Over a documented length limit |
| `private_note_not_allowed_for_privacy_tier` | `isPrivateNote` sent for a non-partial-tier child, or by an adult |
| `rate_limited` | Too many writes in a short time |

---

## 1. Mood check-ins (already implemented, Sprint 2)

Types `MoodCheckin`, `CreateMoodCheckinInput`, `MOOD_VALUES`. **Implemented:**
- `createMoodCheckin(session, input)`
- `listMyMoodCheckins(session, { limit })`
- `listChildMoodCheckins(childId, { limit })`

Manju's UI (`feature/sprint-2-mood-checkin`) is built on these and will be
merged during Sprint 3 integration.

## 2. Journaling

Types: `JournalEntry`, `CreateJournalEntryInput`, `JOURNAL_ENTRY_TYPES`
(`"journal" | "gratitude"`), `JOURNAL_CONTENT_MAX_LENGTH` (5000).

| Function | Who | Notes |
| --- | --- | --- |
| `createJournalEntry(session, input)` | adult, child | `entryType` defaults to `"journal"`. Use `"gratitude"` for Bright Days. |
| `listMyJournalEntries(session, { limit?, entryType?, moduleKey? })` | adult, child | Newest first, default 30, max 100. |
| `deleteJournalEntry(session, id)` | adult | Children can't delete this sprint (caregiver oversight); open question. |
| `listChildJournalEntries(childId, { limit?, entryType? })` | caregiver | RLS hides a partial-tier child's private notes. |

**Privacy:**
- `isPrivateNote` is only valid for children on the `partial` tier. It's
  enforced in the database, as it already is for mood check-ins.
- Entries are never sent to AI.
- The old `ai-orchestrator` journaling placeholder is not used.

**Child Edge Function `journal`:**
- `create { content, entry_type?, module_key?, is_private_note? }`
- `list { limit?, entry_type? }`

## 3. Routines

Types:
- `Routine`, `RoutineStep`, `RoutineStepWithProgress`, `RoutineWithSteps`;
- `CreateRoutineInput`, `UpdateRoutineInput`.

A routine is a titled, ordered list of steps that runs on the given
`daysOfWeek` (empty means every day). **Completion is stored per step per
local date**, so "done today", history and streaks persist; completing a step
today doesn't affect tomorrow.

| Function | Who | Notes |
| --- | --- | --- |
| `listMyRoutines(session, { date })` | adult, child | Routines **scheduled on `date`**, with each step's `completedOnDate`. Inactive routines are excluded. |
| `setRoutineStepCompleted(session, stepId, date, completed)` | adult, child | `date` must be today or up to 6 days back (no future dates). Idempotent. |
| `createRoutine(target, input)` | adult (self), caregiver (for a child) | `target` is `{ kind: "self" }` or `{ kind: "child", childId }`. |
| `updateRoutine(routineId, input)` | owner adult, caregiver | Title, days, module, active. |
| `deleteRoutine(routineId)` | owner adult, caregiver | Deletes its steps and completion history. |
| `addRoutineStep(routineId, { label, scheduledTime? })` | owner adult, caregiver | Appended at the end. |
| `updateRoutineStep(stepId, { label?, scheduledTime? })` | owner adult, caregiver | |
| `reorderRoutineSteps(routineId, stepIds[])` | owner adult, caregiver | Must list every step exactly once. |
| `deleteRoutineStep(stepId)` | owner adult, caregiver | |
| `listChildRoutines(childId, { date })` | caregiver | Same shape as `listMyRoutines`. |

**Children can view and tick off steps but can't create or edit routines**:
their caregiver manages them, per the Sprint 3 rule that routines and task
breakdown stay user-controlled. Nothing changes a routine without a person
doing it.

**Child Edge Function `routines`:**
- `list { date }`
- `set_step_completed { step_id, date, completed }`

Existing `routine_steps` rows are kept. The migration groups them into one
routine per child and module, and the old `is_complete` column is no longer
used. `listRoutineSteps` and `markRoutineStepComplete` in `children.ts` are
superseded.

## 4. Reminders (in-app)

Types:
- `Reminder`, `DueReminder`;
- `CreateReminderInput`, `UpdateReminderInput`;
- `REMINDER_KINDS`: `"routine" | "water" | "medication" | "wellness" | "custom"`.

| Function | Who | Notes |
| --- | --- | --- |
| `listReminders(session)` | adult, child | All of the owner's reminders. |
| `getDueReminders(session, now?)` | adult, child | Occurrences due **today, up to `now`**, with `acknowledged`. |
| `acknowledgeReminder(session, reminderId, occursOn)` | adult, child | Marks today's occurrence done or dismissed. Idempotent. |
| `createReminder(target, input)` | adult (self), caregiver (for a child) | `timezone` is required (IANA, for example `Asia/Kolkata`). |
| `updateReminder(id, input)` / `deleteReminder(id)` | owner adult, caregiver | |
| `listChildReminders(childId)` | caregiver | |
| `getChildDueReminders(childId, now?)` | caregiver | Read-only due view for a child (feeds the overview). |
| `computeDueReminders(reminders, acknowledgements, now)` | any (pure function) | The exact due-time rule, exported so Flutter can mirror it and tests can pin it down. |

**Due rule:**
1. An occurrence exists on a local date (in the reminder's own `timezone`) if
   that weekday is in `daysOfWeek`, or `daysOfWeek` is empty.
2. The occurrence is due at `timeOfDay` on that date.
3. `getDueReminders` returns today's occurrences whose due time has passed.

The app polls this while open. **There are no background notifications this
sprint.**

**Privacy:**
- Keep medication reminder titles generic (for example "Evening tablet").
  The UI should not prompt for drug names.
- PCOS/PCOD use waits on the adult-account decision (Sprint 3 plan, section G).

**Child Edge Function `reminders`:**
- `list_due {}`: uses the server clock
- `list {}`
- `acknowledge { reminder_id, occurs_on }`

## 5. Wellness summary and caregiver overview

Types: `WellnessSummary`, `WellnessPeriodDays` (`7 | 30`), `ChildOverview`.

| Function | Who | Notes |
| --- | --- | --- |
| `getWellnessSummary(session, periodDays, { to?, timezone? })` | adult, child | Own data. `to` (local date) and `timezone` (IANA) default to the device's. |
| `getChildWellnessSummary(childId, periodDays, { to?, timezone? })` | caregiver | One child's summary. A partial-tier child's private notes are excluded by RLS. For a child that isn't theirs, the caregiver gets zeros, never data. |
| `getChildOverview(childId, periodDays)` | caregiver | `child`, `summary`, `dueRemindersToday` (due and not acknowledged). `not_found` if the child isn't theirs. |

**Counts only.** The summary includes mood counts by value, days with a
check-in, the latest mood, routine steps scheduled versus completed, and the
number of journal entries. It contains **no scores, labels, trends wording or
journal text**. UI copy must stay non-diagnostic, for example "You checked in
on 5 of the last 7 days", never anything like "signs of depression". For a
caregiver, a partial-tier child's private notes aren't counted.

**Child Edge Function `wellness-summary`:** `get { period_days, to, timezone }`

**How it's computed:** the `wellness_summary` database function runs with the caller's own RLS (SECURITY INVOKER).
- **Days** are local dates in the given timezone.
- **Routine counts** use each routine's current schedule and active flag; the schedule history isn't stored.

---

## Database row shapes (for Flutter and direct reads)

Rows are snake_case; the api-client maps them to the camelCase types above.

| Table | Columns |
| --- | --- |
| `journal_entries` | `id, profile_id, child_id, module_key, entry_type, content, is_private_note, created_at, updated_at` |
| `routines` | `id, profile_id, child_id, module_key, title, days_of_week (smallint[]), is_active, created_at, updated_at` |
| `routine_steps` | `id, routine_id, label, scheduled_time (time), order_index` |
| `routine_step_completions` | `step_id, completed_on (date), completed_at` (one row per step per date) |
| `reminders` | `id, profile_id, child_id, kind, title, routine_id, time_of_day (time), days_of_week (smallint[]), timezone, is_enabled, created_at, updated_at` |
| `reminder_acknowledgements` | `reminder_id, occurs_on (date), acknowledged_at` |

## Implementation status

| Area | Types | api-client | Child Edge Function | Migration and RLS tests |
| --- | --- | --- | --- | --- |
| Mood check-ins | Done | **Implemented** | **Implemented** | **Done** |
| Journaling | Done | **Implemented** | **Implemented** (`journal`) | **Done** (`20261024100000`) |
| Routines | Done | **Implemented** | **Implemented** (`routines`) | **Done** (`20261024000000`) |
| Reminders | Done | **Implemented** | **Implemented** (`reminders`) | **Done** (`20261024300000`) |
| Wellness summary | Done | **Implemented** | **Implemented** (`wellness-summary`) | **Done** (`20261024200000`) |
| Caregiver overview | Done | **Implemented** | n/a (caregivers use RLS) | Covered by the summary and reminders tests |

Planned order: routines, then journaling, then wellness summary, then
reminders, then caregiver dashboard and module navigation integration.

### Routines: implemented

- **Migration:** `supabase/migrations/20261024000000_routines.sql`.
- **api-client:** `packages/api-client/src/routines.ts`, exported from `@safespace/api-client`.
- **Child Edge Function:** `supabase/functions/routines`.
- **Tests:**
  - `supabase/tests/routines.test.mts` (database and RLS);
  - `supabase/tests/routines_handler.test.mts` (helpers and the child handler);
  - `pnpm test:local:routines` (end to end with the real api-client, local stack only).
- **Errors:** api-client errors are `ContractError` instances whose `message` is a code from "Common errors".
- **Superseded:** `listRoutineSteps` and `markRoutineStepComplete` have been removed from the api-client.

### Journaling: implemented

- **Migration:** `supabase/migrations/20261024100000_journal_entries.sql`. It extends the existing table:
  - adult owner (`profile_id`) and `entry_type`;
  - optional `module_key`, plus `updated_at`;
  - the private-note rule, now enforced in the database;
  - `anon` revoked.
  The caregiver privacy-tier policy from `0001` is unchanged.
- **api-client:** `packages/api-client/src/journal.ts`. The old `submitJournalEntry` placeholder (AI orchestrator, stores nothing) is marked deprecated.
- **Child Edge Function:** `supabase/functions/journal`.
- **Tests:**
  - `supabase/tests/journal.test.mts` (database and RLS, including legacy rows);
  - `supabase/tests/journal_handler.test.mts` (helpers, handler, parity with shared-types);
  - `pnpm test:local:journal` (end to end with the real api-client).
- **Shared types:** adds `MODULE_KEYS` (the module list as a value).

### Wellness summary: implemented

- **Migration:** `supabase/migrations/20261024200000_wellness_summary.sql` (`wellness_summary` function).
- **api-client:** `packages/api-client/src/wellness.ts`.
- **Child Edge Function:** `supabase/functions/wellness-summary`.
- **Tests:**
  - `supabase/tests/wellness_summary.test.mts` (exact counts, timezone boundary, caregiver privacy, isolation);
  - `supabase/tests/wellness_summary_handler.test.mts`;
  - `pnpm test:local:wellness` (end to end).

### Reminders and caregiver overview: implemented

- **Migration:** `supabase/migrations/20261024300000_reminders.sql`. A routine reminder must point at the same owner's routine, the timezone is validated, and acknowledgements are kept per local date.
- **api-client:** `packages/api-client/src/reminders.ts` and `overview.ts`.
- **Due rule:** `computeDueReminders` is identical in `supabase/functions/_shared/reminders.ts`, and a parity test checks it. **Flutter should mirror it.**
- **Child Edge Function:** `supabase/functions/reminders`.
- **Tests:**
  - `supabase/tests/reminders.test.mts` (database and RLS);
  - `supabase/tests/reminders_handler.test.mts` (due rule including DST and day boundaries, parity, handler);
  - `pnpm test:local:reminders` (end to end, including the overview).

### Caregiver family page (web): implemented

- **Route:** `/caregiver/dashboard` (`ROUTES.CAREGIVER_DASHBOARD`), caregivers only. Shows the family code, one `getChildOverview(childId, 7)` card per child, and add-child.
- **`addChild` errors:** failures now throw a `ContractError` carrying the `create-child` code: `invalid_request` (name, age 4 to 17, or 4-digit PIN) or `pin_already_used_in_family`.
- **Navigation:** the dashboard links to Mood Check-in, Calm Tools and (for caregivers) Family; a child's module screen links to the mood check-in page. Flutter isn't wired yet.
