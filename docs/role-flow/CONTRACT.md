# Role-based flow: contract

Status: **agreed contract, not built yet.** Step 1 of the role-flow build plan.
Types live in `packages/shared-types/src/index.ts` (section "Role-based flow").
Steps 2 to 7 implement this document; change the contract here first, then the code.
How it should behave follows the "Pathways" prototype recording (2026-10-23); its UI is not copied.

## 1. Decisions this contract encodes

| # | Decision |
| --- | --- |
| D1 | Three roles, each with its own sign-in and its own dashboard: **Individual**, **Caregiver**, **Child**. No shared-device mode switch or caregiver pattern lock. |
| D2 | Individuals and children get every wellbeing tool: mood check-ins, routines, journal, reminders, calm tools, AI Companion. |
| D3 | Caregivers get no personal tools. Their dashboard is their children's progress, alerts, and managing each child. |
| D4 | Caregivers set up a child's routines and reminders, assign modules, update details and reset the PIN. |
| D5 | A child's age comes from a **birth month and year** entered by a caregiver, so it updates on its own. |
| D6 | **Under 15:** everything the child records is visible to their caregivers. |
| D7 | **15 and over:** the young person chooses whether their caregivers see their activity. Until they answer, it stays shared. |
| D8 | Only the young person can change that choice. Caregivers see the choice but can't change it. |
| D9 | "Shared" means all activity; "not shared" means none (caregivers still see the child exists, their details, alerts, and what caregivers set up). |
| D10 | Emergency alerts always reach every caregiver of the child, whatever the sharing choice. |
| D11 | Children never sign up. A caregiver creates them; they sign in with the family code and a 4-digit PIN. |
| D12 | Turning 18 is out of scope. Child accounts cover ages 4 to 17. |
| D13 | Children get a **talk board**: tap a phrase to hear it spoken. Its **"I need help"** button raises an alert to their caregivers. |
| D14 | A child can have **several caregivers** (for example a co-parent or a therapist), each with their own caregiver account. |
| D15 | **Stories** (caregiver-written social stories, read aloud) are in scope only if Thrisha and Manju aren't building them in their own sprint work. Confirm before step 6. |
| D16 | Mood values stay as they are (6 moods). |

