// packages/api-client/src/edge.ts
// Shared helpers for Sprint 3 api-client modules: calling child-facing Edge
// Functions, and turning database / function errors into the contract's error
// codes (docs/sprint-3/CONTRACTS.md, "Common errors").

import { getSafeSpaceClient } from "./supabaseClient";

export class ContractError extends Error {}

// Invokes an Edge Function; non-2xx responses carry { error: code } in the
// body, which becomes the thrown error's message.
export async function invokeEdge<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    throw new ContractError(payload?.error ?? error.message);
  }
  return data as T;
}

// Maps a PostgREST / Postgres error to a contract error code.
export function toContractError(error: { code?: string; message?: string } | null | undefined): ContractError {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (message.includes("completion_date_out_of_range") || message.includes("invalid_input")) {
    return new ContractError("invalid_input");
  }
  if (message.includes("private_note_not_allowed_for_privacy_tier")) {
    return new ContractError("private_note_not_allowed_for_privacy_tier");
  }
  // 23514 check violation, 23502 not-null, 22P02 bad text representation,
  // 22007/22008 bad date or time.
  if (["23514", "23502", "22P02", "22007", "22008", "23503"].includes(code)) return new ContractError("invalid_input");
  // RLS refusal or no visible row: indistinguishable from "doesn't exist".
  if (code === "42501" || code === "PGRST116") return new ContractError("not_found");
  return new ContractError(message || "unknown_error");
}

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export function isValidLocalDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function isValidTimeOfDay(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidDaysOfWeek(value: unknown): value is number[] {
  return Array.isArray(value) &&
    value.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    new Set(value).size === value.length;
}
