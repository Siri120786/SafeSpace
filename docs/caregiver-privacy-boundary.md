# Caregiver Privacy Boundary (Sprint 1)

A caregiver may only see a user they are ACTIVELY linked to
(`caregiver_user_links.status = 'active'`). Access is read-only and enforced
by Postgres RLS, not by application code.

## Caregiver CAN see
- Basic profile (name, onboarding status)
- Support preferences
- Accessibility preferences

## Caregiver CANNOT see (not yet)
- Private journal content
- Raw mood entries
- AI conversations
- Sensitive personal notes

## Caregiver CANNOT
- Modify a linked user's profile or preferences
- Create, edit or delete links (links are created by the service role only)
- See unrelated users, or users whose link is revoked

## Out of scope for Sprint 1
- Link creation/invite flow with user consent
- Caregiver edit permission ("unless explicitly permitted")
- Routine preferences (no stored data yet)
