// packages/api-client/src/children.ts
// Caregiver-side child profile management. Every read here is subject to the
// RLS policies in supabase/migrations/0001_init_schema.sql — this file does
// not, and must not, apply its own filtering logic on top. If a caregiver
// query ever needs "extra" filtering beyond what RLS already does, that's a
// signal the policy is incomplete, not that this file should patch around it.

import { getSafeSpaceClient } from "./supabaseClient";
import type { Child, ModuleKey, ChildSession } from "@safespace/shared-types";

export async function listMyChildren(): Promise<Child[]> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase
    .from("children")
    .select("id, caregiver_id, name, age, privacy_tier, child_modules(module_key)");
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    caregiverId: row.caregiver_id,
    name: row.name,
    age: row.age,
    privacyTier: row.privacy_tier,
    assignedModules: (row.child_modules ?? []).map((m: any) => m.module_key),
  }));
}

// The code a child's device enters once so their PIN can be matched to the right
// family. Caregivers read their own row (RLS allows it).
export async function getMyFamilyCode(): Promise<string> {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.from("caregivers").select("family_code").single();
  if (error) throw error;
  return data.family_code as string;
}

export async function addChild(input: {
  name: string;
  age: number;
  pin: string;
  modules: ModuleKey[];
}): Promise<string> {
  // PIN hashing happens server-side in the create-child Edge Function, never
  // here. The client only ever sends the raw PIN over TLS.
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.functions.invoke("create-child", {
    body: { name: input.name, age: input.age, pin: input.pin, modules: input.modules },
  });
  if (error) throw error;
  return data.child_id as string;
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
  return data.child as Child;
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

export function submitJournalEntry(session: ChildSession, text: string) {
  return callAiOrchestrator(session, "journaling", { text });
}

export function generateStory(session: ChildSession, context: Record<string, unknown>) {
  return callAiOrchestrator(session, "stories", context);
}

// ----------------------------------------------------------------------------
// Routines — data only, deliberately implemented with plain table access,
// NOT via callAiOrchestrator. See docs/Architecture_Specification.md §6:
// "Routines is the only feature that never touches AI services."
// ----------------------------------------------------------------------------
export async function listRoutineSteps(childId: string) {
  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase
    .from("routine_steps")
    .select("*")
    .eq("child_id", childId)
    .order("order_index");
  if (error) throw error;
  return data;
}

export async function markRoutineStepComplete(stepId: string, isComplete: boolean) {
  const supabase = getSafeSpaceClient();
  const { error } = await supabase
    .from("routine_steps")
    .update({ is_complete: isComplete })
    .eq("id", stepId);
  if (error) throw error;
}
