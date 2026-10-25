// packages/api-client/src/focusTools.ts
// The ADHD and autism tools' data (role-flow 8e): focus sessions, tasks,
// habits, stars, feelings cards and tool settings. One set of functions for
// both kinds of person:
//   - a child session goes through the `focus-tools` Edge Function, which
//     checks the child-session token and touches only that child's rows;
//   - an adult (Individual) reads and writes their own rows under RLS.
// Caregivers read a child's rows under RLS (the mood check-in sharing rule)
// and set a child's goal and settings in step 8f.
// Errors: invalid_input, limit_reached, not_found, invalid_session,
// unsupported_session (an action only adults have, or no session).

import { getSafeSpaceClient } from "./supabaseClient";
import { ContractError, invokeEdge, toContractError } from "./edge";
import type { AppSession } from "@safespace/shared-types";

type Row = Record<string, any>;

export interface FocusSessionRecordRow {
  id: string;
  endedAt: string;
  durationSeconds: number;
  mode: "simple" | "pomodoro";
  phase: "focus" | "shortBreak" | "longBreak" | null;
  completed: boolean;
  activityLabel: string | null;
}

export interface FocusTaskStep {
  id: string;
  label: string;
  isComplete: boolean;
  orderIndex: number;
  completedAt?: number | null;
}

