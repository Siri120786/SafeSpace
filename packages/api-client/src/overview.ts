// packages/api-client/src/overview.ts
// Caregiver dashboard card for one child (docs/role-flow/CONTRACT.md section 9).
// Read with the caregiver's own RLS: the caller must be one of the child's
// caregivers. When the young person (15+) has chosen not to share, their
// activity is hidden: summary and dueRemindersToday are null, and the card
// says so instead of showing an empty week.

import { getSafeSpaceClient } from "./supabaseClient";
import { ContractError, toContractError } from "./edge";
import { getChildWellnessSummary, type WellnessOptions } from "./wellness";
import { getChildDueReminders } from "./reminders";
import { CHILD_COLUMNS, currentUserId, toChild, type ChildRow } from "./children";
import { activityVisibility } from "./childSharing";
import type { ChildOverview, WellnessPeriodDays } from "@safespace/shared-types";

export async function getChildOverview(
  childId: string,
  periodDays: WellnessPeriodDays,
  options?: WellnessOptions & { now?: Date },
): Promise<ChildOverview> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.from("children").select(CHILD_COLUMNS).eq("id", childId).maybeSingle();
  if (error) throw toContractError(error);
  if (!data) throw new ContractError("not_found"); // not one of the caller's children

  const now = options?.now ?? new Date();
  const child = toChild(data as ChildRow, await currentUserId(), now);
  const activity = activityVisibility(child.sharing);
  // Alerts are never gated by the sharing choice.
  const { count, error: alertError } = await supabase.from("emergency_events")
    .select("id", { count: "exact", head: true })
    .eq("child_id", childId).is("reviewed_at", null);
  if (alertError) throw toContractError(alertError);
  const unreviewedAlerts = count ?? 0;
  if (!activity.visible) return { child, activity, summary: null, dueRemindersToday: null, unreviewedAlerts };

  const [summary, due] = await Promise.all([
    getChildWellnessSummary(childId, periodDays, options),
    getChildDueReminders(childId, now),
  ]);
  return { child, activity, summary, dueRemindersToday: due.filter((d) => !d.acknowledged).length, unreviewedAlerts };
}
