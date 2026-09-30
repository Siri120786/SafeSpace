# SafeSpace — Database Schema & RLS Reference

This document describes the actual implemented PostgreSQL database schema and Row Level Security (RLS) policies contained in `supabase/migrations/`.

---

## 1. Tables Overview

### `profiles` (Added in Migration 0003)
Maps 1:1 to `auth.users`. Holds user identity, role, and profile metadata.
- `id` (`uuid`, PK, FK to `auth.users.id`)
- `role` (`text`, default `'caregiver'`, check `role in ('caregiver', 'user')`)
- `display_name` (`text`, nullable)
- `onboarding_state` (`text`, default `'pending'`, check `onboarding_state in ('pending', 'completed')`)
- `created_at` (`timestamptz`)
- `updated_at` (`timestamptz`)

**RLS Policies**:
- `Users can view their own profile`: `(auth.uid() = id)`
- `Users can update their own profile`: `(auth.uid() = id)`

**Trigger**:
- `handle_new_user_profile()` automatically inserts a profile row on `auth.users` creation, extracting `role` and `display_name` from `raw_user_meta_data`.

---

### `caregivers`
Maps caregiver profiles for family child management.
- `id` (`uuid`, PK, FK to `auth.users.id`)
- `display_name` (`text`, nullable)
- `family_code` (`text`, unique, default 6-char random alphanumeric)
- `created_at` (`timestamptz`)

**RLS Policies**:
- `Caregivers can read and update their own row`: `(auth.uid() = id)`

---

### `condition_modules`
Static reference table for the 6 core condition modules.
- `key` (`text`, PK: `'autism' | 'adhd' | 'anxiety' | 'depression' | 'ptsd' | 'pcos_pcod'`)
- `display_name` (`text`)
- `is_built` (`boolean`)

**Initial Data**:
- `autism`: "My Space" (`is_built = true`)
- `adhd`: "Focus Zone" (`is_built = false`)
- `anxiety`: "Calm Space" (`is_built = false`)
- `depression`: "Bright Days" (`is_built = false`)
- `ptsd`: "Safe Harbor" (`is_built = false`)
- `pcos_pcod`: "Cycle Care" (`is_built = false`)

---

### `children`
Child profile created by caregiver.
- `id` (`uuid`, PK)
- `caregiver_id` (`uuid`, FK to `caregivers.id`)
- `name` (`text`)
- `age` (`int`, check `4 <= age <= 17`)
- `pin_hash` (`text`, bcrypt hash)
- `privacy_tier` (`text`, check `'full' | 'partial' | 'private'`)
- `created_at` (`timestamptz`)

**RLS Policies**:
- `Caregivers manage their own children`: `(auth.uid() = caregiver_id)`

---

### `child_modules`
Junction table linking children to assigned condition modules.
- `child_id` (`uuid`, FK to `children.id`)
- `module_key` (`text`, FK to `condition_modules.key`)
- `assigned_at` (`timestamptz`)
- PK: `(child_id, module_key)`

---

### `journal_entries`
Transcribed or text entries written by children.
- `id` (`uuid`, PK)
- `child_id` (`uuid`, FK to `children.id`)
- `module_key` (`text`, FK to `condition_modules.key`)
- `content` (`text`)
- `sentiment_flags` (`jsonb`)
- `is_private_note` (`boolean`, default `false`)
- `created_at` (`timestamptz`)

**RLS Policy (Age-Tiered Privacy Rule)**:
- Caregiver can read journal entries EXCEPT when `privacy_tier = 'partial'` AND `is_private_note = true`.

---

### `routine_steps`
Scheduled visual or text routine steps.
- `id` (`uuid`, PK)
- `child_id` (`uuid`, FK to `children.id`)
- `module_key` (`text`, FK to `condition_modules.key`)
- `label` (`text`)
- `scheduled_time` (`time`, nullable)
- `is_complete` (`boolean`)
- `order_index` (`int`)
- `created_at` (`timestamptz`)

---

### `generated_stories`
AI-assisted social stories generated for children.
- `id` (`uuid`, PK)
- `child_id` (`uuid`, FK to `children.id`)
- `module_key` (`text`, FK to `condition_modules.key`)
- `prompt_context` (`jsonb`)
- `content_text` (`text`)
- `content_image_url` (`text`)
- `created_at` (`timestamptz`)

---

### `emergency_events`
Distress escalation logs.
- `id` (`uuid`, PK)
- `child_id` (`uuid`, FK to `children.id`)
- `triggered_by` (`text`: `'check_in' | 'aac_tap' | 'journal_flag'`)
- `classifier_score` (`numeric`)
- `ai_alert_summary` (`text`)
- `caregiver_notified_at` (`timestamptz`)
- `reviewed_at` (`timestamptz`)
- `reviewed_by` (`uuid`, FK to `caregivers.id`)
- `created_at` (`timestamptz`)

**RLS Policy (Emergency Override)**:
- Caregivers can ALWAYS read emergency events for their children regardless of privacy tier settings.

---

### `pin_attempts`
Failed/successful PIN attempt logs for family-level rate limiting.
- `id` (`bigint`, PK)
- `family_code` (`text`)
- `succeeded` (`boolean`)
- `attempted_at` (`timestamptz`)
