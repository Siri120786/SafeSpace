// supabase/functions/reset-child-pin/index.ts
// A primary caregiver resets a child's PIN: wiring only. Request logic lives in
// ./handler.ts. The caller's JWT is verified with the anon-key client; the
// service role (server only) authorises and writes through SQL functions.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashPin, verifyPin } from "../_shared/pin.ts";
import { createResetChildPinHandler, type ResetChildPinStore } from "./handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const log = (event: string, detail?: string) =>
  console.error(`reset-child-pin: ${event}${detail ? ` (${detail})` : ""}`);

async function getUserId(authorization: string): Promise<string | null> {
  const asCaller = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await asCaller.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

const store: ResetChildPinStore = {
  async roleFor(childId, caregiverId) {
    const { data, error } = await admin.rpc("caregiver_role_for_child", { p_child_id: childId, p_caregiver_id: caregiverId });
    if (error) throw error;
    return (data as "primary" | "co_caregiver" | null) ?? null;
  },

  async siblingPinHashes(childId) {
    const { data: child, error } = await admin.from("children").select("caregiver_id").eq("id", childId).maybeSingle();
    if (error) throw error;
    if (!child) return [];
    const { data, error: sibError } = await admin.from("children").select("pin_hash")
      .eq("caregiver_id", child.caregiver_id).neq("id", childId);
    if (sibError) throw sibError;
    return (data ?? []).map((r: { pin_hash: string }) => r.pin_hash);
  },

  async resetPin(childId, caregiverId, pinHash) {
    const { error } = await admin.rpc("reset_child_pin", { p_child_id: childId, p_caregiver_id: caregiverId, p_pin_hash: pinHash });
    if (error) throw error;
  },
};

serve(createResetChildPinHandler({ store, getUserId, hashPin, verifyPin, log }));
