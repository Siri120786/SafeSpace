// packages/api-client/src/children.ts
// Caregiver-side child profile management. Every read here is subject to RLS
// (any caregiver of the child, 20261027000000_child_caregivers.sql); this file
// does not, and must not, apply its own access filtering on top. Children are
// created and changed only through server functions (create-child,
// update_child, set_child_modules).

import { getSafeSpaceClient } from "./supabaseClient";
import { ContractError, invokeEdge, toContractError } from "./edge";
import { childAgeYears, childSharingStatus, isValidChildBirth } from "./childSharing";
import {
  MODULE_KEYS,
  type Child,
  type ChildSession,
  type ChildTheme,
  type CreateChildInput,
  type ModuleKey,
  type UpdateChildInput,
} from "@safespace/shared-types";

export const CHILD_COLUMNS =
  "id, caregiver_id, name, birth_year, birth_month, shares_with_caregiver, theme, low_sensory_default, child_modules(module_key)";

export interface ChildRow {
  id: string;
  caregiver_id: string;
  name: string;
  birth_year: number;
  birth_month: number;
  shares_with_caregiver: boolean | null;
  theme: ChildTheme | null;
  low_sensory_default: boolean;
  child_modules?: { module_key: ModuleKey }[] | null;
}

// myUserId: the signed-in caregiver, to say whether they are the primary.
export function toChild(row: ChildRow, myUserId?: string | null, now: Date = new Date()): Child {
  const ageYears = childAgeYears(row.birth_year, row.birth_month, now);
  return {
    id: row.id,
    caregiverId: row.caregiver_id,
    name: row.name,
    birthYear: row.birth_year,
    birthMonth: row.birth_month,
    ageYears,
    sharing: childSharingStatus(ageYears, row.shares_with_caregiver),
    theme: row.theme,
    lowSensoryDefault: row.low_sensory_default,
    assignedModules: (row.child_modules ?? []).map((m) => m.module_key),
    ...(myUserId ? { myRole: row.caregiver_id === myUserId ? "primary" as const : "co_caregiver" as const } : {}),
  };
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await getSafeSpaceClient().auth.getSession();
  return data.session?.user.id ?? null;
}

// Every child the signed-in caregiver cares for (as primary or co-caregiver).
export async function listMyChildren(): Promise<Child[]> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.from("children").select(CHILD_COLUMNS).order("created_at", { ascending: true });
  if (error) throw toContractError(error);
  const me = await currentUserId();
  return ((data ?? []) as ChildRow[]).map((row) => toChild(row, me));
}

// The signed-in caregiver's own family code. For the code a particular child
// signs in with (the primary's), use getChildFamilyCode(childId).
export async function getMyFamilyCode(): Promise<string> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.from("caregivers").select("family_code").single();
  if (error) throw error;
  return data.family_code as string;
}

// The caller becomes the child's primary caregiver. PIN hashing happens
// server-side in the create-child Edge Function; the client only sends the raw
// PIN over TLS. Failures throw a ContractError carrying the function's code
// (invalid_request, pin_already_used_in_family, not_a_caregiver).
export async function addChild(input: CreateChildInput): Promise<string> {
  if (!isValidChildBirth(input.birthYear, input.birthMonth)) throw new ContractError("invalid_input");
  const data = await invokeEdge<{ child_id: string }>("create-child", {
    name: input.name,
    birthYear: input.birthYear,
    birthMonth: input.birthMonth,
    pin: input.pin,
    modules: input.modules,
  });
  return data.child_id;
}

// Name and birth month/year: primary caregiver only (not_primary_caregiver).
// Theme and low-sensory default: any caregiver. Omitted fields are unchanged;
// theme null clears it.
export async function updateChild(
  childId: string,
  input: UpdateChildInput & { theme?: ChildTheme | null; lowSensoryDefault?: boolean },
): Promise<void> {
  if ((input.birthYear !== undefined || input.birthMonth !== undefined) &&
      (input.birthYear === undefined || input.birthMonth === undefined || !isValidChildBirth(input.birthYear, input.birthMonth))) {
    throw new ContractError("invalid_input");
  }
  const { error } = await getSafeSpaceClient().rpc("update_child", {
    p_child_id: childId,
    p_name: input.name ?? null,
    p_birth_year: input.birthYear ?? null,
    p_birth_month: input.birthMonth ?? null,
    p_theme: input.theme === undefined ? null : input.theme === null ? "" : input.theme,
    p_low_sensory_default: input.lowSensoryDefault ?? null,
  });
  if (error) throw toContractError(error);
}

// Any caregiver. Replaces the child's whole module list.
export async function setChildModules(childId: string, modules: ModuleKey[]): Promise<void> {
  if (!Array.isArray(modules) || modules.some((m) => !(MODULE_KEYS as readonly string[]).includes(m))) {
    throw new ContractError("invalid_input");
  }
  const { error } = await getSafeSpaceClient().rpc("set_child_modules", { p_child_id: childId, p_modules: modules });
  if (error) throw toContractError(error);
}

// ----------------------------------------------------------------------------
// Child-side: fetch the child's OWN profile via their scoped session token.
// This is a separate code path from listMyChildren() above (which is
// caregiver-side and relies on Supabase Auth + RLS) — a child has no
// auth.users row, so this goes through an Edge Function that resolves the
// child_session_token instead. See supabase/functions/get-child-profile
// .
// ----------------------------------------------------------------------------
export async function getMyChildProfile(session: ChildSession): Promise<Child> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.functions.invoke("get-child-profile", {
    body: { child_session_token: session.childSessionToken },
  });
  if (error) throw error;
  return data.child as Child;   // get-child-profile already returns the Child shape
}

// ----------------------------------------------------------------------------
// AI-gated shared features — routes through the ai-orchestrator Edge Function.
// Mirrors the allow-list in supabase/functions/ai-orchestrator/index.ts:
// only journaling, stories, and emergency go through here. Routines has its
// own plain-data functions below and NEVER imports from this section.
// ----------------------------------------------------------------------------
async function callAiOrchestrator(
  session: ChildSession,
  feature: "journaling" | "stories" | "emergency",
  payload: Record<string, unknown>,
) {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
    body: { feature, child_session_token: session.childSessionToken, payload },
  });
  if (error) throw error;
  return data.result;
}

/**
 * @deprecated Calls the ai-orchestrator placeholder and stores nothing.
 * Use `createJournalEntry` (./journal.ts), which saves the entry and never
 * sends it to AI (Sprint 3 contract).
 */
export function submitJournalEntry(session: ChildSession, text: string) {
  return callAiOrchestrator(session, "journaling", { text });
}

export function generateStory(session: ChildSession, context: Record<string, unknown>) {
  return callAiOrchestrator(session, "stories", context);
}

// ----------------------------------------------------------------------------
// Routines moved to ./routines.ts (Sprint 3): routines with ordered steps and
// per-day completion. Still data only: routines never call AI services
// (docs/Architecture_Specification.md §6).
// ----------------------------------------------------------------------------
