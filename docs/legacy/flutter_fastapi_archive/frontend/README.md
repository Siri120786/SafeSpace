# SafeSpace Frontend (Flutter)

Implements the Client layer from `../docs/Architecture_Specification.md`.
Every screen is render-only by design — see the "golden rule" in that doc's
section 1. If you find business logic creeping into a widget here, it
belongs in the backend instead.

## Setup

This is a hand-written skeleton (not `flutter create` output), so run this
first to generate the platform folders (android/, ios/, web/, etc.):

```bash
flutter create --project-name safespace --org com.safespace .
```

Say **no** if it asks to overwrite `lib/` or `pubspec.yaml` — those are
already written and shouldn't be touched.

Then:

```bash
flutter pub get
flutter run
```

You'll also need to run `flutterfire configure` once Firebase is set up,
to generate `firebase_options.dart`.

## Folder guide

- `lib/core/routes/` — the session-routing logic (architecture spec section 2)
- `lib/core/theme/` — includes a TODO for the low-sensory mode theme variant
- `lib/features/home/` — Home page: reads a token, forwards it, renders
  whatever the backend says. No decisions made here.
- `lib/features/auth/` — sign up / log in
- `lib/features/caregiver_dashboard/` — All-inputs view + Settings
- `lib/features/user_view/` — module home/picker branching logic
- `lib/features/modules/` — one folder per condition module. Each file's
  header comment states its build status honestly (autism has a prototype
  to port logic from; the other five are feature-list only)
- `lib/shared/services/` — the API client and secure token storage

## What's stubbed vs. real

Every screen renders and the routing works, but network calls, Firebase
Auth wiring, and the actual module content are marked `// TODO` with a
pointer to the relevant architecture-spec section. This is a correct
skeleton to build into, not a finished app.
