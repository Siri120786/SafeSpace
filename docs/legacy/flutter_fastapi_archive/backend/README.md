# SafeSpace Backend (FastAPI)

Implements the Application layer, shared feature modules, and AI orchestration
described in `../docs/Architecture_Specification.md`. Every route stub in this
codebase is commented with which architecture-spec section it implements —
start there if something looks unexplained.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then fill in real Firebase/DB/AI credentials
uvicorn app.main:app --reload
```

API docs (auto-generated): http://localhost:8000/docs

## Folder guide

- `app/api/` — Auth service, Modules API, AI orchestration (the three inner
  boxes of the Application layer in the architecture diagram)
- `app/features/` — the four shared feature modules: journaling, routines,
  stories, emergency. `routines.py` is intentionally the only one with no
  AI service import — see architecture spec section 6.
- `app/modules/` — the static registry of all six condition modules and
  their module-specific features (shared features excluded on purpose)
- `app/core/security.py` — session validation, role decoding, and the
  age-tiered privacy logic. This is where the "backend decides, client
  renders" rule is enforced.
- `app/services/ai_services.py` — thin wrappers for the actual AI provider
  calls (NLP, LLM, speech-to-text), kept separate from routing/governance

## What's stubbed vs. real

Everything runs and returns valid responses, but external integrations
(Firebase, Postgres, Firestore, the actual AI provider) are stubbed with
clear `# STUB` comments and `NotImplementedError` where relevant. This is
meant to be a correct skeleton to build into, not a finished backend.

## Tests

```bash
pip install pytest
pytest
```

`tests/test_health.py` includes a regression test for the "Routines never
calls AI" architecture rule — a cheap guard against that logic drifting
later.
