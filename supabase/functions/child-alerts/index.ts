// supabase/functions/child-alerts/index.ts
// "I need help": wiring only. Request logic lives in ./handler.ts. Uses the
// service role, scoped to the child_id from the verified child session.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { childSessionVerifier, sessionVersionLookup } from "../_shared/childSession.ts";
import { createChildAlertsHandler, type ChildAlertsStore } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Signature, expiry AND session version (a PIN reset ends sessions).
const verifyChildToken = childSessionVerifier(sessionVersionLookup(admin));

const log = (event: string, detail?: string) =>
  console.error(`child-alerts: ${event}${detail ? ` (${detail})` : ""}`);

const store: ChildAlertsStore = {
  async raiseHelp(childId) {
    const { data, error } = await admin.rpc("raise_help_alert", { p_child_id: childId });
    if (error) throw error;
    return data as string;
  },
};

serve(createChildAlertsHandler({ store, verifyChildToken, log }));
