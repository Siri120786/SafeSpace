// packages/api-client/src/routines.ts
// Routines contract (docs/sprint-3/CONTRACTS.md section 3).
//   - Adults: tables directly under RLS (20261024000000_routines.sql).
//   - Caregivers: their children's routines under RLS, by childId.
//   - Children: the `routines` Edge Function (they have no Supabase login),
//     which can only list routines and tick steps.
// Creating a routine with its steps and reordering steps go through
// SECURITY INVOKER database functions, so each is atomic and RLS still applies.

import { getSafeSpaceClient } from "./supabaseClient";
import {
  ContractError,
  invokeEdge,
  isValidDaysOfWeek,
  isValidLocalDate,
  isValidTimeOfDay,
  toContractError,
} from "./edge";
import type {
  AppSession,
  CreateRoutineInput,
  ModuleKey,
  Routine,
  RoutineStep,
  RoutineWithSteps,
  UpdateRoutineInput,
} from "@safespace/shared-types";

export type RoutineTarget = { kind: "self" } | { kind: "child"; childId: string };

const TITLE_MAX = 80;
const LABEL_MAX = 120;
const COMPLETION_WINDOW_DAYS_BACK = 6;

const ROUTINE_COLUMNS = "id, profile_id, child_id, module_key, title, days_of_week, is_active, created_at, updated_at";
const STEP_COLUMNS = "id, routine_id, label, scheduled_time, order_index";

