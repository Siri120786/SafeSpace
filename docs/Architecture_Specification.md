# SafeSpace — System Architecture Specification

> **Stack update:** the product architecture below is unchanged, but the technology
> stack moved from Flutter + FastAPI + Firebase to React/React Native + Supabase,
> following the Shilp-AI approach. Where a section below names a *product* rule
> (privacy tiers, emergency flow, shared features) it still applies exactly; where it
> names a technology, the table in §1 is authoritative. See the repo README for how each
> rule is now enforced in code.

Reference diagram: `diagrams/00_master_architecture_reference.jpg`
Status: current design, improvements ongoing.

This document is the written companion to the architecture diagram — the diagram shows the shape, this explains the reasoning, so a new team member or mentor doesn't have to reverse-engineer *why* each box exists.

---

## 1. Layer overview

| Layer | Tech | Responsibility |
|---|---|---|
| Client layer | React + TypeScript (web), React Native / Expo (mobile), dual-role access | Renders screens only. Holds no business logic. Both clients share one API client package. |
| Application layer | Supabase: Auth + Postgres RLS + Edge Functions (Deno/TypeScript) | All business logic, security enforcement, data access. |
| Shared feature modules | Part of the application layer | Four reusable feature engines used by all six condition modules. |
| AI services | NLP, LLM, speech-to-text | Called only by shared features that need it. |
| Data & storage | Supabase Postgres (with Row Level Security) | Single source of truth for all persisted data. |

**Golden rule:** the client renders; the backend decides. Any business logic found living in the web or mobile app (which modules a user has, what privacy tier applies, whether low-sensory mode is on) is a bug, not a feature — it belongs in the Application layer.

---

## 2. Entry & session flow

1. **Home page opens** → checks device secure storage for an existing token. This is a local read only, no verification happens client-side.
2. Three outcomes:
   - **No token** → routed to Auth screen (sign up / log in).
   - **Token found** → validated by **Supabase Auth** (caregivers) or the **verify-child-pin** Edge Function (children).
   - Once validated, the Auth service decodes the **role claim** (caregiver vs. child) and tells the client which screen to render.
3. **Caregiver session** → goes straight to the Caregiver dashboard.
4. **Child session** → triggers a **PIN/pattern prompt** (deliberately not a password — see §6) → once verified, opens the User view.

### Auth flow (sign up / log in)
- **Sign up:** caregiver creates account (email + password via Supabase Auth) → adds a child profile (name, age, assigned condition module(s)) → sets a PIN/pattern for that child.
- **Log in:** credentials validated by Supabase Auth → session issued.
- Both paths converge on the same token format, so downstream logic (session check, role decoding, privacy filtering) doesn't need separate code paths for new vs. returning caregivers.

**Open question (unresolved):** the flow assumes the device already knows whether to expect a caregiver or child session before the PIN/password prompt appears. Whether that's a device-level setting or a profile picker shown first is not yet decided.

---

## 3. Caregiver dashboard

Two panes: **All-inputs view** (aggregated, read-only) and **Settings** (routine planning & alerts).

### Load sequence
1. Caregiver session confirmed (identity + account loaded)
2. Linked children checked — if more than one child is linked, a profile selector is shown
3. **Privacy tier applied** — filters what the caregiver is allowed to see, applied *before* the data fetch (see §6, this is a security-critical ordering decision, not a display-time filter)
4. Aggregated inputs fetched (default window: last 7 days — a reasonable default, not evidence-derived)
5. All-inputs view renders as the default landing tab; Settings loads on demand

### Age-tiered privacy model
| Age tier | Visibility |
|---|---|
| 4–8 | Fully visible to caregiver |
| 9–12 | Caregiver visible, child can attach a private note |
| 13+ (future scope, not yet built) | Private by default |

**Hard override (non-negotiable):** a genuine safety/distress signal always bypasses every privacy tier, regardless of the child's age. Privacy protects a user's narrative, never their safety.

---

## 4. User view (child-facing)

Also render-only, same as the Caregiver dashboard.

### Load sequence (after PIN/pattern verification)
1. Child profile session starts
2. Child profile loads with its assigned condition module(s)
3. **Module home / picker decision** — a pure length-check on the modules array:
   - 0 modules → **unresolved gap**, no fallback defined yet (see §7)
   - 1 module → opens that module's home directly, skipping the picker
   - 2+ modules → picker screen shown, one card per module (see mockup principle in §6)
4. Accessibility settings applied (low-sensory mode, theming) — read from the profile, not decided client-side
5. User view renders; passive distress-signal monitoring begins from this point onward (see §5)

---

## 5. Emergency escalation path

Five steps, all safety-critical, all logged:

1. **Distress signal detected** — from a check-in, an AAC tap, or a flagged journal entry. Multiple entry points, not one dedicated button.
2. **Safety classifier check** — rule-based + lightweight NLP. Deliberately *not* diagnostic. Its only job is "escalate or not," never "what's wrong with this person."
3. **Privacy override applied** — bypasses the age-tier privacy model unconditionally.
4. **AI-crafted alert + resources** — a short LLM-drafted summary goes to the caregiver, while the user is simultaneously shown crisis resources directly.
5. **Contact notified & logged** — notification is immediate; logging exists so the pathway can be audited and tested, not just trusted.

This is the one AI use case in the whole system with the least open-ended output — it drafts a structured summary from fixed inputs, not free-form content.

---

## 6. Shared feature modules

All six condition modules call the same four engines, rather than each rebuilding its own version:

