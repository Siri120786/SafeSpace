// packages/api-client/src/reminders.ts
// Reminders contract (docs/sprint-3/CONTRACTS.md section 4). IN-APP delivery
// only: schedules are stored, and the app works out what is due while open.
//   - Adults: reminders and acknowledgements directly under RLS.
//   - Caregivers: their children's reminders under RLS, by childId.
//   - Children: the `reminders` Edge Function (list, list_due, acknowledge).
//
// computeDueReminders is the exact due rule; it is identical to
// supabase/functions/_shared/reminders.ts (a parity test checks it) so web,
// the Edge Function and Flutter (which should mirror it) agree.

import { getSafeSpaceClient } from "./supabaseClient";
import { ContractError, invokeEdge, isValidDaysOfWeek, isValidLocalDate, isValidTimeOfDay, toContractError } from "./edge";
import { REMINDER_KINDS, REMINDER_TITLE_MAX_LENGTH } from "@safespace/shared-types";
import type {
  AppSession,
  CreateReminderInput,
  DueReminder,
  Reminder,
  ReminderKind,
  UpdateReminderInput,
} from "@safespace/shared-types";
import type { RoutineTarget } from "./routines";

const COLUMNS = "id, profile_id, child_id, kind, title, routine_id, time_of_day, days_of_week, timezone, is_enabled, created_at, updated_at";

// ---------------------------------------------------------------------------
// The due rule (pure)
// ---------------------------------------------------------------------------
interface LocalParts { year: number; month: number; day: number; hour: number; minute: number }