export interface FocusTask {
  id: string;
  title: string;
  steps: FocusTaskStep[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  title: string;
  icon: string | null;
  isArchived: boolean;
  createdAt: string;
}

export interface HabitCheck {
  habitId: string;
  day: string; // "YYYY-MM-DD"
}

export interface StarGoal {
  title: string;
  targetStars: number;
  icon: string | null;
}

export interface StarTotals {
  currentStars: number;
  lifetimeStars: number;
}

export interface EmotionChoice {
  id: string;
  cardId: string;
  createdAt: string;
}

// A child's music controls (role-flow 9c), set by a caregiver. Adults have
// none: their music is theirs to control.
export interface MusicSettings {
  enabled: boolean;
  volumeMax: number | null;     // percent of full, 10-60; null = the default 60
  sleepMinutes: number | null;  // 10, 20 or 30: a sleep timer with every play
}
export const DEFAULT_MUSIC_SETTINGS: MusicSettings = { enabled: true, volumeMax: null, sleepMinutes: null };

export interface ToolSettings {
  transitionPreset: { activity: string; totalSeconds: number } | null;
  aacLabels: Record<string, string>;
  music: MusicSettings;
}

const SETTINGS_COLS = "transition_preset, aac_labels, music_enabled, music_volume_max, music_sleep_minutes";
const toSettings = (r: Row | null | undefined): ToolSettings => ({
  transitionPreset: r?.transition_preset ?? null,
  aacLabels: r?.aac_labels ?? {},
  music: {
    enabled: r?.music_enabled ?? true,
    volumeMax: r?.music_volume_max ?? null,
    sleepMinutes: r?.music_sleep_minutes ?? null,
  },
});
// The columns to write for the settings given.
function settingsRow(settings: Partial<ToolSettings>): Row {
  const row: Row = {};
  if (settings.transitionPreset !== undefined) row.transition_preset = settings.transitionPreset;
  if (settings.aacLabels !== undefined) row.aac_labels = settings.aacLabels;
  if (settings.music !== undefined) {
    row.music_enabled = settings.music.enabled;
    row.music_volume_max = settings.music.volumeMax;
    row.music_sleep_minutes = settings.music.sleepMinutes;
  }
  return row;
}

export const FOCUS_SESSION_HISTORY_DAYS = 60;
export const HABIT_HISTORY_DAYS = 31;

const SESSION_COLS = "id, ended_at, duration_seconds, mode, phase, completed, activity_label";
const TASK_COLS = "id, title, steps, is_archived, created_at, updated_at";
const HABIT_COLS = "id, title, icon, is_archived, created_at";

const toSession = (r: Row): FocusSessionRecordRow => ({
  id: r.id, endedAt: r.ended_at, durationSeconds: r.duration_seconds, mode: r.mode,
  phase: r.phase ?? null, completed: r.completed, activityLabel: r.activity_label ?? null,
});
const toTask = (r: Row): FocusTask => ({
  id: r.id, title: r.title, steps: r.steps ?? [], isArchived: r.is_archived, createdAt: r.created_at, updatedAt: r.updated_at,
});
const toHabit = (r: Row): Habit => ({ id: r.id, title: r.title, icon: r.icon ?? null, isArchived: r.is_archived, createdAt: r.created_at });
const toEmotion = (r: Row): EmotionChoice => ({ id: r.id, cardId: r.card_id, createdAt: r.created_at });

export function starTotalsOf(rows: { kind: string; stars: number }[]): StarTotals {
  return {
    currentStars: rows.reduce((n, r) => n + r.stars, 0),
    lifetimeStars: rows.filter((r) => r.kind === "award").reduce((n, r) => n + r.stars, 0),
  };
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

// Who the call is for: a child (through the function) or an adult (RLS).
type Who = { kind: "child"; token: string } | { kind: "adult"; profileId: string };
function who(session: AppSession): Who {
  if (session?.kind === "child") return { kind: "child", token: session.childSessionToken };
  if (session?.kind === "auth_user" && session.profile?.id) return { kind: "adult", profileId: session.profile.id };
  throw new ContractError("unsupported_session");
}
function adultOnly(session: AppSession): string {
  const w = who(session);
  if (w.kind !== "adult") throw new ContractError("unsupported_session");
  return w.profileId;
}
const call = <T,>(token: string, action: string, body: Record<string, unknown> = {}) =>
  invokeEdge<T>("focus-tools", { action, child_session_token: token, ...body });
// Supabase errors to contract codes (the database's own "limit_reached" too).
function fail(error: { code?: string; message?: string }): never {
  if (error.message?.includes("limit_reached")) throw new ContractError("limit_reached");
  throw toContractError(error);
}

// ---------------------------------------------------------------------------
// Focus sessions
// ---------------------------------------------------------------------------
export async function listFocusSessions(session: AppSession): Promise<FocusSessionRecordRow[]> {
  const w = who(session);
  if (w.kind === "child") return (await call<{ sessions: FocusSessionRecordRow[] }>(w.token, "sessions.list")).sessions;
  const { data, error } = await getSafeSpaceClient().from("focus_sessions").select(SESSION_COLS)
    .eq("profile_id", w.profileId).gte("ended_at", daysAgo(FOCUS_SESSION_HISTORY_DAYS).toISOString())
    .order("ended_at", { ascending: false }).limit(500);
  if (error) fail(error);
  return (data ?? []).map(toSession);
}

export async function addFocusSession(
  session: AppSession,
  input: { durationSeconds: number; mode: "simple" | "pomodoro"; phase?: FocusSessionRecordRow["phase"]; completed?: boolean; activityLabel?: string | null },
): Promise<FocusSessionRecordRow> {
  const w = who(session);
  const row = {
    duration_seconds: Math.round(input.durationSeconds),
    mode: input.mode,
    phase: input.phase ?? null,
    completed: input.completed !== false,
    activity_label: input.activityLabel?.trim() || null,
  };
  if (w.kind === "child") return (await call<{ session: FocusSessionRecordRow }>(w.token, "sessions.add", row)).session;
  const { data, error } = await getSafeSpaceClient().from("focus_sessions")
    .insert({ profile_id: w.profileId, ...row }).select(SESSION_COLS).single();
  if (error) fail(error);
  return toSession(data!);
}

// Adults only: children can't delete their focus history.
export async function clearMyFocusSessions(session: AppSession): Promise<void> {
  const profileId = adultOnly(session);
  const { error } = await getSafeSpaceClient().from("focus_sessions").delete().eq("profile_id", profileId);
  if (error) fail(error);
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export async function listFocusTasks(session: AppSession): Promise<FocusTask[]> {
  const w = who(session);
  if (w.kind === "child") return (await call<{ tasks: FocusTask[] }>(w.token, "tasks.list")).tasks;
  const { data, error } = await getSafeSpaceClient().from("focus_tasks").select(TASK_COLS)
    .eq("profile_id", w.profileId).order("created_at", { ascending: false });
  if (error) fail(error);
  return (data ?? []).map(toTask);
}

export async function createFocusTask(session: AppSession, title: string, steps: FocusTaskStep[] = []): Promise<FocusTask> {
  const w = who(session);
  if (w.kind === "child") return (await call<{ task: FocusTask }>(w.token, "tasks.create", { title, steps })).task;
  const { data, error } = await getSafeSpaceClient().from("focus_tasks")
    .insert({ profile_id: w.profileId, title: title.trim(), steps }).select(TASK_COLS).single();
  if (error) fail(error);
  return toTask(data!);
}

export async function updateFocusTask(session: AppSession, task: Pick<FocusTask, "id" | "title" | "steps" | "isArchived">): Promise<FocusTask> {
  const w = who(session);
  if (w.kind === "child") {
    return (await call<{ task: FocusTask }>(w.token, "tasks.update", {
      task_id: task.id, title: task.title, steps: task.steps, is_archived: task.isArchived,
    })).task;
  }
  const { data, error } = await getSafeSpaceClient().from("focus_tasks")
    .update({ title: task.title.trim(), steps: task.steps, is_archived: task.isArchived })
    .eq("id", task.id).eq("profile_id", w.profileId).select(TASK_COLS).maybeSingle();
  if (error) fail(error);
  if (!data) throw new ContractError("not_found");
  return toTask(data);
}

export async function deleteFocusTask(session: AppSession, taskId: string): Promise<void> {
  const w = who(session);
  if (w.kind === "child") {
    await call(w.token, "tasks.delete", { task_id: taskId });
    return;
  }
  const { data, error } = await getSafeSpaceClient().from("focus_tasks").delete()
    .eq("id", taskId).eq("profile_id", w.profileId).select("id");
  if (error) fail(error);
  if (!data?.length) throw new ContractError("not_found");
}

// ---------------------------------------------------------------------------
// Habits (removing a habit archives it, so its history stays)
// ---------------------------------------------------------------------------
export async function listHabits(session: AppSession): Promise<{ habits: Habit[]; checks: HabitCheck[] }> {
  const w = who(session);
  if (w.kind === "child") return call<{ habits: Habit[]; checks: HabitCheck[] }>(w.token, "habits.list");
  const db = getSafeSpaceClient();
  const { data, error } = await db.from("habits").select(HABIT_COLS).eq("profile_id", w.profileId).order("created_at", { ascending: true });
  if (error) fail(error);
  const habits = (data ?? []).map(toHabit);
  if (!habits.length) return { habits, checks: [] };
  const since = daysAgo(HABIT_HISTORY_DAYS).toISOString().slice(0, 10);
  const { data: checks, error: checkError } = await db.from("habit_checks").select("habit_id, day")
    .in("habit_id", habits.map((h) => h.id)).gte("day", since);
  if (checkError) fail(checkError);
  return { habits, checks: (checks ?? []).map((c: Row) => ({ habitId: c.habit_id, day: c.day })) };
}

export async function addHabit(session: AppSession, title: string, icon?: string | null): Promise<Habit> {
  const w = who(session);
  if (w.kind === "child") return (await call<{ habit: Habit }>(w.token, "habits.add", { title, icon: icon ?? null })).habit;
  const { data, error } = await getSafeSpaceClient().from("habits")
    .insert({ profile_id: w.profileId, title: title.trim(), icon: icon || null }).select(HABIT_COLS).single();
  if (error) fail(error);
  return toHabit(data!);
}

export async function archiveHabit(session: AppSession, habitId: string): Promise<void> {
  const w = who(session);
  if (w.kind === "child") {
    await call(w.token, "habits.archive", { habit_id: habitId });
    return;
  }
  const { data, error } = await getSafeSpaceClient().from("habits").update({ is_archived: true })
    .eq("id", habitId).eq("profile_id", w.profileId).select("id");
  if (error) fail(error);
  if (!data?.length) throw new ContractError("not_found");
}

// Ticks or unticks a day; doing it twice is harmless.
export async function setHabitCheck(session: AppSession, habitId: string, day: string, checked: boolean): Promise<void> {
  const w = who(session);
  if (w.kind === "child") {
    await call(w.token, "habits.set", { habit_id: habitId, day, checked });
    return;
  }
  const db = getSafeSpaceClient();
  const { error } = checked
    ? await db.from("habit_checks").upsert({ habit_id: habitId, day }, { onConflict: "habit_id,day", ignoreDuplicates: true })
    : await db.from("habit_checks").delete().eq("habit_id", habitId).eq("day", day);
  if (error) fail(error);
}

// ---------------------------------------------------------------------------
// Stars
// ---------------------------------------------------------------------------
export async function getStars(session: AppSession): Promise<StarTotals & { goal: StarGoal | null }> {
  const w = who(session);
  if (w.kind === "child") return call<StarTotals & { goal: StarGoal | null }>(w.token, "stars.get");
  const db = getSafeSpaceClient();
  const [events, goal] = await Promise.all([
    db.from("star_events").select("kind, stars").eq("profile_id", w.profileId),
    db.from("star_goals").select("title, target_stars, icon").eq("profile_id", w.profileId).maybeSingle(),
  ]);
  if (events.error) fail(events.error);
  if (goal.error) fail(goal.error);
  return {
    ...starTotalsOf(events.data ?? []),
    goal: goal.data ? { title: goal.data.title, targetStars: goal.data.target_stars, icon: goal.data.icon ?? null } : null,
  };
}

// One award per event key: the same key never earns twice.
export async function awardStars(session: AppSession, eventKey: string, stars = 1): Promise<StarTotals & { awarded: boolean }> {
  const w = who(session);
  if (w.kind === "child") return call<StarTotals & { awarded: boolean }>(w.token, "stars.award", { event_key: eventKey, stars });
  const db = getSafeSpaceClient();
  const { data, error } = await db.from("star_events")
    .upsert({ profile_id: w.profileId, event_key: eventKey, kind: "award", stars }, { onConflict: "profile_id,event_key", ignoreDuplicates: true })
    .select("id");
  if (error) fail(error);
  const { data: rows, error: totalError } = await db.from("star_events").select("kind, stars").eq("profile_id", w.profileId);
  if (totalError) fail(totalError);
  return { awarded: (data ?? []).length > 0, ...starTotalsOf(rows ?? []) };
}

export async function claimStarGoal(session: AppSession): Promise<{ claimed: boolean; currentStars: number }> {
  const w = who(session);
  if (w.kind === "child") return call<{ claimed: boolean; currentStars: number }>(w.token, "stars.claim");
  const { data, error } = await getSafeSpaceClient().rpc("claim_my_star_goal");
  if (error) fail(error);
  return data as { claimed: boolean; currentStars: number };
}

// Adults set their own goal (a child's is set by a caregiver, step 8f).
export async function setMyStarGoal(session: AppSession, goal: StarGoal): Promise<void> {
  const profileId = adultOnly(session);
  const { error } = await getSafeSpaceClient().from("star_goals").upsert(
    { profile_id: profileId, title: goal.title.trim(), target_stars: goal.targetStars, icon: goal.icon || null },
    { onConflict: "profile_id" },
  );
  if (error) fail(error);
}

// ---------------------------------------------------------------------------
// Feelings cards
// ---------------------------------------------------------------------------
export async function listEmotionChoices(session: AppSession): Promise<EmotionChoice[]> {
  const w = who(session);
  if (w.kind === "child") return (await call<{ choices: EmotionChoice[] }>(w.token, "emotions.list")).choices;
  const { data, error } = await getSafeSpaceClient().from("emotion_choices").select("id, card_id, created_at")
    .eq("profile_id", w.profileId).order("created_at", { ascending: false }).limit(20);
  if (error) fail(error);
  return (data ?? []).map(toEmotion);
}

export async function addEmotionChoice(session: AppSession, cardId: string): Promise<EmotionChoice> {
  const w = who(session);
  if (w.kind === "child") return (await call<{ choice: EmotionChoice }>(w.token, "emotions.add", { card_id: cardId })).choice;
  const { data, error } = await getSafeSpaceClient().from("emotion_choices")
    .insert({ profile_id: w.profileId, card_id: cardId }).select("id, card_id, created_at").single();
  if (error) fail(error);
  return toEmotion(data!);
}

// Adults only: children can't delete their feelings choices (like mood check-ins).
export async function clearMyEmotionChoices(session: AppSession): Promise<void> {
  const profileId = adultOnly(session);
  const { error } = await getSafeSpaceClient().from("emotion_choices").delete().eq("profile_id", profileId);
  if (error) fail(error);
}

// ---------------------------------------------------------------------------
// Tool settings
// ---------------------------------------------------------------------------
export async function getToolSettings(session: AppSession): Promise<ToolSettings> {
  const w = who(session);
  if (w.kind === "child") {
    const r = await call<Partial<ToolSettings>>(w.token, "settings.get");
    return { transitionPreset: r.transitionPreset ?? null, aacLabels: r.aacLabels ?? {}, music: r.music ?? DEFAULT_MUSIC_SETTINGS };
  }
  const { data, error } = await getSafeSpaceClient().from("tool_settings").select(SETTINGS_COLS)
    .eq("profile_id", w.profileId).maybeSingle();
  if (error) fail(error);
  // An adult's music has no controls on it.
  return { ...toSettings(data), music: DEFAULT_MUSIC_SETTINGS };
}

// Adults save their own (a child's are set by a caregiver, step 8f).
export async function saveMyToolSettings(session: AppSession, settings: Partial<ToolSettings>): Promise<void> {
  const profileId = adultOnly(session);
  const { music: _childOnly, ...mine } = settings;
  const row: Row = { profile_id: profileId, ...settingsRow(mine) };
  const { error } = await getSafeSpaceClient().from("tool_settings").upsert(row, { onConflict: "profile_id" });
  if (error) fail(error);
}

// ---------------------------------------------------------------------------
// Caregivers (role-flow 8f)
// ---------------------------------------------------------------------------

export interface ChildToolsOverview {
  sessions: FocusSessionRecordRow[]; // the last 60 days
  tasks: FocusTask[];                // not archived
  habits: Habit[];                   // not archived
  checks: HabitCheck[];              // the last 31 days
  stars: StarTotals & { goal: StarGoal | null };
  feelings: EmotionChoice[];         // the latest 20
}

// A child's tool activity for their caregiver, read under RLS: under 15
// always; from 15 only when the child shares (otherwise every list is empty,
// and the page shows its "chose not to share" note instead).
export async function getChildToolsOverview(childId: string): Promise<ChildToolsOverview> {
  const db = getSafeSpaceClient();
  const since = daysAgo(FOCUS_SESSION_HISTORY_DAYS).toISOString();
  const habitSince = daysAgo(HABIT_HISTORY_DAYS).toISOString().slice(0, 10);
  const [sessions, tasks, habits, stars, goal, feelings] = await Promise.all([
    db.from("focus_sessions").select(SESSION_COLS).eq("child_id", childId).gte("ended_at", since).order("ended_at", { ascending: false }).limit(500),
    db.from("focus_tasks").select(TASK_COLS).eq("child_id", childId).eq("is_archived", false).order("created_at", { ascending: false }),
    db.from("habits").select(HABIT_COLS).eq("child_id", childId).eq("is_archived", false).order("created_at", { ascending: true }),
    db.from("star_events").select("kind, stars").eq("child_id", childId),
    db.from("star_goals").select("title, target_stars, icon").eq("child_id", childId).maybeSingle(),
    db.from("emotion_choices").select("id, card_id, created_at").eq("child_id", childId).order("created_at", { ascending: false }).limit(20),
  ]);
  for (const r of [sessions, tasks, habits, stars, goal, feelings]) if (r.error) fail(r.error);
  const habitRows = (habits.data ?? []).map(toHabit);
  let checks: HabitCheck[] = [];
  if (habitRows.length) {
    const { data, error } = await db.from("habit_checks").select("habit_id, day")
      .in("habit_id", habitRows.map((h) => h.id)).gte("day", habitSince);
    if (error) fail(error);
    checks = (data ?? []).map((c: Row) => ({ habitId: c.habit_id, day: c.day }));
  }
  return {
    sessions: (sessions.data ?? []).map(toSession),
    tasks: (tasks.data ?? []).map(toTask),
    habits: habitRows,
    checks,
    stars: {
      ...starTotalsOf(stars.data ?? []),
      goal: goal.data ? { title: goal.data.title, targetStars: goal.data.target_stars, icon: goal.data.icon ?? null } : null,
    },
    feelings: (feelings.data ?? []).map(toEmotion),
  };
}

// The child's tool setup (any caregiver, whatever the sharing choice).
export async function getChildToolSetup(childId: string): Promise<{ goal: StarGoal | null; settings: ToolSettings }> {
  const db = getSafeSpaceClient();
  const [goal, settings] = await Promise.all([
    db.from("star_goals").select("title, target_stars, icon").eq("child_id", childId).maybeSingle(),
    db.from("tool_settings").select(SETTINGS_COLS).eq("child_id", childId).maybeSingle(),
  ]);
  if (goal.error) fail(goal.error);
  if (settings.error) fail(settings.error);
  return {
    goal: goal.data ? { title: goal.data.title, targetStars: goal.data.target_stars, icon: goal.data.icon ?? null } : null,
    settings: toSettings(settings.data),
  };
}

export async function setChildStarGoal(childId: string, goal: StarGoal): Promise<void> {
  const { error } = await getSafeSpaceClient().from("star_goals").upsert(
    { child_id: childId, title: goal.title.trim(), target_stars: goal.targetStars, icon: goal.icon || null },
    { onConflict: "child_id" },
  );
  if (error) fail(error);
}

export async function setChildToolSettings(childId: string, settings: Partial<ToolSettings>): Promise<void> {
  const row: Row = { child_id: childId, ...settingsRow(settings) };
  const { error } = await getSafeSpaceClient().from("tool_settings").upsert(row, { onConflict: "child_id" });
  if (error) fail(error);
}

// ---------------------------------------------------------------------------
// Safe Harbor calm plan (migration 20261030200000). The plan is four short
// lists the web app shapes and checks; this only carries it.
// ---------------------------------------------------------------------------
export interface CalmPlanData {
  signs: string[];
  helps: string[];
  people: string[];
  places: string[];
}

// Null when nothing is saved yet.
export async function getCalmPlan(session: AppSession): Promise<unknown | null> {
  const w = who(session);
  if (w.kind === "child") return (await call<{ plan: unknown }>(w.token, "calmPlan.get")).plan;
  const { data, error } = await getSafeSpaceClient().from("calm_plans").select("plan").eq("profile_id", w.profileId).maybeSingle();
  if (error) fail(error);
  return data?.plan ?? null;
}

export async function saveCalmPlan(session: AppSession, plan: CalmPlanData): Promise<void> {
  const w = who(session);
  if (w.kind === "child") {
    await call(w.token, "calmPlan.save", { plan });
    return;
  }
  const { error } = await getSafeSpaceClient().from("calm_plans").upsert({ profile_id: w.profileId, plan }, { onConflict: "profile_id" });
  if (error) fail(error);
}

// A caregiver reads a child's plan (null when there is none, or the child is
// 15 or over and hasn't chosen to share).
export async function getChildCalmPlan(childId: string): Promise<unknown | null> {
  const { data, error } = await getSafeSpaceClient().from("calm_plans").select("plan").eq("child_id", childId).maybeSingle();
  if (error) fail(error);
  return data?.plan ?? null;
}
