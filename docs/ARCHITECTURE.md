# SafeSpace — System Architecture Specification

## 1. High-Level System Architecture

SafeSpace operates on a clean multi-client, unified backend architecture.

```
+------------------------+      +------------------------+
|   React Web App        |      |   Flutter Mobile App   |
| (TypeScript + Vite)    |      |     (Dart + iOS/Android)|
+------------------------+      +------------------------+
            \                                /
             \                              /
              v                            v
       +------------------------------------------+
       |             Supabase Backend             |
       |  +------------------------------------+  |
       |  | PostgreSQL DB (RLS Enforced)       |  |
       |  | Supabase Auth                      |  |
       |  | Supabase Storage                   |  |
       |  | Supabase Edge Functions (Deno)     |  |
       |  +------------------------------------+  |
       +------------------------------------------+
                            |
                            v
       +------------------------------------------+
       |          External AI Services            |
       |  +------------------------------------+  |
       |  | LLM Provider APIs                  |  |
       |  | Speech-to-Text / NLP Pipelines     |  |
       |  | Qdrant Vector DB (RAG engine)      |  |
       |  +------------------------------------+  |
       +------------------------------------------+
```

---

## 2. Core Architectural Components

### A. Web Application (`apps/web/`)
- Built with **React 18**, **TypeScript**, and **Vite**.
- Structured into feature modules (`features/`), presentation pages (`pages/`), components, custom hooks, and service abstractions.
- Communicates with Supabase using `@supabase/supabase-js` via `@safespace/api-client`.

### B. Mobile Application (`apps/mobile/`)
- Built with **Flutter** and **Dart**.
- Multi-platform target (Android & iOS).
- Uses `supabase_flutter` for database & auth integration and `flutter_secure_storage` for child session token persistence.
- Single state management strategy via `flutter_riverpod`.

### C. Supabase Backend (`supabase/`)
- **Database**: PostgreSQL with Row Level Security (RLS) active on all tables.
- **Authentication**: Native Supabase Auth for Caregivers; server-verified PIN session tokens for Child sessions.
- **Edge Functions**: Serverless Deno endpoints providing secure API gateways for AI companion queries, journal sentiment analysis, safety checks, and recommendations.

### D. AI & RAG Subsystem
- AI key management and inference requests are isolated to **Supabase Edge Functions**.
- Vector embeddings and document chunks for condition-specific knowledge are indexed in **Qdrant** where vector search is required.
- Clients never interact directly with LLM providers or vector databases.

---

## 3. Data Flow Patterns

1. **Caregiver Authentication**:
   `Caregiver UI -> Supabase Auth -> JWT -> RLS Policy Check (auth.uid() = id) -> Postgres`

2. **Child PIN Login**:
   `Child UI -> verify-child-pin Edge Function -> bcrypt check against children.pin_hash -> Issued Child Session Token`

3. **Journal & AI Inference**:
   `Child UI -> Edge Function (journal-analysis / ai-companion) -> NLP/LLM Provider -> RLS Insert into journal_entries`

4. **Emergency Escalation Flow**:
   `Distress Signal -> Edge Function (safety-check) -> Classifier Check -> RLS Override -> Insert emergency_events -> Caregiver Notification`
