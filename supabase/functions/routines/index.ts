// supabase/functions/routines/index.ts
// Child-facing routines Edge Function: wiring only. Request logic lives in
// ./handler.ts. Uses the service role, scoped to the child_id derived from the
// verified child-session token.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { childSessionVerifier, sessionVersionLookup } from "../_shared/childSession.ts";
import { createRoutinesHandler, type ChildRoutinesStore } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Signature, expiry AND session version (a PIN reset ends sessions).
const verifyChildToken = childSessionVerifier(sessionVersionLookup(admin));

const log = (event: string, detail?: string) =>
  console.error(`routines: ${event}${detail ? ` (${detail})` : ""}`);

const store: ChildRoutinesStore = {
  async listRoutines(childId, date) {
    const { data, error } = await admin.from("routines")
      .select("id, profile_id, child_id, module_key, title, days_of_week, is_active, created_at, updated_at, " +
        "routine_steps(id, routine_id, label, scheduled_time, order_index, icon, routine_step_completions(completed_on))")
      .eq("child_id", childId)
      .eq("routine_steps.routine_step_completions.completed_on", date)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async childOwnsStep(childId, stepId) {
    const { data, error } = await admin.from("routine_steps")
      .select("id, routines!inner(child_id)")
      .eq("id", stepId)
      .eq("routines.child_id", childId)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  },

  async setCompletion(stepId, date, completed) {
    if (completed) {
      const { error } = await admin.from("routine_step_completions")
        .upsert({ step_id: stepId, completed_on: date }, { onConflict: "step_id,completed_on", ignoreDuplicates: true });
      if (error) throw error;
    } else {
      const { error } = await admin.from("routine_step_completions")
        .delete().eq("step_id", stepId).eq("completed_on", date);
      if (error) throw error;
    }
  },
};

serve(createRoutinesHandler({ store, verifyChildToken, log }));
