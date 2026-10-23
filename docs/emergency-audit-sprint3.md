# Emergency support audit (Sprint 3, Thrisha, read-only)

Status: **audit only. Nothing was enabled, changed or deployed.** It builds on the findings already listed in `docs/SPRINT_2_FOUNDATION.md` §4 and does not repeat them. Everything here needs Siri's review and, for crisis content, clinician review.

## What exists today
| Piece | Where | State |
| --- | --- | --- |
| `emergency_events` table + RLS | `0001_init_schema.sql` | Exists. Caregiver of the child can read and update. No privacy-tier condition on read (intended). |
| `emergency-escalation` Edge Function | `supabase/functions/emergency-escalation` | Exists, **not production-ready** (see Sprint 2 audit: fake "notified" timestamp, 3 regexes, US-only resource, nothing calls it). |
| `safety-check` Edge Function | `supabase/functions/safety-check` | Placeholder. |
| Crisis constants | `apps/web/src/features/safety/index.ts`, `apps/mobile/lib/features/safety/safety_feature.dart` | `988` and `HOME to 741741`. Both are **US services**. |

## New findings (not in the Sprint 2 audit)
1. **No emergency contacts or trusted contacts table exists.** The Sprint 3 plan lists "Emergency contacts and emergency-event history". There is nowhere to store contacts, so no alert could reach anyone even if a delivery provider existed. Needs a migration (Siri).
2. **Helpline constants are US-only and live in two places.** Web and Flutter each hard-code `988` and a US text line. Users here need region-correct, current helplines. Resources should come from one reviewed source, not two copies in code.
3. **No path for adult users.** `emergency_events` is keyed to `child_id` and the caregiver relationship. Adult accounts (`role = user`) and linked adults have no table, policy or function. Needs a decision.
4. **No emergency-event history screen anywhere.** Caregivers can read rows through RLS, but no web or Flutter screen or api-client function shows them.
5. **Linked caregivers are excluded from adult data** by design (`docs/caregiver-privacy-boundary.md`). Any adult emergency feature must keep that boundary explicit and get a privacy decision first.
6. **Module screens must never imply an alert was sent.** The Sprint 3 module screens added by this work show static, unreviewed support text only and say so on screen.

## Decisions needed before any real emergency feature
- Which delivery channel (push, SMS, email) and which provider.
- Who is notified, and what a caregiver sees (and for adult users: whether anyone is notified at all).
- Region-correct helplines, reviewed by a clinician and kept up to date.
- Escalation rules and wording, reviewed by a clinician.
- Rate limiting and abuse handling.

## What Thrisha's Sprint 3 work does about it
- Adds **no** code that sends or simulates an alert.
- Shows static support wording in module screens, marked "awaiting review" (see `docs/content-needing-review.md`).
- Leaves `emergency-escalation`, migrations and the safety constants untouched.
