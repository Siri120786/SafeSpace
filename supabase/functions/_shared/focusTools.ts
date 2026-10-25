// supabase/functions/_shared/focusTools.ts
// Request rules for the focus-tools Edge Function (role-flow 8e): the ADHD
// and autism tools for a signed-in child, and their music favorites (9b). They mirror the database checks in
// migration 20261028200000, so a bad request is a clear 400 before any write;
// the database stays the final gate. Pure: no Deno or esm.sh imports, so the
// tests run it under Node.

import { parseCalmPlan, type CalmPlan } from "./calmPlan.ts";

export const FOCUS_MODES = ["simple", "pomodoro"] as const;
export const FOCUS_PHASES = ["focus", "shortBreak", "longBreak"] as const;
export const EMOTION_CARD_IDS = [
  "happy", "calm", "ecstatic", "neutral", "sad", "tired", "stressed", "overwhelmed", "proud", "curious",
] as const;

export const SESSION_HISTORY_DAYS = 60;
export const HABIT_HISTORY_DAYS = 31;
export const EMOTION_LIST_LIMIT = 20;
// Music track ids from the web app's catalog (role-flow 9b).
export const TRACK_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

export interface TaskStep {
  id: string;
  label: string;
  isComplete: boolean;
  orderIndex: number;
  completedAt?: number | null;
}

export type FocusToolsRequest =
  | { action: "sessions.list" }
  | { action: "sessions.add"; durationSeconds: number; mode: (typeof FOCUS_MODES)[number]; phase: (typeof FOCUS_PHASES)[number] | null; completed: boolean; activityLabel: string | null }
  | { action: "tasks.list" }
  | { action: "tasks.create"; title: string; steps: TaskStep[] }
  | { action: "tasks.update"; taskId: string; title: string; steps: TaskStep[]; isArchived: boolean }
  | { action: "tasks.delete"; taskId: string }
  | { action: "habits.list" }
  | { action: "habits.add"; title: string; icon: string | null }
  | { action: "habits.archive"; habitId: string }
  | { action: "habits.set"; habitId: string; day: string; checked: boolean }
  | { action: "stars.get" }
  | { action: "stars.award"; eventKey: string; stars: number }
  | { action: "stars.claim" }
  | { action: "emotions.list" }
  | { action: "emotions.add"; cardId: (typeof EMOTION_CARD_IDS)[number] }
  | { action: "settings.get" }
  | { action: "favorites.list" }
  | { action: "favorites.add"; trackId: string }
  | { action: "favorites.remove"; trackId: string }
  | { action: "calmPlan.get" }
  | { action: "calmPlan.save"; plan: CalmPlan };

type Parsed = { ok: true; token: string; value: FocusToolsRequest } | { ok: false; error: string; status: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const text = (v: unknown, min: number, max: number): string | null =>
  typeof v === "string" && v.trim().length >= min && v.trim().length <= max ? v.trim() : null;
const id = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v.toLowerCase() : null);

export function validTaskSteps(v: unknown): v is TaskStep[] {
  return Array.isArray(v) && v.length <= 30 && v.every((s) =>
    s && typeof s === "object" && !Array.isArray(s) &&
    typeof s.id === "string" && s.id.length >= 1 && s.id.length <= 64 &&
    typeof s.label === "string" && s.label.trim().length >= 1 && s.label.trim().length <= 120 &&
    typeof s.isComplete === "boolean" &&
    typeof s.orderIndex === "number" && Number.isFinite(s.orderIndex) &&
    (s.completedAt === undefined || s.completedAt === null || (typeof s.completedAt === "number" && Number.isFinite(s.completedAt))));
}