Adopted from the prototype (small, strike any you don't want):

| # | Behaviour |
| --- | --- |
| P1 | The child's Today screen shows **Now / Next** cards from the routine schedule. |
| P2 | Reminders can give a **heads-up N minutes before** a time ("Take a break, 5 min heads-up"). |
| P3 | Caregivers set the child's **special-interest theme** and whether child mode starts in **low-sensory** mode. |
| P4 | An unreviewed alert shows as a **red banner** on the caregiver home until a caregiver marks it reviewed. |

These replace the old privacy tiers (`full` 4–8, `partial` 9–12 with private notes, `private` 13+) and the prototype's caregiver-chosen age groups.
Private notes are removed for new entries (section 6).

## 2. Roles

| Role in the app | Stored as | Signs in with | Created by |
| --- | --- | --- | --- |
| Individual | `profiles.role = 'user'` | Email + password | Themselves (sign-up) |
| Caregiver | `profiles.role = 'caregiver'` | Email + password | Themselves (sign-up) |
| Child | a `children` row (no auth user) | Family code + 4-digit PIN | A caregiver |

The database value `user` stays; the UI calls it **Individual**. `AppRole` in shared-types maps the three.

## 3. Sign-in and routing (web)

### Entry

| Route | Shows |
| --- | --- |
| `/` | Landing page |
| `/login` | Three choices: Individual, Caregiver, Child |
| `/login?as=individual` / `/login?as=caregiver` | Email sign-in for that role |
| `/signup?as=individual` / `/signup?as=caregiver` | Sign-up with the role already chosen |
| `/child/pin` | Family code + PIN (the "Child" choice goes here) |

Signing in with the wrong role choice (for example a caregiver account through "Individual") still signs in, and the app sends the person to their real role's home with a short notice. The account's stored role always wins.

### Homes after sign-in

| Role | Home | Replaces |
| --- | --- | --- |
| Individual | `/dashboard` | the shared dashboard (individual only from now on) |
| Caregiver | `/caregiver` | `/caregiver/dashboard` (kept as a redirect) |
| Child | `/child` | `/child/dashboard` (kept as a redirect) |

`ROLE_HOME_ROUTES` in shared-types holds these three paths.

### Routes per role

Individual:
`/dashboard`, `/mood/check-in`, `/routines`, `/journal`, `/reminders`, `/calm-tools/*`, `/companion`, `/profile`.

Caregiver:

| Route | Shows |
| --- | --- |
| `/caregiver` | Home: alert banner, each child's progress card |
| `/caregiver/alerts` | All alerts, newest first; mark reviewed |
| `/caregiver/children/:childId` | Child detail: today at a glance, mood trends and log, routine completion, journal, AI chats (as sharing allows) |
| `/caregiver/children/:childId/routines` | Routine builder (steps with time, icon, title; days) |
| `/caregiver/children/:childId/reminders` | Reminders, including heads-up minutes |
| `/caregiver/children/:childId/stories` | Stories (only if D15 confirms) |
| `/caregiver/children/:childId/settings` | Name, birth month/year, modules, theme, low-sensory default, PIN reset |
| `/caregiver/children/:childId/caregivers` | Who cares for this child; invite or remove (primary caregiver only) |
| `/caregiver/add-child` | Add a child |
| `/caregiver/join` | Enter an invite code to become a child's caregiver |
| `/profile` | Caregiver's own account |

Child:

| Route | Shows |
| --- | --- |
| `/child` | Today: Now / Next cards, today's schedule to tick off, tiles for every tool |
| `/child/mood` | How am I feeling + recent check-ins |
| `/child/routines` | Full routines |
| `/child/journal` | Journal |
| `/child/reminders` | What's due |
| `/child/calm-tools/*` | Breathing and grounding |
| `/child/companion` | AI Companion |
| `/child/talk` | Talk board, including "I need help" |
| `/child/stories` | Stories (only if D15 confirms) |
| `/child/settings` | 15+: sharing choice |

Guards: each role's routes reject the other two. A rejected visitor goes to their own home; a signed-out visitor goes to `/login`. Calm tools exit back to the home of whoever is using them.

### Onboarding

- Individual: support areas and accessibility (unchanged).
- Caregiver: add the first child (name, birth month and year, PIN, modules), join a child with an invite code, or skip. There is no default PIN.
- Child: none.

## 4. Several caregivers per child

- New table `child_caregivers (child_id, caregiver_id, role, added_at)`, `role` is `primary` or `co_caregiver`. Each child has exactly one primary: the caregiver who created them, who is also `children.caregiver_id`.
- Every policy that checks `children.caregiver_id = auth.uid()` today (21 of them) changes to one helper, `is_caregiver_of(child_id)`, which is true for the primary and every co-caregiver.
- **Joining:** the primary creates a one-time **invite code** for a child (8 characters, valid 48 hours, single use). The other person signs in with their own caregiver account and enters it at `/caregiver/join`. No email lookups and no emails are sent.
- **What each can do:**

| Action | Primary | Co-caregiver |
| --- | --- | --- |
| See the child and their activity (as sharing allows), alerts | Yes | Yes |
| Routines, reminders, stories, modules, theme, low-sensory default | Yes | Yes |
| Mark alerts reviewed | Yes | Yes |
| Change name, birth month/year; reset PIN | Yes | No |
| Invite or remove caregivers | Yes | No |
| Leave a child | No | Yes |

- Removing a co-caregiver (or them leaving) ends their access immediately.
- The child keeps signing in with the **primary's family code**.
- The 15+ sharing choice applies to all caregivers alike.
- Linked adults (`caregiver_user_links`, caregiver ↔ Individual) are separate and unchanged.

## 5. Age and sharing

### Age

- Stored: `birth_year`, `birth_month` (1 to 12) on `children`, entered by the primary caregiver.
- Age in years is calculated by the database from the current date, treating the 1st of the birth month as the birthday. Month precision is enough for an age-15 rule and stores less personal data than a full date.
- Valid at creation and on update: the resulting age must be 4 to 17, and the month not in the future.
- `children.age` stops being written; it is replaced by the calculated value (`Child.ageYears`).

### Sharing status

`ChildSharingStatus` is calculated, never stored directly:

| Status | When | Caregivers see activity |
| --- | --- | --- |
| `under_15` | age < 15 | Yes |
| `not_asked` | age ≥ 15, no choice recorded | Yes |
| `shared` | age ≥ 15, chose to share | Yes |
| `not_shared` | age ≥ 15, chose not to share | No |

Stored: `children.shares_with_caregiver` (`true`, `false` or `null` = not asked) and `sharing_decided_at`.
The choice can only be recorded at 15 or over, and it stays in force until the young person changes it.
The rule lives in one database function, `caregiver_can_see_child_activity(child_id)` (true only for a caregiver of the child, and only when the status allows), used by every gated policy below.

### What the rule gates

Gated (visible to caregivers only when the status allows):

- mood check-ins
- journal entries
- routine step completions (what the child ticked)
- reminder acknowledgements
- AI Companion conversations and messages
- the wellness summary's counts (follows automatically, since it reads the tables above under the caregiver's access)

