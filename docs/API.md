# SafeSpace — API & Edge Functions Interface Specification

## 1. Overview

All client-to-backend operations requiring service-role privileges, cryptographic verification, or AI model inference pass through **Supabase Edge Functions**.

---

## 2. Implemented Edge Functions

### `verify-child-pin`
Verifies a child's family code and 4-digit PIN against bcrypt hashes in `children.pin_hash`. Rate limits guessing per family using `pin_attempts`.

- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "family_code": "A1B2C3",
    "pin": "1234"
  }
  ```
- **Response**:
  ```json
  {
    "token": "signed-child-session-token",
    "child": {
      "id": "uuid",
      "name": "Alex",
      "age": 8,
      "privacy_tier": "full"
    }
  }
  ```

---

### `create-child`
Creates a child profile and hashes the PIN. Restricted to authenticated caregivers.

- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "name": "Sam",
    "age": 10,
    "pin": "5678",
    "modules": ["autism", "adhd"]
  }
  ```

---

### `emergency-escalation`
Processes high-distress triggers, logs an emergency event, and alerts caregivers.

- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "child_id": "uuid",
    "triggered_by": "journal_flag",
    "classifier_score": 0.85
  }
  ```

---

### `ai-companion`
Server-side gateway for real-time AI companion interaction.

- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "child_id": "uuid",
    "prompt": "I feel overwhelmed by noise today.",
    "module_key": "autism"
  }
  ```

---

### `journal-analysis`
Performs NLP sentiment classification and distress detection on child journal inputs.

- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "child_id": "uuid",
    "content": "Journal text to analyze",
    "module_key": "autism"
  }
  ```

---

### `safety-check`
Evaluates distress scores against threshold limits.

- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "child_id": "uuid",
    "score": 0.75
  }
  ```

---

### `recommendations`
Generates non-clinical personalized support recommendations.

- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "child_id": "uuid",
    "module_key": "autism"
  }
  ```
