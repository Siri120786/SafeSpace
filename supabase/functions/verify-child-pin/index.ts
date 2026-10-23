// supabase/functions/verify-child-pin/index.ts
// Child PIN sign-in: wiring only. Request logic lives in ./handler.ts. Uses
// the service role, which only ever runs here on the server.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyPin } from "../_shared/pin.ts";
import { signChildToken } from "../_shared/childToken.ts";
import { createVerifyChildPinHandler, type PinAttemptStore } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const log = (event: string, detail?: string) =>
  console.error(`verify-child-pin: ${event}${detail ? ` (${detail})` : ""}`);

const store: PinAttemptStore = {
  async beginAttempt(familyCode) {
    const { data, error } = await admin.rpc("pin_attempt_begin", { p_family_code: familyCode });
    if (error) throw error;
    return data === null ? null : Number(data);
  },

  async listFamilyChildren(familyCode) {
    const { data: caregiver, error } = await admin.from("caregivers")
      .select("id").eq("family_code", familyCode).maybeSingle();
    if (error) throw error;
    if (!caregiver) return [];
    const { data: kids, error: kidsError } = await admin.from("children")
      .select("id, pin_hash, session_version").eq("caregiver_id", caregiver.id);
    if (kidsError) throw kidsError;
    return kids ?? [];
  },

  async markSucceeded(attemptId) {
    const { data, error } = await admin.rpc("pin_attempt_succeeded", { p_attempt_id: attemptId });
    if (error) throw error;
    if (data !== true) throw Object.assign(new Error("attempt_not_marked"), { code: "attempt_not_marked" });
  },
};

serve(createVerifyChildPinHandler({ store, verifyPin, signChildToken, log }));
