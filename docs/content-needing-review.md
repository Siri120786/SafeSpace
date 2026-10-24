# Content needing review (Sprint 3)

Everything below is **placeholder or unreviewed wording** and must not be treated as clinical guidance. Rules for all of it: optional, gentle, non-clinical, never diagnose.

| Area | File | Content | Needs |
| --- | --- | --- | --- |
| Depression (Bright Days) | `apps/web/src/features/wellness-modules/lib/content.ts` | goal ideas, hobby suggestions, encouragement messages | clinical wording review |
| PTSD (Safe Harbor) | same | relaxation text steps, care-bridging text | clinician review; no trauma-treatment claims |
| PCOS/PCOD (Cycle Care) | same, plus `lib/cycleCare.ts`, `lib/dietPlan.ts`, `lib/healthAssessment.ts`, `lib/medicineReminders.ts` (web) and `cycle_care_extras.dart`, `diet_plan.dart`, `health_assessment.dart` (Flutter) | check-in wording, movement ideas, doctor-visit questions, general eating tips and meal ideas, the character's lines, health-profile options and summary wording, the PCOS myths and facts | clinician and dietitian review (medical accuracy); eating-disorder safety review of the diet, weight and rewards wording |
| Anxiety (Calm Space) | same | calming tips | wording review |
| Stories | `apps/web/src/features/story-workflow/lib/storyWorkflow.ts` | the automatic checks are a basic word list only | real content-safety validation, caregiver and clinician review |
| Support text in every module | same content file | "talk to a trusted adult or local services" | region-correct helplines and clinician review (see `docs/emergency-audit-sprint3.md`) |

## Limitations to state at sprint review
- Module screens and the story workflow **keep data only while the page is open**. Nothing is saved to the database yet, because that needs new tables and policies owned by Siri.
- Story approval is real in the screen's logic (only a caregiver can approve) but is not enforced by the database yet.
- PCOS/PCOD: **no cycle or period tracking**, pending privacy review (the health profile only asks how periods have been lately, it does not log them). Cycle Care also has a daily check-in, movement by energy level, a water tally, medicine notes, doctor-visit prep, a diet plan with rewards and a talking character, and an optional health profile with a private summary. The diet plan, rewards and health profile are kept **on the device only** (browser storage on web, shared_preferences on Flutter), never in the account. Check-ins, notes and the water tally are not saved. Rewards (stars and streaks) were chosen by the team and include a switch to hide them. Safeguards that stay: the character never shames and never mentions the body, the plan is written by the person (the app does not generate diets), and the app does not calculate BMI, set a target weight or interpret blood values. Tests check these. Medicine reminders use the shared Reminders feature with a generic title ("Time for your medicine"): in-app alerts only, web first. Flutter shows a note instead until a reminders service exists on mobile. Flutter's character is a drawn icon; the web one is the BrainMascot, and only web has a "Hear it" button (speech).
- No reminders are scheduled and no notifications are sent.
- Flutter versions of the story workflow and all four modules exist (`apps/mobile/lib/features/story_workflow/`, `wellness_modules/`) with the same not-saved limitation. They pass `flutter analyze` (no new issues) and `flutter test`, but have not been run on a real device or emulator.
