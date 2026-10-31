// supabase/functions/emergency-escalation/index.ts
// A child's safety alert from text they wrote: wiring only. Request logic
// lives in ./handler.ts; the check and alert step in ../_shared/safety.ts.
// Uses the service role, scoped to the child_id from the verified child
// session, and only through raise_safety_alert (migration 20261031000000).
// Delivery is in-app: the alert shows on the caregivers' Alerts page. No
// email, SMS or push yet (that needs a provider account).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { childSessionVerifier, sessionVersionLookup } from "../_shared/childSession.ts";
import { createEscalationHandler } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Signature, expiry AND session version (a PIN reset ends sessions).
const verifyChildToken = childSessionVerifier(sessionVersionLookup(admin));

const log = (event: string, detail?: string) =>
  console.error(`emergency-escalation: ${event}${detail ? ` (${detail})` : ""}`);

serve(createEscalationHandler({
  verifyChildToken,
  log,
  async raiseSafetyAlert(childId, source) {
    const { data, error } = await admin.rpc("raise_safety_alert", { p_child_id: childId, p_source: source });
    if (error) throw error;
    return data as string;
  },
}));
