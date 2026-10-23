# AI Companion (V1 beta)

Adult-only in the web UI for now (Dashboard → AI Companion tab). The Edge
Function also accepts child-session tokens, but no child screen exposes the
chat yet; see open decisions below.

## How it works

- **Client:** `packages/api-client/src/aiCompanion.ts` → `ai-companion` Edge Function.
  The Supabase client attaches the current access token (it refreshes hourly);
  children send their signed session token in the body.
- **Edge Function** (`supabase/functions/ai-companion`): rejects malformed
  requests (400/401/413), verifies identity, checks conversation ownership,
  runs the crisis screen, takes a rate-limit slot (non-crisis messages only),
  calls Gemini, then stores both messages.
  - If the model isn't configured or fails, **nothing is stored** and the client
    gets `ai_unavailable` (no fake replies).
  - Errors returned to clients are fixed codes; details only go to function logs.
- **Database** (`20261020000000_ai_companion_conversations.sql`): clients have
  **read-only** access under RLS; only the Edge Function writes. Users can't
  insert "assistant" messages or edit history.
- **Model:** `GEMINI_API_KEY` (required) and `GEMINI_MODEL` (optional, default
  `gemini-3.5-flash-lite`) in `supabase/.env.local` or `supabase secrets set`.
  The key is sent in the `x-goog-api-key` header, never the URL.
  - `gemini-2.5-flash` returns 404 for new keys ("no longer available to new
    users").
  - In testing (Oct 2026), the 3.x `flash` models used most of the 600-token
    output budget on hidden thinking and were overloaded (timeouts or 503).
  - `flash-lite` replied in about 1–2 s with no thinking overhead.
  - Re-check model availability before release; Google retires models
    regularly.

## Crisis screen

`screenForCrisis` in `supabase/functions/_shared/aiCompanion.ts` matches a short
list of English and Hindi (Devanagari) self-harm phrases. A match skips the
model and returns a fixed message: reach out to a trusted person, call 112 in
an emergency, Tele-MANAS 14416 for free support. The exchange is stored with
`is_safety_response = true` and highlighted in the UI.

It does **not** create an emergency event or notify a caregiver; that waits for
the separate, approved safety milestone (docs/SPRINT_2_FOUNDATION.md §4).

**Known gaps (need team and clinician review before real users):**
- Telugu, Tamil, Kannada, Marathi, Bengali and Urdu phrases aren't screened; for
  those languages the model's own instructions are the only safeguard.
- The safety message has reviewed text in English and Hindi only; other
  languages show the English version.
- Verify the helpline numbers (112, Tele-MANAS 14416) before release.

## Rate limit

- **10 model attempts per identity per rolling 60 seconds** (adults by profile,
  children by child id; each identity has its own counter).
- Enforced by `ai_companion_take_slot` (migration `20261021000000`): it
  atomically counts and records the attempt under a per-identity lock, so
  concurrent requests can't exceed the limit. It's executable by the service
  role only.
- The slot is taken **before** Gemini is called, so attempts that fail or are
  blocked by the model still count.
- **Crisis-screen matches are exempt**: the fixed safety reply never calls the
  model and is always delivered. (The screen is narrow, not a complete or
  multilingual detector; see above.) Side effect: crisis-pattern messages are
  not rate-limited, so they could be used to add stored messages without limit.
- **Fails closed**: if the slot can't be taken (database error), the request is
  refused with `503 rate_limit_unavailable`.

### Attempt log retention

`ai_companion_attempts` stores only the owner id and a timestamp (no content).
Only the last 60 seconds matter for the limit.

- **Proposed retention: 24 hours.**
- **Follow-up (not implemented):** a scheduled cleanup, e.g. a `pg_cron` job
  running `delete from public.ai_companion_attempts where attempted_at < now() - interval '24 hours';`.
  Until it exists, the table grows by one small row per model attempt.

## Open decisions

1. **Children:** should children get the chat at all, and with what caregiver
   approval? (The Sprint 2 plan defers this to the AI milestone.)
2. **Caregiver visibility:** a child's caregiver can currently read all of that
   child's AI conversations. Should the `partial` tier (ages 9–12) hide some,
   as it does for private journal notes?

## Tests

- `supabase/tests/ai_companion.test.mts` (part of `pnpm test`, in-memory
  PGlite): RLS isolation, the read-only guarantee, caregiver and
  linked-caregiver boundaries, schema constraints, the crisis screen, request
  validation, the Gemini request shape, and `ai_companion_take_slot` (limit
  boundary, window, identity isolation, owner rules, role privileges).
- `supabase/tests/ai_companion_handler.test.mts` (part of `pnpm test`): runs the
  real request handler (`supabase/functions/ai-companion/handler.ts`) with an
  in-memory store, a fake auth check and a fake model; child tokens use the
  real verifier. Covers CORS, malformed input, adult and child authentication,
  ownership, rate limiting (including fail-closed and the crisis exemption),
  model failures, store failures, and content-free logging. `index.ts` only
  wires in the real Supabase and Gemini dependencies.
- `supabase/tests/local/ai_companion_rate_limit.local.mts`
  (`pnpm test:local:ai-companion`): runs against the **local** Supabase stack
  only (`supabase start` and `supabase functions serve`, with `GEMINI_API_KEY`
  unset). It covers:
  - real concurrency (25 parallel slot calls, 15 parallel sends);
  - failed model attempts counting toward the limit;
  - the crisis exemption;
  - separate adult and child limits;
  - service-role-only access to the function;
  - failing closed on a database error.
