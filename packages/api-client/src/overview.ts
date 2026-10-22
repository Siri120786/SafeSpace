// packages/api-client/src/overview.ts
// Caregiver dashboard card for one child (docs/sprint-3/CONTRACTS.md section 5).
// Everything is read with the caregiver's own RLS: the child must be theirs,
// the summary leaves out a partial-tier child's private notes, and
// dueRemindersToday counts the child's due-and-unacknowledged occurrences.

import { getSafeSpaceClient } from "./supabaseClient";
import { ContractError, toContractError } from "./edge";
import { getChildWellnessSummary, type WellnessOptions } from "./wellness";
import { getChildDueReminders } from "./reminders";
import type { Child, ChildOverview, ModuleKey, WellnessPeriodDays } from "@safespace/shared-types";

export async function getChildOverview(
  childId: string,
  periodDays: WellnessPeriodDays,
  options?: WellnessOptions & { now?: Date },
): Promise<ChildOverview> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase
    .from("children")
    .select("id, caregiver_id, name, age, privacy_tier, child_modules(module_key)")
    .eq("id", childId)
    .maybeSingle();
  if (error) throw toContractError(error);
  if (!data) throw new ContractError("not_found"); // not this caregiver's child

  const child: Child = {
    id: data.id,
    caregiverId: data.caregiver_id,
    name: data.name,
    age: data.age,
    privacyTier: data.privacy_tier,
    assignedModules: ((data as any).child_modules ?? []).map((m: { module_key: ModuleKey }) => m.module_key),
  };

  const [summary, due] = await Promise.all([
    getChildWellnessSummary(childId, periodDays, options),
    getChildDueReminders(childId, options?.now ?? new Date()),
  ]);

  return { child, summary, dueRemindersToday: due.filter((d) => !d.acknowledged).length };
}