| Feature | Calls AI services? | Calls Data & storage? |
|---|---|---|
| Journaling | Yes — STT + NLP | Yes — saves entries |
| Routines | **No** — data only | Yes — planner state |
| Stories | Yes — LLM generation | Yes — saves generated content |
| Emergency | Yes — drafts the alert | Yes — logs the event |

**Routines is the only feature that never touches AI.** If AI orchestration ever routes a Routines request toward AI services, that's a bug — a routine planner is pure CRUD (create/complete/reorder a step), nothing to generate or process.

### Design decisions worth remembering
- **PIN/pattern over password (child sessions):** lower literacy and fine-motor demands, faster low-friction re-entry (directly answers the "poor retention" gap from the digital-support literature), and a deliberately *lighter* security boundary — it protects "which profile," not the account itself, which is already secured by the caregiver's full login.
- **Module picker uses friendly names, not clinical labels** (e.g., "Calm space" not "Anxiety module") — avoids forcing a child to see their own diagnosis every time they open the app, and reduces accidental disclosure if someone else glances at the screen. This is a *proposed* pattern, not yet validated with real users.

---

## 7. Condition modules

| Module | Status | Core features (module-specific only — shared features excluded) |
|---|---|---|
| **Autism** | Full PRD + working prototype | Visual schedules, Routine planner, Emotion cards, Low sensory mode, Social stories, Reminders — plus 5 differentiators: Co-regulation, Interest theming, AAC-lite board, Transition timer, Co-design process |
| **ADHD** | Feature list only | Focus timer, Pomodoro, Task breakdown, Habit tracker, Reminders, Reward system |
| **Anxiety** | Feature list only | Breathing, Grounding (5-4-3-2-1), Guided meditation, Mood tracker |
| **Depression** | Feature list only | Daily check-ins, Small goals, Positive reinforcement, Hobby suggestions |
| **PTSD** | Feature list only | Grounding, Safe-space mode, Relaxation audio |
| **PCOS/PCOD** | Feature list only | Medication reminders, Water tracking, Gentle exercise, Sleep tracking, Stress management |

**Honest status:** Autism is the only module that has been through the full literature → requirement → prototype pipeline described in `03_Methodology/`. The other five are scoped at the feature-list level and have not yet been built or validated.

---

## 8. Known open questions / gaps to resolve

These are flagged, not solved, deliberately — they're the next design decisions, not oversights to hide:

1. **Zero-modules edge case** — no defined behavior if a child profile has no assigned condition module. Fix by either requiring at least one module at signup, or building an explicit empty-state screen.
2. **Device-level role detection** — the session flow assumes the app already knows "expect caregiver" vs. "expect child" before the PIN/password screen; how that's determined isn't specified.
3. **Multi-module picker scalability** — the proposed 2-button picker design works for 1–2 modules; untested for a child with 3+ assigned conditions.
4. **7-day default window** on the caregiver dashboard is a reasonable guess, not literature-derived.
5. **PCOS/PCOD body-image sensitivity** — habit/weight-adjacent tracking (water, exercise) needs deliberate design care given the literature's link between PCOS and elevated eating-disorder risk; not yet addressed in the feature list.
6. **AI orchestration routing** — undecided whether it conditionally skips AI services for Routines requests, or routes everything through by default.
7. **ADHD evaluation gap** — literature specifically warns about distinguishing immediate task completion from longer-term functional outcomes; current ADHD feature list is built entirely around short-term signals (streaks, points).


---

## 9. How the rules are enforced in the Supabase stack

| Architecture rule | Where it is enforced now |
|---|---|
| Client renders, backend decides | Both apps import only `@safespace/api-client`; no app code calls Postgres tables or `fetch` directly for business logic |
| Privacy tier applied *before* data is read (§3) | Postgres **Row Level Security** in `supabase/migrations/0001_init_schema.sql` (`journal_entries` policy) |
| Safety override bypasses every tier (§3, §5) | `emergency_events` RLS policy has **no** `privacy_tier` condition, by design |
| Routines never calls AI (§6) | `ai-orchestrator` allow-list omits `routines`; `routines` API functions use plain table access |
| PIN checked server-side only (§6) | `verify-child-pin` Edge Function; PIN stored PBKDF2-hashed; client never sees `pin_hash` |
| Child session scoped to one child | Signed HMAC token (`_shared/childToken.ts`), 8h expiry, verified by every child-facing function |
| Zero-modules edge case (§8 item 1) | Handled: both `UserView` screens render an explicit empty state |
| Device-level role detection (§8 item 2) | Resolved: role-choice screen, plus a one-time **family code** so a bare PIN can identify a child |

### New open questions introduced by this stack
1. **A 4-digit PIN is weak by nature** (10,000 combinations). Hashing does not fix that; rate-limiting (5 failures / 15 min / family) and the family code do the real work. Revisit before handling real user data.
2. **Web child-session storage uses `localStorage`**, which is not secure storage (mobile uses Keychain/Keystore). Acceptable for a prototype; decide before launch.
3. **Emergency notification is a stub** (`notifyCaregiver` logs only) and the safety classifier is a 3-pattern placeholder. Neither is fit for real children yet; both need clinical review.
4. **`ai-orchestrator`, `journaling-nlp`, `stories-generator` are placeholders** with no LLM/STT provider wired in.
5. **CORS is `*`** in `_shared/http.ts`; restrict to the deployed web origin before production.
6. **The `private` privacy tier (age 13+) currently hides nothing.** The RLS policy only restricts the `partial` tier; `create-child` still labels 13+ children `private`, so a caregiver can read a teenager's full journal. The spec marks 13+ as future scope, but the label is misleading. Decide the intended behavior (and add the policy) before onboarding anyone 13 or older.
