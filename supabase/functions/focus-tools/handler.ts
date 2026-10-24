// supabase/functions/focus-tools/handler.ts
// The ADHD and autism tools for a signed-in child (role-flow 8e): focus
// sessions, tasks, habits, stars, feelings cards and tool settings. Verifies
// the child-session token (signature, expiry and session version), then reads
// and writes ONLY that child's rows with the service role. Children can't
// delete feelings choices or focus history; removing a habit archives it, so
// the history a caregiver may see stays. Caregivers read the same rows under
// RLS (migration 20261028200000).
//
// Actions (all with child_session_token): sessions.list, sessions.add,
// tasks.list, tasks.create, tasks.update, tasks.delete, habits.list,
// habits.add, habits.archive, habits.set, stars.get, stars.award,
// stars.claim, emotions.list, emotions.add, settings.get.
// Request rules: _shared/focusTools.ts.
//
// No Deno or esm.sh imports; index.ts wires the real dependencies and
// supabase/tests/focus_tools_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";
import {
  EMOTION_LIST_LIMIT,
  HABIT_HISTORY_DAYS,
  SESSION_HISTORY_DAYS,
  dbErrorCode,
  parseFocusToolsRequest,
  type TaskStep,
} from "../_shared/focusTools.ts";

// Raw rows (snake_case), as PostgREST returns them.
export interface SessionRow { id: string; ended_at: string; duration_seconds: number; mode: string; phase: string | null; completed: boolean; activity_label: string | null }
export interface TaskRow { id: string; title: string; steps: TaskStep[]; is_archived: boolean; created_at: string; updated_at: string }
export interface HabitRow { id: string; title: string; icon: string | null; is_archived: boolean; created_at: string }
export interface StarRow { kind: "award" | "claim"; stars: number }
export interface GoalRow { title: string; target_stars: number; icon: string | null }
export interface EmotionRow { id: string; card_id: string; created_at: string }
export interface SettingsRow { transition_preset: { activity: string; totalSeconds: number } | null; aac_labels: Record<string, string> }

export interface FocusToolsStore {
  listSessions(childId: string, sinceIso: string): Promise<SessionRow[]>;
  addSession(childId: string, row: Omit<SessionRow, "id" | "ended_at">): Promise<SessionRow>;
  listTasks(childId: string): Promise<TaskRow[]>;
  createTask(childId: string, title: string, steps: TaskStep[]): Promise<TaskRow>;
  // null when the task isn't this child's.
  updateTask(childId: string, taskId: string, fields: { title: string; steps: TaskStep[]; is_archived: boolean }): Promise<TaskRow | null>;
  deleteTask(childId: string, taskId: string): Promise<boolean>;
  listHabits(childId: string): Promise<HabitRow[]>;
  listChecks(childId: string, sinceDay: string): Promise<{ habit_id: string; day: string }[]>;
  addHabit(childId: string, title: string, icon: string | null): Promise<HabitRow>;
  archiveHabit(childId: string, habitId: string): Promise<boolean>;
  childOwnsHabit(childId: string, habitId: string): Promise<boolean>;
  // Idempotent: ticking a ticked day or unticking an unticked one is fine.
  setCheck(habitId: string, day: string, checked: boolean): Promise<void>;
  listStars(childId: string): Promise<StarRow[]>;
  getGoal(childId: string): Promise<GoalRow | null>;
  // false when this event was already awarded.
  awardStars(childId: string, eventKey: string, stars: number): Promise<boolean>;
  claimGoal(childId: string): Promise<{ claimed: boolean; currentStars: number }>;
  listEmotions(childId: string, limit: number): Promise<EmotionRow[]>;
  addEmotion(childId: string, cardId: string): Promise<EmotionRow>;
  getSettings(childId: string): Promise<SettingsRow | null>;
}

export interface FocusToolsDeps {
  store: FocusToolsStore;
  verifyChildToken(token: string): Promise<string | null>;
  log(event: string, detail?: string): void;
  now?: () => Date;
}

export const MAX_BODY_BYTES = 16_384;

const toSession = (r: SessionRow) => ({
  id: r.id, endedAt: r.ended_at, durationSeconds: r.duration_seconds, mode: r.mode,
  phase: r.phase, completed: r.completed, activityLabel: r.activity_label,
});
const toTask = (r: TaskRow) => ({
  id: r.id, title: r.title, steps: r.steps, isArchived: r.is_archived, createdAt: r.created_at, updatedAt: r.updated_at,
});
const toHabit = (r: HabitRow) => ({ id: r.id, title: r.title, icon: r.icon, isArchived: r.is_archived, createdAt: r.created_at });
const toEmotion = (r: EmotionRow) => ({ id: r.id, cardId: r.card_id, createdAt: r.created_at });

