// supabase/functions/recommendations/index.ts
// Rule-based suggestions: wiring only. Request logic lives in ./handler.ts.
// Children: service role, scoped to the child_id from the verified child
// session. Adults: a client carrying their own JWT, so their reads run under
// their own RLS (wellness_summary is SECURITY INVOKER).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { childSessionVerifier, sessionVersionLookup } from "../_shared/childSession.ts";
import { createRecommendationsHandler, type Owner, type RecommendationsStore } from "./handler.ts";
import type { SummaryCounts } from "../_shared/recommendations.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Signature, expiry AND session version (a PIN reset ends sessions).
const verifyChildToken = childSessionVerifier(sessionVersionLookup(admin));

const log = (event: string, detail?: string) =>
  console.error(`recommendations: ${event}${detail ? ` (${detail})` : ""}`);

function adultClient(authorization: string): SupabaseClient {
  return createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });
}

async function authenticateAdult(authorization: string): Promise<string | null> {
  if (!Deno.env.get("SUPABASE_ANON_KEY")) return null;
  const { data, error } = await adultClient(authorization).auth.getUser();
  return error || !data.user ? null : data.user.id;
}

const store: RecommendationsStore = {
  async summary(owner: Owner, to: string, timezone: string) {
    const client = owner.kind === "child" ? admin : adultClient(owner.authorization);
    const { data, error } = await client.rpc("wellness_summary", {
      p_profile_id: owner.kind === "adult" ? owner.profileId : null,
      p_child_id: owner.kind === "child" ? owner.childId : null,
      p_to: to,
      p_period_days: 7,
      p_timezone: timezone,
    });
    if (error) {
      if ((error.message ?? "").includes("invalid_input")) throw new Error("invalid_input");
      throw error;
    }
    return data as SummaryCounts;
  },
  async modules(owner: Owner) {
    if (owner.kind === "child") {
      const { data, error } = await admin.from("child_modules").select("module_key").eq("child_id", owner.childId);
      if (error) throw error;
      return (data ?? []).map((r: { module_key: string }) => r.module_key);
    }
    const { data, error } = await adultClient(owner.authorization)
      .from("profile_support_preferences").select("support_areas").eq("profile_id", owner.profileId).maybeSingle();
    if (error) throw error;
    return Array.isArray(data?.support_areas) ? data.support_areas : [];
  },
};

serve(createRecommendationsHandler({ store, verifyChildToken, authenticateAdult, log }));