// ---------------------------------------------------------------------------
// Mapping and validation
// ---------------------------------------------------------------------------
function toRoutine(r: any): Routine {
  return {
    id: r.id,
    profileId: r.profile_id,
    childId: r.child_id,
    moduleKey: r.module_key,
    title: r.title,
    daysOfWeek: r.days_of_week ?? [],
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toStep(s: any): RoutineStep {
  return {
    id: s.id,
    routineId: s.routine_id,
    label: s.label,
    scheduledTime: s.scheduled_time ? String(s.scheduled_time).slice(0, 5) : null,
    orderIndex: s.order_index,
  };
}

function dayOfWeek(localDate: string): number {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Same rule as the Edge Function: empty daysOfWeek means every day.
export function isRoutineScheduledOn(daysOfWeek: number[], localDate: string): boolean {
  return daysOfWeek.length === 0 || daysOfWeek.includes(dayOfWeek(localDate));
}

function shapeForDate(rows: any[], date: string): RoutineWithSteps[] {
  return rows
    .filter((r) => r.is_active && isRoutineScheduledOn(r.days_of_week ?? [], date))
    .map((r) => ({
      ...toRoutine(r),
      steps: [...(r.routine_steps ?? [])]
        .sort((a, b) => a.order_index - b.order_index)
        .map((s) => ({
          ...toStep(s),
          completedOnDate: (s.routine_step_completions ?? []).some((c: any) => c.completed_on === date),
        })),
    }));
}

function cleanTitle(title: unknown): string {
  const t = typeof title === "string" ? title.trim() : "";
  if (!t || t.length > TITLE_MAX) throw new ContractError(t.length > TITLE_MAX ? "content_too_long" : "invalid_input");
  return t;
}

function cleanLabel(label: unknown): string {
  const t = typeof label === "string" ? label.trim() : "";
  if (!t || t.length > LABEL_MAX) throw new ContractError(t.length > LABEL_MAX ? "content_too_long" : "invalid_input");
  return t;
}

function cleanTime(time: unknown): string | null {
  if (time === undefined || time === null || time === "") return null;
  if (!isValidTimeOfDay(time)) throw new ContractError("invalid_input");
  return time;
}

function cleanDays(days: unknown): number[] {
  if (days === undefined) return [];
  if (!isValidDaysOfWeek(days)) throw new ContractError("invalid_input");
  return [...days].sort();
}

function requireDate(date: unknown): string {
  if (!isValidLocalDate(date)) throw new ContractError("invalid_input");
  return date;
}

// Today (local) or up to 6 days back; no future dates.
function requireCompletionDate(date: unknown): string {
  const d = requireDate(date);
  const now = new Date();
  const todayLocal = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, day] = d.split("-").map(Number);
  const diff = (Date.UTC(y, m - 1, day) - todayLocal) / 86_400_000;
  if (diff > 0 || diff < -COMPLETION_WINDOW_DAYS_BACK) throw new ContractError("invalid_input");
  return d;
}

const ROUTINES_WITH_STEPS = `${ROUTINE_COLUMNS}, routine_steps(${STEP_COLUMNS}, routine_step_completions(completed_on))`;

async function selectRoutinesForDate(filter: { column: "profile_id" | "child_id"; id: string }, date: string) {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase
    .from("routines")
    .select(ROUTINES_WITH_STEPS)
    .eq(filter.column, filter.id)
    .eq("routine_steps.routine_step_completions.completed_on", date)
    .order("created_at", { ascending: true });
  if (error) throw toContractError(error);
  return shapeForDate(data ?? [], date);
}

// ---------------------------------------------------------------------------
// Owner (adult or child) functions
// ---------------------------------------------------------------------------

/** Routines scheduled on `date` (local YYYY-MM-DD), with per-step progress. */
export async function listMyRoutines(session: AppSession, options: { date: string }): Promise<RoutineWithSteps[]> {
  const date = requireDate(options?.date);
  if (session?.kind === "child") {
    const data = await invokeEdge<{ routines: RoutineWithSteps[] }>("routines", {
      action: "list", date, child_session_token: session.childSessionToken,
    });
    return data.routines ?? [];
  }
  if (session?.kind === "auth_user") return selectRoutinesForDate({ column: "profile_id", id: session.profile.id }, date);
  throw new ContractError("unsupported_session");
}

/** Marks a step done (or not done) for a local date. Idempotent. */
export async function setRoutineStepCompleted(
  session: AppSession,
  stepId: string,
  date: string,
  completed: boolean,
): Promise<void> {
  const day = requireCompletionDate(date);
  if (typeof stepId !== "string" || !stepId || typeof completed !== "boolean") throw new ContractError("invalid_input");

  if (session?.kind === "child") {
    await invokeEdge("routines", {
      action: "set_step_completed", step_id: stepId, date: day, completed,
      child_session_token: session.childSessionToken,
    });
    return;
  }
  if (session?.kind !== "auth_user") throw new ContractError("unsupported_session");

  const supabase = getSafeSpaceClient();
  if (completed) {
    const { error } = await supabase
      .from("routine_step_completions")
      .upsert({ step_id: stepId, completed_on: day }, { onConflict: "step_id,completed_on", ignoreDuplicates: true });
    if (error) throw toContractError(error);
  } else {
    const { error } = await supabase
      .from("routine_step_completions")
      .delete()
      .eq("step_id", stepId)
      .eq("completed_on", day);
    if (error) throw toContractError(error);
  }
}

// ---------------------------------------------------------------------------
// Management (adult for self, caregiver for a child)
// ---------------------------------------------------------------------------

async function getRoutineWithSteps(routineId: string): Promise<RoutineWithSteps> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase
    .from("routines")
    .select(`${ROUTINE_COLUMNS}, routine_steps(${STEP_COLUMNS})`)
    .eq("id", routineId)
    .maybeSingle();
  if (error) throw toContractError(error);
  if (!data) throw new ContractError("not_found");
  return {
    ...toRoutine(data),
    steps: [...((data as any).routine_steps ?? [])]
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((s: any) => ({ ...toStep(s), completedOnDate: false })),
  };
}

export async function createRoutine(target: RoutineTarget, input: CreateRoutineInput): Promise<RoutineWithSteps> {
  const title = cleanTitle(input?.title);
  const days = cleanDays(input?.daysOfWeek);
  if (!Array.isArray(input?.steps)) throw new ContractError("invalid_input");
  const steps = input.steps.map((s) => ({ label: cleanLabel(s?.label), scheduled_time: cleanTime(s?.scheduledTime) }));
  const childId = target?.kind === "child" ? target.childId : target?.kind === "self" ? null : undefined;
  if (childId === undefined) throw new ContractError("invalid_input");

  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.rpc("create_routine_with_steps", {
    p_child_id: childId,
    p_title: title,
    p_module_key: input.moduleKey ?? null,
    p_days_of_week: days,
    p_steps: steps,
  });
  if (error) throw toContractError(error);
  return getRoutineWithSteps(data as string);
}

export async function updateRoutine(routineId: string, input: UpdateRoutineInput): Promise<Routine> {
  const patch: Record<string, unknown> = {};
  if (input?.title !== undefined) patch.title = cleanTitle(input.title);
  if (input?.daysOfWeek !== undefined) patch.days_of_week = cleanDays(input.daysOfWeek);
  if (input?.moduleKey !== undefined) patch.module_key = input.moduleKey as ModuleKey | null;
  if (input?.isActive !== undefined) {
    if (typeof input.isActive !== "boolean") throw new ContractError("invalid_input");
    patch.is_active = input.isActive;
  }
  if (Object.keys(patch).length === 0) throw new ContractError("invalid_input");

  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.from("routines").update(patch).eq("id", routineId).select(ROUTINE_COLUMNS).maybeSingle();
  if (error) throw toContractError(error);
  if (!data) throw new ContractError("not_found");
  return toRoutine(data);
}

export async function deleteRoutine(routineId: string): Promise<void> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.from("routines").delete().eq("id", routineId).select("id");
  if (error) throw toContractError(error);
  if (!data || data.length === 0) throw new ContractError("not_found");
}