export function starTotals(rows: StarRow[]) {
  return {
    currentStars: rows.reduce((n, r) => n + r.stars, 0),
    lifetimeStars: rows.filter((r) => r.kind === "award").reduce((n, r) => n + r.stars, 0),
  };
}

export function createFocusToolsHandler(deps: FocusToolsDeps) {
  const { store, log } = deps;
  const now = deps.now ?? (() => new Date());
  const daysAgo = (n: number) => new Date(now().getTime() - n * 86_400_000);

  return async function handle(req: Request): Promise<Response> {
    const pre = preflight(req); if (pre) return pre;
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    try {
      const text = await req.text();
      if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      let raw: unknown;
      try { raw = JSON.parse(text); } catch { return json({ error: "invalid_request" }, 400); }
      const parsed = parseFocusToolsRequest(raw);
      if (!parsed.ok) return json({ error: parsed.error }, parsed.status);

      const childId = await deps.verifyChildToken(parsed.token);
      if (!childId) return json({ error: "invalid_session" }, 401);
      const r = parsed.value;

      try {
        switch (r.action) {
          case "sessions.list":
            return json({ sessions: (await store.listSessions(childId, daysAgo(SESSION_HISTORY_DAYS).toISOString())).map(toSession) });
          case "sessions.add":
            return json({ session: toSession(await store.addSession(childId, {
              duration_seconds: r.durationSeconds, mode: r.mode, phase: r.phase, completed: r.completed, activity_label: r.activityLabel,
            })) });

          case "tasks.list":
            return json({ tasks: (await store.listTasks(childId)).map(toTask) });
          case "tasks.create":
            return json({ task: toTask(await store.createTask(childId, r.title, r.steps)) });
          case "tasks.update": {
            const row = await store.updateTask(childId, r.taskId, { title: r.title, steps: r.steps, is_archived: r.isArchived });
            return row ? json({ task: toTask(row) }) : json({ error: "not_found" }, 404);
          }
          case "tasks.delete":
            return (await store.deleteTask(childId, r.taskId)) ? json({ deleted: true }) : json({ error: "not_found" }, 404);

          case "habits.list": {
            const since = daysAgo(HABIT_HISTORY_DAYS).toISOString().slice(0, 10);
            const [habits, checks] = await Promise.all([store.listHabits(childId), store.listChecks(childId, since)]);
            return json({ habits: habits.map(toHabit), checks: checks.map((c) => ({ habitId: c.habit_id, day: c.day })) });
          }
          case "habits.add":
            return json({ habit: toHabit(await store.addHabit(childId, r.title, r.icon)) });
          case "habits.archive":
            return (await store.archiveHabit(childId, r.habitId)) ? json({ archived: true }) : json({ error: "not_found" }, 404);
          case "habits.set":
            if (!(await store.childOwnsHabit(childId, r.habitId))) return json({ error: "not_found" }, 404);
            await store.setCheck(r.habitId, r.day, r.checked);
            return json({ habitId: r.habitId, day: r.day, checked: r.checked });

          case "stars.get": {
            const [rows, goal] = await Promise.all([store.listStars(childId), store.getGoal(childId)]);
            return json({ ...starTotals(rows), goal: goal ? { title: goal.title, targetStars: goal.target_stars, icon: goal.icon } : null });
          }
          case "stars.award": {
            const awarded = await store.awardStars(childId, r.eventKey, r.stars);
            return json({ awarded, ...starTotals(await store.listStars(childId)) });
          }
          case "stars.claim":
            return json(await store.claimGoal(childId));

          case "emotions.list":
            return json({ choices: (await store.listEmotions(childId, EMOTION_LIST_LIMIT)).map(toEmotion) });
          case "emotions.add":
            return json({ choice: toEmotion(await store.addEmotion(childId, r.cardId)) });

          case "settings.get": {
            const s = await store.getSettings(childId);
            return json({ transitionPreset: s?.transition_preset ?? null, aacLabels: s?.aac_labels ?? {} });
          }
        }
      } catch (e) {
        const known = dbErrorCode(e);
        if (known) return json({ error: known.error }, known.status);
        throw e;
      }
    } catch (e) {
      log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