// A real calendar day, "YYYY-MM-DD".
export function validDay(v: unknown): v is string {
  if (typeof v !== "string" || !DAY.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const bad = (error = "invalid_input"): Parsed => ({ ok: false, error, status: 400 });

export function parseFocusToolsRequest(raw: unknown): Parsed {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return bad("invalid_request");
  const r = raw as Record<string, unknown>;
  if (typeof r.child_session_token !== "string" || !r.child_session_token) {
    return { ok: false, error: "invalid_session", status: 401 };
  }
  const token = r.child_session_token;
  const done = (value: FocusToolsRequest): Parsed => ({ ok: true, token, value });

  switch (r.action) {
    case "sessions.list":
    case "tasks.list":
    case "habits.list":
    case "stars.get":
    case "stars.claim":
    case "emotions.list":
    case "settings.get":
    case "favorites.list":
    case "calmPlan.get":
      return done({ action: r.action });

    case "calmPlan.save": {
      const plan = parseCalmPlan(r.plan);
      return plan ? done({ action: "calmPlan.save", plan }) : bad();
    }

    case "sessions.add": {
      const d = r.duration_seconds;
      if (typeof d !== "number" || !Number.isInteger(d) || d < 1 || d > 14400) return bad();
      if (!(FOCUS_MODES as readonly unknown[]).includes(r.mode)) return bad();
      if (r.phase !== undefined && r.phase !== null && !(FOCUS_PHASES as readonly unknown[]).includes(r.phase)) return bad();
      if (r.completed !== undefined && typeof r.completed !== "boolean") return bad();
      const label = r.activity_label === undefined || r.activity_label === null || r.activity_label === "" ? null : text(r.activity_label, 1, 80);
      if (r.activity_label && label === null) return bad();
      return done({
        action: "sessions.add",
        durationSeconds: d,
        mode: r.mode as (typeof FOCUS_MODES)[number],
        phase: (r.phase ?? null) as (typeof FOCUS_PHASES)[number] | null,
        completed: r.completed !== false,
        activityLabel: label,
      });
    }

    case "tasks.create": {
      const title = text(r.title, 1, 120);
      const steps = r.steps ?? [];
      if (!title || !validTaskSteps(steps)) return bad();
      return done({ action: "tasks.create", title, steps });
    }
    case "tasks.update": {
      const taskId = id(r.task_id);
      const title = text(r.title, 1, 120);
      if (!taskId || !title || !validTaskSteps(r.steps) || typeof r.is_archived !== "boolean") return bad();
      return done({ action: "tasks.update", taskId, title, steps: r.steps, isArchived: r.is_archived });
    }
    case "tasks.delete": {
      const taskId = id(r.task_id);
      return taskId ? done({ action: "tasks.delete", taskId }) : bad();
    }

    case "habits.add": {
      const title = text(r.title, 1, 60);
      const icon = r.icon === undefined || r.icon === null || r.icon === "" ? null : typeof r.icon === "string" && r.icon.length <= 16 ? r.icon : undefined;
      if (!title || icon === undefined) return bad();
      return done({ action: "habits.add", title, icon });
    }
    case "habits.archive": {
      const habitId = id(r.habit_id);
      return habitId ? done({ action: "habits.archive", habitId }) : bad();
    }
    case "habits.set": {
      const habitId = id(r.habit_id);
      if (!habitId || !validDay(r.day) || typeof r.checked !== "boolean") return bad();
      return done({ action: "habits.set", habitId, day: r.day, checked: r.checked });
    }

    case "stars.award": {
      const eventKey = typeof r.event_key === "string" && r.event_key.length >= 1 && r.event_key.length <= 160 && !r.event_key.startsWith("claim:")
        ? r.event_key : null;
      const stars = r.stars === undefined ? 1 : r.stars;
      if (!eventKey || typeof stars !== "number" || !Number.isInteger(stars) || stars < 1 || stars > 10) return bad();
      return done({ action: "stars.award", eventKey, stars });
    }

    case "emotions.add":
      return (EMOTION_CARD_IDS as readonly unknown[]).includes(r.card_id)
        ? done({ action: "emotions.add", cardId: r.card_id as (typeof EMOTION_CARD_IDS)[number] })
        : bad();

    case "favorites.add":
    case "favorites.remove":
      return typeof r.track_id === "string" && TRACK_ID.test(r.track_id)
        ? done({ action: r.action, trackId: r.track_id })
        : bad();

    default:
      return bad("invalid_action");
  }
}

// Database refusals as request errors: the cap ("limit_reached") and failed
// checks (bad input that slipped past the rules above).
export function dbErrorCode(e: unknown): { error: string; status: number } | null {
  const o = (e && typeof e === "object" ? e : {}) as { code?: string; message?: string };
  if (o.message?.includes("limit_reached")) return { error: "limit_reached", status: 409 };
  if (o.message?.includes("invalid_input") || ["23514", "22P02", "22007", "22008", "23502"].includes(o.code ?? "")) {
    return { error: "invalid_input", status: 400 };
  }
  return null;
}
