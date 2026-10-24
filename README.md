# SafeSpace — Mental Wellbeing & Neurodivergent Support Platform

> **Core Philosophy**: *"Screen, educate, and support — never diagnose."*

SafeSpace is an open, scalable, age-tiered support platform designed for neurodivergent children (Autism, ADHD, Anxiety, Depression, PTSD, PCOS/PCOD) and their caregivers. SafeSpace provides non-clinical sensory tools, routine tracking, emotion regulation, AI companionship, and automated distress escalation with strict privacy controls.

---

## 1. Technology Stack (Final Architecture)

- **Web Application**: React 18 + TypeScript + Vite + Tailwind CSS
- **Mobile Application**: Flutter + Dart (iOS & Android)
- **Backend & Database**: Supabase (Managed PostgreSQL, Auth, Storage)
- **Server-Side AI & Business Logic**: Supabase Edge Functions (Deno / TypeScript)
- **AI / NLP / RAG**: LLM Provider APIs + NLP + Qdrant Vector Search (where required)
- **Workspace Manager**: `pnpm` Monorepo

---

## 2. Monorepo Repository Structure

```
SafeSpace/
│
├── apps/
│   ├── web/                     # React + TypeScript + Vite Web Application
│   │   ├── src/
│   │   │   ├── app/             # Web App core module
│   │   │   ├── components/      # Shared React components
│   │   │   ├── features/        # Feature modules (Auth, Mood, Safety, Conditions)
│   │   │   ├── layouts/         # Page layouts
│   │   │   ├── pages/           # Screen views / pages
│   │   │   ├── routes/          # Navigation route constants
│   │   │   ├── services/        # Service abstractions
│   │   │   ├── hooks/           # Custom React hooks
│   │   │   ├── lib/             # Utilities & session storage helpers
│   │   │   ├── types/           # TypeScript types
│   │   │   └── assets/          # Static assets
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── .env.example
│   │
│   └── mobile/                  # Flutter + Dart Cross-Platform Mobile Application
│       ├── lib/
│       │   ├── core/            # Theme, Constants, Router
│       │   ├── features/        # Feature boundaries & condition modules
│       │   ├── models/          # Data models (Caregiver, Child, Journal, Event)
│       │   ├── services/        # Supabase & Secure Storage services
│       │   ├── screens/         # Flutter screens (RoleChoice, Auth, Pin, Dashboard)
│       │   ├── widgets/         # Reusable UI widgets
│       │   └── main.dart        # Flutter entry point
│       ├── test/                # Flutter unit & widget tests
│       ├── pubspec.yaml         # Flutter dependencies
│       ├── analysis_options.yaml# Dart linter configuration
│       └── .env.example
│
├── packages/
│   ├── shared-types/            # Shared TypeScript interfaces & types
│   ├── game-content/            # Games Corner puzzles, stories and text shared by web and mobile (docs/games.md)
│   └── api-client/              # Reusable API & Supabase client abstractions
│
├── supabase/
│   ├── migrations/              # Database schema migrations & RLS policies
│   ├── functions/               # Supabase Edge Functions (Serverless Deno)
│   │   ├── ai-companion/        # AI Companion server-side endpoint
│   │   ├── journal-analysis/    # Sentiment analysis & distress classification
│   │   ├── safety-check/        # Crisis evaluation & safety thresholds
│   │   └── recommendations/     # Non-clinical guidance generation
│   ├── tests/                   # Crypto & RLS test suites
│   ├── seed.sql                 # Initial seed data
│   └── config.toml              # Supabase CLI configuration
│
├── docs/                        # Architecture, Schema, Security & API Docs
│   ├── ARCHITECTURE.md          # Architectural specifications & data flows
│   ├── DATABASE_SCHEMA.md       # Database schema & RLS policy reference
│   ├── SECURITY.md              # Security model, secrets, privacy tiers
│   ├── DEVELOPMENT.md           # Developer onboarding & setup instructions
│   ├── API.md                   # Edge Functions & service interfaces
│   ├── PROJECT_STATUS.md        # Current implementation status (Phase 0)
│   └── legacy/                  # Archived legacy code & references
│
├── package.json                 # Root monorepo workspace scripts
├── pnpm-workspace.yaml          # PNPM workspace definition
├── README.md                    # Project README
└── LICENSE
```

---

## 3. Quick Start & Setup

### Prerequisites
- **Node.js**: `^18.0.0` or `>=20.0.0`
- **pnpm**: `>=9.0.0` (`npm install -g pnpm`)
- **Flutter SDK**: `>=3.10.0` (for mobile development)
- **Supabase CLI**: (`npm install -g supabase`)

### Installation & Web Execution

```bash
# 1. Install TypeScript dependencies across workspace
pnpm install

# 2. Run Web Application in local development mode
pnpm web:dev

# 3. Build Web Application for production
pnpm web:build
```

### Mobile Execution (Flutter)

```bash
# Navigate to mobile app directory
cd apps/mobile

# Fetch Flutter packages
flutter pub get

# Run static analysis
flutter analyze

# Launch application on simulator or target device
flutter run
```

### Supabase Backend Execution

```bash
# Start local Supabase container environment
supabase start

# Serve Edge Functions locally
pnpm functions:serve
```

---

## 4. Key Development Commands

| Command | Description |
| :--- | :--- |
| `pnpm web:dev` | Starts local Vite web server (`http://localhost:5173`) |
| `pnpm web:build` | Compiles TypeScript and builds production Web bundle |
| `pnpm typecheck` | Executes workspace-wide TypeScript type checking |
| `pnpm lint` | Runs linting and build checks |
| `pnpm mobile:get` | Installs Flutter pub packages in `apps/mobile` |
| `pnpm mobile:analyze` | Executes Dart static code analyzer in `apps/mobile` |
| `pnpm db:start` | Launches Supabase local stack via Docker |
| `pnpm db:reset` | Resets local Postgres database and reapplies migrations |

---

## 5. Security & Privacy Guarantees

1. **Database-Level RLS (Row Level Security)**: Privacy rules (such as partial privacy tier filtering for older children) are enforced inside PostgreSQL via RLS policies. Application bugs cannot leak private notes.
2. **Zero API Secret Leakage**: AI provider keys, service-role keys, and LLM credentials are strictly confined to server-side Supabase Edge Functions. Clients access AI features strictly via Edge Function endpoints.
3. **Child PIN Hash Safeguard**: 4-digit PINs are hashed using `bcrypt` and verified exclusively via server-side Edge Functions. Raw PINs are never stored or transmitted in plain text.
4. **Emergency Override**: Safety alerts and emergency distress events bypass age-tiered privacy controls by design, ensuring caregivers are immediately notified during distress events.

---

## 6. Current Status & Phase 0 Scope

This repository represents **Phase 0 — Clean Foundation**. All architectural boundaries, database schemas, edge functions, and client application structures are fully initialized and stabilized. Actual feature implementations (AI pipelines, detailed UI screens, interactive routines) will be built on top of this foundation in subsequent phases.
