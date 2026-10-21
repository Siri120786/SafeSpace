# Sprint 2 — Wellbeing Foundation (Siri: backend, security, integration)

Branch: `feature/sprint-2-wellbeing-foundation` (cut from `main` at `d79d4c7`, after PRs #3 and #4).

## 1. Mood check-in contract (for Manju)

The contract is defined once in `@safespace/shared-types`. UI code calls the
`@safespace/api-client` functions (web) or `MoodService` (Flutter) and never
touches the table directly.

### Types (`packages/shared-types/src/index.ts`)

| Name | Shape |
| --- | --- |
| `MOOD_VALUES` | `"ecstatic" \| "happy" \| "neutral" \| "sad" \| "stressed" \| "overwhelmed"` — same ids as the existing `MoodAvatars` icons |
| `MOOD_INTENSITY_MIN` / `MAX` | `1` / `5` (optional) |
| `MOOD_NOTE_MAX_LENGTH` | `500` (optional; blank notes are stored as `null`) |
| `MoodCheckin` | `{ id, profileId, childId, mood, intensity, note, isPrivateNote, createdAt }` |
| `CreateMoodCheckinInput` | `{ mood, intensity?, note?, isPrivateNote? }` |
| `ListMoodCheckinsOptions` | `{ limit? }` — default 30, max 100 |

### Web functions (`packages/api-client/src/mood.ts`)

| Function | Who | Notes |
| --- | --- | --- |
| `createMoodCheckin(session, input)` | adult or child session | Adults write under RLS; children go through the `mood-checkin` Edge Function. Throws `invalid_mood`, `invalid_intensity`, `note_too_long`, `private_note_not_allowed_for_privacy_tier`, `unsupported_session`. |
| `listMyMoodCheckins(session, options?)` | adult or child session | Own history, newest first. |
| `listChildMoodCheckins(childId, options?)` | caregiver | Their child's check-ins. RLS hides a partial-tier child's private notes. |

### Flutter (`apps/mobile/lib/features/mood/services/mood_service.dart`)

`createForProfile`, `listForProfile`, `createForChild`, `listForChild`, all
using the `MoodCheckin` model in `apps/mobile/lib/models/mood_checkin.dart`.
Not yet run through `flutter analyze` (no Flutter SDK on the integration
machine). Mobile child PIN login is still a placeholder, so the child methods
can't be exercised end to end on mobile yet.

### Privacy rules (enforced in Postgres, tested in `supabase/tests/mood.test.mts`)

- Adults read and create only their own check-ins. History is append-only
  (no update/delete).
- Linked caregivers (`caregiver_user_links`) see **none** of an adult user's
  mood check-ins, per `docs/caregiver-privacy-boundary.md`.
- A child's caregiver sees that child's check-ins under the same rule as
  journal entries: everything except a `partial`-tier child's private note.
- `isPrivateNote` is accepted only for children on the `partial` tier (a DB
  trigger enforces this).
- Children are identified by the signed child-session token only; the request
  body can't choose a `child_id` or `profile_id`.

## 2. Backend changes on this branch

| File | Change |
| --- | --- |
| `supabase/migrations/20261019120000_mood_checkins.sql` | `mood_checkins` table, constraints, private-note trigger, RLS, grants |
| `supabase/migrations/20261019120100_profiles_restrict_client_updates.sql` | **Security fix:** clients could update their own `profiles.role` (e.g. `user` → `caregiver`). UPDATE is now limited to `display_name` and `onboarding_state`. |
| `supabase/functions/mood-checkin/` + `_shared/moodCheckin.ts` | Child create/list endpoint and validator |
| `supabase/config.toml` | `mood-checkin` uses the child token, not a Supabase JWT |
| `supabase/tests/mood.test.mts` | 37 checks: isolation, privacy tiers, append-only, contract sync, role fix, validator |

## 3. Distress handling — decision needed

The sprint plan says mood distress handling "must follow the approved safety
policy". There is no approved policy in the repo yet, so **mood check-ins do
not score distress or trigger escalation**. The UI may show static,
non-clinical support text (e.g. "talk to a trusted adult"). Wiring check-ins
into escalation is part of the separate safety milestone.

## 4. Emergency pathway audit (read-only; nothing enabled)

`supabase/functions/emergency-escalation` is **not production-ready** and
must not be presented as a working alert:

1. `notifyCaregiver` only does `console.log`, but the function still sets
   `caregiver_notified_at`, so the log claims a caregiver was notified when
   nobody was. This field should stay null until real delivery exists.
2. The classifier is three English regexes. It misses other languages,
   paraphrases and indirect signals, and it doesn't distinguish quoted text.
3. The only crisis resource is a US text line, which is wrong for the
   Indian-language users this product targets.
4. Nothing calls it: there's no api-client function, and the journaling and
   `ai-orchestrator` paths are placeholders.
5. `triggered_by` isn't validated, `req.json()` isn't guarded, and there's no
   rate limit, so a valid child token can create unlimited events.
6. The caregiver UPDATE policy on `emergency_events` allows changing any
   column (`classifier_score`, `ai_alert_summary`), not just the review fields.

Recommended for the safety milestone: fix items 1, 5 and 6 first, then do the
delivery provider, region-correct helplines and clinician-reviewed rules.

## 5. Sprint 1 regression findings (not fixed on this branch)

- **Default child PIN:** `OnboardingPage.tsx` starts `childPin` at `"1234"` and
  falls back to `"1234"`; child-creation errors are swallowed with
  `console.warn`. Predictable PINs plus silent failure.
- **Family code not shown:** only the unrouted `CaregiverDashboardPage`
  displays it, so a caregiver can't find the code a child needs to log in.
- **Mobile child PIN:** `child_pin_screen.dart` doesn't call `verify-child-pin` yet.

## 6. Integration checklist (when Manju's and Thrisha's branches land)

- [ ] Mood UI uses only the functions above; no direct table access.
- [ ] Loading / error / empty / saved states map to the error codes in §1.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm web:build`, `flutter analyze` pass.
- [ ] Shared files (`App.tsx`, `BottomNav`, `DashboardPage`) are merged by Siri.
