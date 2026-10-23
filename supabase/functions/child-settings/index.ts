// supabase/functions/child-settings/index.ts
// A child's own settings: wiring only. Request logic lives in ./handler.ts.
// Uses the service role, scoped to the child_id from the verified token.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyChildToken } from "../_shared/childToken.ts";
import { createChildSettingsHandler, type ChildSettingsStore } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const log = (event: string, detail?: string) =>
  console.error(`child-settings: ${event}${detail ? ` (${detail})` : ""}`);

const store: ChildSettingsStore = {
  async getChild(childId) {
    const { data, error } = await admin.from("children")
      .select("birth_year, birth_month, shares_with_caregiver, sharing_decided_at")
      .eq("id", childId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async setSharing(childId, share) {
    const { error } = await admin.rpc("set_child_sharing", { p_child_id: childId, p_share: share });
    if (error) throw error;
  },
};

serve(createChildSettingsHandler({ store, verifyChildToken, log }));