Never gated (always visible to the child's caregivers):

- the child's details: name, age, modules, theme, sharing status
- routines, reminders and stories (caregivers set them up)
- alerts (D10)

When activity is hidden, caregiver views show **"{name} has chosen not to share their activity"**, never an empty history that could be mistaken for no activity.

## 6. Private notes

- New entries can't be private: `isPrivateNote` is removed from mood and journal inputs. Sending `true` is rejected with `invalid_input`.
- Existing private notes stay hidden from caregivers permanently (the database keeps excluding them). The hosted project has none.

## 7. Talk board and alerts

- **Phrases** (`TALK_BOARD_PHRASES`): I need a break, Too loud, I'm hungry, Not right now, Yes, No, I feel happy, I need help. Spoken on the device with the browser's text-to-speech. Tapping a phrase is **not stored**, except "I need help".
- **"I need help"** creates an alert: an `emergency_events` row with `triggered_by = 'aac_tap'`, through a child Edge Function. A second tap within 2 minutes returns the same alert instead of creating another, and the child sees "Your grown-up has been told".
- **Who sees it:** every caregiver of the child, always (D10).
- **Where:**
  - a red banner on `/caregiver` while any alert is unreviewed (P4);
  - the list at `/caregiver/alerts`.
- **Mark reviewed:** any caregiver of the child can, which sets `reviewed_at` and `reviewed_by`.
- **In-app only.** Push, SMS or email notifications are out of scope until they are reviewed, as the Sprint 3 plan requires for real emergency notifications.
- The `emergency-escalation` placeholder function stays undeployed; this feature uses its own small function.

## 8. Stories (only if D15 confirms)

- Written by caregivers, for one child: title (1 to 80 characters) and text (1 to 4000).
- Children read them, with **Read aloud** (text-to-speech). The prototype's animated version is out of scope.
- New table `stories`. The existing `generated_stories` (designed for AI-generated stories) is left alone.
- Never gated by sharing (caregivers wrote them).

## 9. Caregiver actions (api-client)

All run as the signed-in caregiver; a child they aren't a caregiver of is `not_found`.

| Function | Does | Notes |
| --- | --- | --- |
| `addChild(input: CreateChildInput)` | Creates a child; the caller becomes primary | Changes from `age` to `birthYear` + `birthMonth`. Still only through the `create-child` function. |
| `listMyChildren()` | Every child the caller cares for | `Child` gains `birthYear`, `birthMonth`, `ageYears`, `sharing`, `myRole`, `theme`, `lowSensoryDefault`; loses `privacyTier`. |
| `getChildOverview(childId, periodDays)` | Progress card | `ChildOverview` gains `activity: ActivityVisibility` and `unreviewedAlerts`; `summary` is `null` when activity is hidden. |
| `getChildDetail(childId, periodDays)` | Detail page | New. `CaregiverChildDetail`. |
| `updateChild(childId, input: UpdateChildInput)` | Name, birth month/year (primary); theme, low-sensory default (any caregiver) | New. |
| `setChildModules(childId, modules)` | Replace the module list | New. Unknown keys are `invalid_input`. |
| `resetChildPin(childId, pin)` | New 4-digit PIN | New, primary only, through an Edge Function (hashing is server-side). Same family-uniqueness rule. Ends the child's current sessions. |
| `listChildCaregivers(childId)` | Who cares for the child | New. Names and roles only. |
| `createCaregiverInvite(childId)` | One-time invite code | New, primary only. |
| `acceptCaregiverInvite(code)` | Join as co-caregiver | New. |
| `removeChildCaregiver(childId, caregiverId)` | Remove a co-caregiver, or leave | New. Primary removes anyone else; a co-caregiver can remove only themselves. |
| `listAlerts(options?)` | Alerts for all the caller's children | New. Newest first; `unreviewedOnly` option. |
| `markAlertReviewed(alertId)` | Mark reviewed | New. |
| Routines | `createRoutine({kind:"child", childId}, …)`, `updateRoutine`, `deleteRoutine`, `addRoutineStep`, `updateRoutineStep`, `reorderRoutineSteps`, `deleteRoutineStep`, `listChildRoutines` | Already built (Sprint 3). |
| Reminders | `createReminder({kind:"child", childId}, …)`, `updateReminder`, `deleteReminder`, `listChildReminders` | Already built; gain `leadMinutes` (P2). |
| Stories | `listChildStories`, `createStory`, `updateStory`, `deleteStory` | New, only if D15 confirms. |

Deleting a child is not part of this contract (it is irreversible and needs its own decision).

## 10. Child actions (child session)

| Function | Does | Notes |
| --- | --- | --- |
| `getMyChildProfile(session)` | Name, modules, `ageYears`, `sharing`, `theme`, `lowSensoryDefault` | Existing; gains the new fields. |
| `getMyChildSettings(session)` | `ChildSettings` | New. |
| `setMySharing(session, share)` | Records the 15+ choice | New. `sharing_not_available_under_15` when under 15. |
| `raiseHelpAlert(session)` | "I need help" | New. Returns the alert id; repeats within 2 minutes return the same one. |
| `listMyStories(session)` | Stories to read | New, only if D15 confirms. |
| Mood, routines, journal, reminders, wellness | Existing child functions | Unchanged apart from private notes (section 6) and reminder heads-up (P2). |
| AI Companion | `sendAiCompanionMessage(session, …)` and friends | Already supports child sessions, with the same safety screen and rate limit. |

When a 15+ child with `not_asked` signs in, the child app shows the sharing question once, before the home screen. Answering is required to continue; it can be changed later in `/child/settings`.

## 11. Error codes added

| Code | When |
| --- | --- |
| `not_a_caregiver` | A signed-in non-caregiver calls a caregiver action (already used by `create-child`) |
| `not_primary_caregiver` | A co-caregiver tries a primary-only action |
| `invite_invalid` | Invite code unknown, used or expired |
| `already_caregiver` | Accepting an invite for a child you already care for |
| `sharing_not_available_under_15` | A child under 15 tries to set the sharing choice |
| `invalid_input` | Birth month/year out of range or giving an age outside 4–17; unknown module; `isPrivateNote: true`; text out of range |

Existing codes (`not_found`, `pin_already_used_in_family`, `unsupported_session`, `invalid_session`, `rate_limited`) keep their meaning.

## 12. Build order

| Step | Contents | Depends on |
| --- | --- | --- |
| 2 | Migrations and functions: several caregivers (`child_caregivers`, invites, `is_caregiver_of` in every policy); birth month/year and sharing (`caregiver_can_see_child_activity`); private-note removal; alerts (grants, child function, review); reminder heads-up; theme and low-sensory default; `update_child`, `set_child_modules`, PIN reset, child settings; tests under hosted defaults | 1 |
| 3 | Login with three choices, role homes and guards, onboarding without a default PIN | 1 (can run alongside 2) |
| 4 | Caregiver home and alert banner, alerts page, child detail, routine and reminder builders, child settings, caregivers page, join page | 2 |
| 5 | Child home with Now / Next, routes for every tool, talk board, 15+ sharing question and settings | 2 |
| 6 | Stories (only if D15 confirms) | 2 |
| 7 | Individual routines, journal and reminders screens | 1 |
| 8 | Flutter parity, reported separately | 3 to 7 |
