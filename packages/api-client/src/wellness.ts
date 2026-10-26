// packages/api-client/src/wellness.ts
// Wellness summary contract (docs/sprint-3/CONTRACTS.md section 5).
// Counts only: no scores, labels or journal text. Computed by the
// wellness_summary database function (20261024200000), which reads with the
// caller's RLS, so a caregiver's view of a child automatically leaves out a
// partial-tier child's private notes.
//   - Adults: own summary via RPC.
//   - Children: own summary via the `wellness-summary` Edge Function.
//   - Caregivers: getChildWellnessSummary(childId) via RPC under RLS.
// Days are the user's LOCAL dates; `to` and `timezone` default to the device.

import { getSafeSpaceClient } from "./supabaseClient";
import { ContractError, invokeEdge, isValidLocalDate, toContractError } from "./edge";
import type { AppSession, WellnessDay, WellnessPeriodDays, WellnessSummary } from "@safespace/shared-types";

export interface WellnessOptions {
  to?: string;        // local "YYYY-MM-DD"; default: today on this device
  timezone?: string;  // IANA name; default: this device's timezone
}

const pad = (n: number) => String(n).padStart(2, "0");

function resolveOptions(periodDays: unknown, options: WellnessOptions = {}) {
  if (periodDays !== 7 && periodDays !== 30) throw new ContractError("invalid_input");
  const now = new Date();
  const to = options.to ?? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timezone = options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!isValidLocalDate(to) || typeof timezone !== "string" || !timezone) throw new ContractError("invalid_input");
  return { periodDays: periodDays as WellnessPeriodDays, to, timezone };
}

async function rpcSummary(owner: { profileId?: string; childId?: string }, o: ReturnType<typeof resolveOptions>) {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.rpc("wellness_summary", {
    p_profile_id: owner.profileId ?? null,
    p_child_id: owner.childId ?? null,
    p_to: o.to,
    p_period_days: o.periodDays,
    p_timezone: o.timezone,
  });
  if (error) throw toContractError(error);
  return data as WellnessSummary;
}

/** The signed-in adult's or child's own summary for the last 7 or 30 days. */
export async function getWellnessSummary(
  session: AppSession,
  periodDays: WellnessPeriodDays,
  options?: WellnessOptions,
): Promise<WellnessSummary> {
  const o = resolveOptions(periodDays, options);
  if (session?.kind === "child") {
    const data = await invokeEdge<{ summary: WellnessSummary }>("wellness-summary", {
      action: "get",
      child_session_token: session.childSessionToken,
      period_days: o.periodDays,
      to: o.to,
      timezone: o.timezone,
    });
    return data.summary;
  }
  if (session?.kind === "auth_user") return rpcSummary({ profileId: session.profile.id }, o);
  throw new ContractError("unsupported_session");
}

/**
 * A caregiver's summary of one of their children (private notes of a
 * partial-tier child excluded by RLS). For a child that isn't theirs, the
 * database returns zeros, never the child's data.
 */
export async function getChildWellnessSummary(
  childId: string,
  periodDays: WellnessPeriodDays,
  options?: WellnessOptions,
): Promise<WellnessSummary> {
  return rpcSummary({ childId }, resolveOptions(periodDays, options));
}

/**
 * A caregiver's day-by-day timeline of one child (wellness_daily, migration
 * 20261031100000): one row per local day, oldest first, ending today. Read
 * under RLS, so a child who doesn't share activity reads as empty days.
 */
export async function getChildWellnessDaily(
  childId: string,
  periodDays: WellnessPeriodDays,
  options?: WellnessOptions,
): Promise<WellnessDay[]> {
  const o = resolveOptions(periodDays, options);
  const { data, error } = await getSafeSpaceClient().rpc("wellness_daily", {
    p_profile_id: null,
    p_child_id: childId,
    p_to: o.to,
    p_period_days: o.periodDays,
    p_timezone: o.timezone,
  });
  if (error) throw toContractError(error);
  return (data ?? []) as WellnessDay[];
}
