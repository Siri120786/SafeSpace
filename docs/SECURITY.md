# SafeSpace — Security & Privacy Architecture

## 1. Safety Principles & Non-Clinical Scope

> **Mandatory Rule**: *"Screen, educate, and support — never diagnose."*

SafeSpace is an emotional and neurodivergent wellbeing support platform. It **does not** perform clinical medical diagnosis or prescribe medical interventions for Autism, ADHD, Anxiety, Depression, PTSD, or PCOS/PCOD.

### Safety Escalate & Alert Rule
When distress indicators pass safety threshold levels:
1. Automated classification triggers an emergency event.
2. An AI alert summary is generated and logged.
3. Caregivers are notified immediately.
4. Crisis resources (e.g., 988 Suicide & Crisis Lifeline, Crisis Text Line `741741`) are presented to the user.

---

## 2. Row Level Security (RLS) & Privacy Tiers

Privacy logic is enforced directly within the PostgreSQL database layer using RLS.

### Age-Tiered Privacy Rules
- **Full Tier (Ages 4–8)**: Caregiver has complete visibility into all activities and journals.
- **Partial Tier (Ages 9–12)**: Child can flag specific entries as `is_private_note = true`. Caregivers cannot view private notes via normal RLS queries.
- **Private Tier (Ages 13+)**: Scaffolded tier reserved for adolescent independence.

### Emergency Hard Override
If a journal entry or check-in triggers a distress classification, an entry in `emergency_events` is generated. The RLS policy for `emergency_events` contains **no privacy tier restriction**, ensuring caregivers can access safety alerts without delay.

---

## 3. Secret Protection & API Boundaries

- **Zero Secrets in Clients**: Client applications (Web React & Mobile Flutter) contain **only public anon keys** (`VITE_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY`).
- **Server-Side API Keys**: OpenAI, Gemini, Anthropic, and Qdrant API credentials are strictly stored in Supabase Edge Function secrets. Clients access AI operations exclusively through Edge Function proxies.
- **PIN Security**: Child PINs are converted to bcrypt hashes before storage in `children.pin_hash`. Verification is conducted entirely server-side via `supabase/functions/verify-child-pin`.