function localParts(instant: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") % 24, minute: get("minute") };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function zonedTimeToUtc(localDate: string, hhmm: string, timeZone: string): Date {
  const [y, mo, d] = localDate.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (t: number) => {
    const p = localParts(new Date(t), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - t;
  };
  let guess = wall - offsetAt(wall);
  const second = wall - offsetAt(guess);
  if (second !== guess) guess = second;
  return new Date(guess);
}

/**
 * Today's occurrences that are due by `now`: for each enabled reminder, the
 * current local date in ITS timezone, if that weekday is scheduled (or
 * daysOfWeek is empty) and the local time has reached timeOfDay.
 */
export function computeDueReminders(
  reminders: Reminder[],
  acknowledgements: { reminderId: string; occursOn: string }[],
  now: Date = new Date(),
): DueReminder[] {
  const acked = new Set(acknowledgements.map((a) => `${a.reminderId}|${a.occursOn}`));
  const due: DueReminder[] = [];
  for (const r of reminders) {
    if (!r.isEnabled || !isValidTimeZone(r.timezone)) continue;
    const p = localParts(now, r.timezone);
    const occursOn = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
    const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
    if (r.daysOfWeek.length > 0 && !r.daysOfWeek.includes(dow)) continue;
    const [h, m] = r.timeOfDay.split(":").map(Number);
    if (p.hour * 60 + p.minute < h * 60 + m) continue;
    due.push({
      reminder: r,
      dueAt: zonedTimeToUtc(occursOn, r.timeOfDay, r.timezone).toISOString(),
      occursOn,
      acknowledged: acked.has(`${r.id}|${occursOn}`),
    });
  }
  return due.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

// ---------------------------------------------------------------------------
// Mapping and validation
// ---------------------------------------------------------------------------
function toReminder(r: any): Reminder {
  return {
    id: r.id,
    profileId: r.profile_id,
    childId: r.child_id,
    kind: r.kind,
    title: r.title,
    routineId: r.routine_id,
    timeOfDay: String(r.time_of_day).slice(0, 5),
    daysOfWeek: r.days_of_week ?? [],
    timezone: r.timezone,
    isEnabled: r.is_enabled,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function cleanTitle(title: unknown): string {
  const t = typeof title === "string" ? title.trim() : "";
  if (!t) throw new ContractError("invalid_input");
  if (t.length > REMINDER_TITLE_MAX_LENGTH) throw new ContractError("content_too_long");
  return t;
}

function cleanKind(kind: unknown): ReminderKind {
  if (!(REMINDER_KINDS as readonly unknown[]).includes(kind)) throw new ContractError("invalid_input");
  return kind as ReminderKind;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Acknowledgements around "today" in any timezone (UTC date ±1).
function ackRange(now: Date) {
  return { from: isoDate(new Date(now.getTime() - 86_400_000)), to: isoDate(new Date(now.getTime() + 86_400_000)) };
}

async function selectReminders(filter: { column: "profile_id" | "child_id"; id: string }): Promise<Reminder[]> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.from("reminders").select(COLUMNS)
    .eq(filter.column, filter.id).order("time_of_day", { ascending: true });
  if (error) throw toContractError(error);
  return (data ?? []).map(toReminder);
}

async function selectAcks(reminderIds: string[], now: Date) {
  if (reminderIds.length === 0) return [];
  const { from, to } = ackRange(now);
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.from("reminder_acknowledgements")
    .select("reminder_id, occurs_on").in("reminder_id", reminderIds).gte("occurs_on", from).lte("occurs_on", to);
  if (error) throw toContractError(error);
  return (data ?? []).map((a: any) => ({ reminderId: a.reminder_id, occursOn: a.occurs_on }));
}

// ---------------------------------------------------------------------------
// Owner (adult or child) functions
// ---------------------------------------------------------------------------

export async function listReminders(session: AppSession): Promise<Reminder[]> {
  if (session?.kind === "child") {
    const data = await invokeEdge<{ reminders: Reminder[] }>("reminders", {
      action: "list", child_session_token: session.childSessionToken,
    });
    return data.reminders ?? [];
  }
  if (session?.kind === "auth_user") return selectReminders({ column: "profile_id", id: session.profile.id });
  throw new ContractError("unsupported_session");
}

/** Occurrences due today up to `now`, with acknowledged flags. Poll while the app is open. */
export async function getDueReminders(session: AppSession, now: Date = new Date()): Promise<DueReminder[]> {
  if (session?.kind === "child") {
    // The Edge Function uses the server clock.
    const data = await invokeEdge<{ due: DueReminder[] }>("reminders", {
      action: "list_due", child_session_token: session.childSessionToken,
    });
    return data.due ?? [];
  }
  if (session?.kind === "auth_user") {
    const reminders = await selectReminders({ column: "profile_id", id: session.profile.id });
    const acks = await selectAcks(reminders.map((r) => r.id), now);
    return computeDueReminders(reminders, acks, now);
  }
  throw new ContractError("unsupported_session");
}

/** Marks one occurrence (reminder + its local date) done or dismissed. Idempotent. */
export async function acknowledgeReminder(session: AppSession, reminderId: string, occursOn: string): Promise<void> {
  if (!isValidLocalDate(occursOn) || typeof reminderId !== "string" || !reminderId) throw new ContractError("invalid_input");
  if (session?.kind === "child") {
    await invokeEdge("reminders", {
      action: "acknowledge", reminder_id: reminderId, occurs_on: occursOn,
      child_session_token: session.childSessionToken,
    });
    return;
  }
  if (session?.kind !== "auth_user") throw new ContractError("unsupported_session");
  const supabase = getSafeSpaceClient();
  const { error } = await supabase.from("reminder_acknowledgements")
    .upsert({ reminder_id: reminderId, occurs_on: occursOn }, { onConflict: "reminder_id,occurs_on", ignoreDuplicates: true });
  if (error) throw toContractError(error);
}

// ---------------------------------------------------------------------------
// Management (adult for self, caregiver for a child)
// ---------------------------------------------------------------------------

export async function createReminder(target: RoutineTarget, input: CreateReminderInput): Promise<Reminder> {
  const kind = cleanKind(input?.kind);
  const title = cleanTitle(input?.title);
  if (!isValidTimeOfDay(input?.timeOfDay)) throw new ContractError("invalid_input");
  const days = input.daysOfWeek ?? [];
  if (!isValidDaysOfWeek(days)) throw new ContractError("invalid_input");
  if (!isValidTimeZone(input.timezone)) throw new ContractError("invalid_input");
  const routineId = input.routineId ?? null;
  if ((kind === "routine") !== (routineId !== null)) throw new ContractError("invalid_input");

  let owner: Record<string, string>;
  if (target?.kind === "child") owner = { child_id: target.childId };
  else if (target?.kind === "self") {
    const supabase = getSafeSpaceClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new ContractError("unsupported_session");
    owner = { profile_id: data.user.id };
  } else throw new ContractError("invalid_input");

  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.from("reminders").insert({
    ...owner,
    kind,
    title,
    routine_id: routineId,
    time_of_day: input.timeOfDay,
    days_of_week: [...days].sort(),
    timezone: input.timezone,
    is_enabled: input.isEnabled ?? true,
  }).select(COLUMNS).single();
  if (error) throw toContractError(error);
  return toReminder(data);
}

export async function updateReminder(reminderId: string, input: UpdateReminderInput): Promise<Reminder> {
  const patch: Record<string, unknown> = {};
  if (input?.title !== undefined) patch.title = cleanTitle(input.title);
  if (input?.timeOfDay !== undefined) {
    if (!isValidTimeOfDay(input.timeOfDay)) throw new ContractError("invalid_input");
    patch.time_of_day = input.timeOfDay;
  }
  if (input?.daysOfWeek !== undefined) {
    if (!isValidDaysOfWeek(input.daysOfWeek)) throw new ContractError("invalid_input");
    patch.days_of_week = [...input.daysOfWeek].sort();
  }
  if (input?.timezone !== undefined) {
    if (!isValidTimeZone(input.timezone)) throw new ContractError("invalid_input");
    patch.timezone = input.timezone;
  }
  if (input?.routineId !== undefined) patch.routine_id = input.routineId;
  if (input?.isEnabled !== undefined) {
    if (typeof input.isEnabled !== "boolean") throw new ContractError("invalid_input");
    patch.is_enabled = input.isEnabled;
  }
  if (Object.keys(patch).length === 0) throw new ContractError("invalid_input");
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.from("reminders").update(patch).eq("id", reminderId).select(COLUMNS).maybeSingle();
  if (error) throw toContractError(error);
  if (!data) throw new ContractError("not_found");
  return toReminder(data);
}

export async function deleteReminder(reminderId: string): Promise<void> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.from("reminders").delete().eq("id", reminderId).select("id");
  if (error) throw toContractError(error);
  if (!data || data.length === 0) throw new ContractError("not_found");
}

/** A caregiver's view of one child's reminders. */
export async function listChildReminders(childId: string): Promise<Reminder[]> {
  return selectReminders({ column: "child_id", id: childId });
}

/** Due-today occurrences for a caregiver's child (read-only view). */
export async function getChildDueReminders(childId: string, now: Date = new Date()): Promise<DueReminder[]> {
  const reminders = await selectReminders({ column: "child_id", id: childId });
  const acks = await selectAcks(reminders.map((r) => r.id), now);
  return computeDueReminders(reminders, acks, now);
}
