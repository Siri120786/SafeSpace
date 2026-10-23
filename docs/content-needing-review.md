# Content needing review (Sprint 3)

Everything below is **placeholder or unreviewed wording** and must not be treated as clinical guidance. Rules for all of it: optional, gentle, non-clinical, never diagnose.

| Area | File | Content | Needs |
| --- | --- | --- | --- |
| Depression (Bright Days) | `apps/web/src/features/wellness-modules/lib/content.ts` | goal ideas, hobby suggestions, encouragement messages | clinical wording review |
| PTSD (Safe Harbor) | same | relaxation text steps, care-bridging text | clinician review; no trauma-treatment claims |
| PCOS/PCOD (Cycle Care) | same | movement, sleep and stress suggestions, and the PCOS myths and facts | clinician review (medical accuracy) |
| Anxiety (Calm Space) | same | calming tips | wording review |
| Stories | `apps/web/src/features/story-workflow/lib/storyWorkflow.ts` | the automatic checks are a basic word list only | real content-safety validation, caregiver and clinician review |
| Support text in every module | same content file | "talk to a trusted adult or local services" | region-correct helplines and clinician review (see `docs/emergency-audit-sprint3.md`) |

## Limitations to state at sprint review
- Module screens and the story workflow **keep data only while the page is open**. Nothing is saved to the database yet, because that needs new tables and policies owned by Siri.
- Story approval is real in the screen's logic (only a caregiver can approve) but is not enforced by the database yet.
- PCOS/PCOD: **no cycle tracking**, pending privacy review. The screen is shown only to adult `user` accounts, pending a decision on the adult-account path.
- No reminders are scheduled and no notifications are sent.
- Flutter versions of the story workflow and all four modules exist (`apps/mobile/lib/features/story_workflow/`, `wellness_modules/`) with the same not-saved limitation. They pass `flutter analyze` (no new issues) and `flutter test`, but have not been run on a real device or emulator.