export async function addRoutineStep(
  routineId: string,
  input: { label: string; scheduledTime?: string | null },
): Promise<RoutineStep> {
  const label = cleanLabel(input?.label);
  const scheduledTime = cleanTime(input?.scheduledTime);
  const supabase = getSafeSpaceClient();
  const { data: last, error: lastErr } = await supabase
    .from("routine_steps").select("order_index").eq("routine_id", routineId)
    .order("order_index", { ascending: false }).limit(1);
  if (lastErr) throw toContractError(lastErr);
  const nextIndex = last && last.length ? (last[0] as any).order_index + 1 : 0;
  const { data, error } = await supabase
    .from("routine_steps")
    .insert({ routine_id: routineId, label, scheduled_time: scheduledTime, order_index: nextIndex })
    .select(STEP_COLUMNS).single();
  if (error) throw toContractError(error);
  return toStep(data);
}

export async function updateRoutineStep(
  stepId: string,
  input: { label?: string; scheduledTime?: string | null },
): Promise<RoutineStep> {
  const patch: Record<string, unknown> = {};
  if (input?.label !== undefined) patch.label = cleanLabel(input.label);
  if (input?.scheduledTime !== undefined) patch.scheduled_time = cleanTime(input.scheduledTime);
  if (Object.keys(patch).length === 0) throw new ContractError("invalid_input");
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.from("routine_steps").update(patch).eq("id", stepId).select(STEP_COLUMNS).maybeSingle();
  if (error) throw toContractError(error);
  if (!data) throw new ContractError("not_found");
  return toStep(data);
}

/** stepIds must list every step of the routine exactly once, in the new order. */
export async function reorderRoutineSteps(routineId: string, stepIds: string[]): Promise<void> {
  if (!Array.isArray(stepIds) || stepIds.length === 0 || new Set(stepIds).size !== stepIds.length) {
    throw new ContractError("invalid_input");
  }
  const supabase = getSafeSpaceClient();
  const { error } = await supabase.rpc("reorder_routine_steps", { p_routine_id: routineId, p_step_ids: stepIds });
  if (error) throw toContractError(error);
}

export async function deleteRoutineStep(stepId: string): Promise<void> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.from("routine_steps").delete().eq("id", stepId).select("id");
  if (error) throw toContractError(error);
  if (!data || data.length === 0) throw new ContractError("not_found");
}

// ---------------------------------------------------------------------------
// Caregiver view
// ---------------------------------------------------------------------------

/** A caregiver's view of one child's routines scheduled on `date`. */
export async function listChildRoutines(childId: string, options: { date: string }): Promise<RoutineWithSteps[]> {
  const date = requireDate(options?.date);
  return selectRoutinesForDate({ column: "child_id", id: childId }, date);
}
