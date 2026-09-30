# SafeSpace — Developer Guide & Setup

## 1. Prerequisites

Make sure the following tools are installed on your machine:
- **Node.js**: v18.0.0+ or v20.0.0+
- **pnpm**: v9.0.0+ (`npm install -g pnpm`)
- **Flutter SDK**: v3.10.0+
- **Docker**: (Required for running local Supabase stack)
- **Supabase CLI**: (`npm install -g supabase`)

---

## 2. Environment Setup

### Web Setup (`apps/web/.env`)
Copy `apps/web/.env.example` to `apps/web/.env.local`:
```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
```

### Mobile Setup (`apps/mobile/.env`)
Copy `apps/mobile/.env.example` to `apps/mobile/.env`:
```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your-local-anon-key
```

### Supabase Edge Functions Setup (`supabase/.env.local`)
Copy `supabase/.env.example` to `supabase/.env.local`:
```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
LLM_API_KEY=your-llm-api-key
```

---

## 3. Local Supabase Operations

```bash
# Start Supabase services (requires Docker)
supabase start

# Apply/reset migrations & seed data
supabase db reset

# Serve Edge Functions locally
pnpm functions:serve
```

---

## 4. Running Web & Mobile Applications

### Running Web Application
```bash
pnpm install
pnpm web:dev
```

### Running Flutter Mobile Application
```bash
cd apps/mobile
flutter pub get
flutter run
```

---

## 5. Code Quality & Verification Commands

```bash
# Typecheck TypeScript across all packages & web app
pnpm typecheck

# Lint & build check
pnpm lint

# Analyze Flutter code
cd apps/mobile && flutter analyze
```
