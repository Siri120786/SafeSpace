// supabase/functions/wellness-summary/index.ts
// Child-facing wellness summary Edge Function: wiring only. Request logic
// lives in ./handler.ts. Calls wellness_summary with the service role, scoped
// to the child_id derived from the verified child-session token.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { childSessionVerifier, sessionVersionLookup } from "../_shared/childSession.ts";
import { createWellnessSummaryHandler, type WellnessStore } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Signature, expiry AND session version (a PIN reset ends sessions).
const verifyChildToken = childSessionVerifier(sessionVersionLookup(admin));

const log = (event: string, detail?: string) =>
  console.error(`wellness-summary: ${event}${detail ? ` (${detail})` : ""}`);

const store: WellnessStore = {
  async summaryForChild(childId, to, periodDays, timezone) {
    const { data, error } = await admin.rpc("wellness_summary", {
      p_profile_id: null,
      p_child_id: childId,
      p_to: to,
      p_period_days: periodDays,
      p_timezone: timezone,
    });
    if (error) {
      if ((error.message ?? "").includes("invalid_input")) throw new Error("invalid_input");
      throw error;
    }
    return data;
  },
};

serve(createWellnessSummaryHandler({ store, verifyChildToken, log }));
