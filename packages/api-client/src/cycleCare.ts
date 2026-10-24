// packages/api-client/src/cycleCare.ts
// Cycle Care (PCOS / PCOD) in the person's account: the chosen label, the
// diet plan, the health profile and the movement log. Only the signed-in
// adult can read or change their own row (RLS, migration 20261029300000).
// The web app shapes and checks each part; the database only checks that a
// part is an object of at most 64 KB.
// Errors: invalid_input, unsupported_session, and the usual contract codes.

import { getSafeSpaceClient } from "./supabaseClient";
import { ContractError, toContractError } from "./edge";
import type { AppSession } from "@safespace/shared-types";

export type CycleCarePart = "condition" | "diet" | "profile" | "exercise";

export interface CycleCareData {
  condition: string | null;
  diet: unknown;
  profile: unknown;
  exercise: unknown;
}

const EMPTY: CycleCareData = { condition: null, diet: null, profile: null, exercise: null };

function owner(session: AppSession): string {
  if (session?.kind === "auth_user" && session.profile?.id) return session.profile.id;
  throw new ContractError("unsupported_session");
}

// Everything saved (all null for someone who hasn't started).
export async function getCycleCareData(session: AppSession): Promise<CycleCareData> {
  const profileId = owner(session);
  const { data, error } = await getSafeSpaceClient().from("cycle_care_data")
    .select("condition, diet, profile, exercise").eq("profile_id", profileId).maybeSingle();
  if (error) throw toContractError(error);
  return data ? { condition: data.condition ?? null, diet: data.diet, profile: data.profile, exercise: data.exercise } : { ...EMPTY };
}

// Saves some parts; the others are left as they are.
export async function saveCycleCareParts(session: AppSession, parts: Partial<CycleCareData>): Promise<void> {
  const profileId = owner(session);
  const row: Record<string, unknown> = { profile_id: profileId };
  for (const k of ["condition", "diet", "profile", "exercise"] as const) {
    if (parts[k] !== undefined) row[k] = parts[k];
  }
  const { error } = await getSafeSpaceClient().from("cycle_care_data").upsert(row, { onConflict: "profile_id" });
  if (error) throw toContractError(error);
}

// Deletes all of it.
export async function deleteCycleCareData(session: AppSession): Promise<void> {
  const profileId = owner(session);
  const { error } = await getSafeSpaceClient().from("cycle_care_data").delete().eq("profile_id", profileId);
  if (error) throw toContractError(error);
}
