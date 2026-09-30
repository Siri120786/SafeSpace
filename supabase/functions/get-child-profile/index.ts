// supabase/functions/get-child-profile/index.ts
// Child-facing: resolves the signed child-session token to a child_id and
// returns ONLY that child's own profile + assigned modules. Uses the service
// role because children have no auth.users row; the token is the boundary.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, preflight } from "../_shared/http.ts";
import { verifyChildToken } from "../_shared/childToken.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const { child_session_token } = await req.json().catch(() => ({}));
  const childId = await verifyChildToken(child_session_token);
  if (!childId) return json({ error: "invalid_session" }, 401);

  const { data, error } = await admin.from("children")
    .select("id, caregiver_id, name, age, privacy_tier, child_modules(module_key)")
    .eq("id", childId).single();
  if (error || !data) return json({ error: "not_found" }, 404);

  return json({
    child: {
      id: data.id,
      caregiverId: data.caregiver_id,
      name: data.name,
      age: data.age,
      privacyTier: data.privacy_tier,
      assignedModules: (data.child_modules ?? []).map((m: { module_key: string }) => m.module_key),
    },
  });
});
