// supabase/functions/verify-child-pin/index.ts
// The ONLY place a PIN is ever checked. Client sends { family_code, pin };
// server finds that family's children, verifies the PIN against the stored
// hashes, and returns a signed child-session token scoped to one child_id.
// Rate-limited per family via pin_attempts (migration 0002).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, preflight } from "../_shared/http.ts";
import { verifyPin } from "../_shared/pin.ts";
import { signChildToken } from "../_shared/childToken.ts";

const MAX_FAILED = 5;          // failed attempts allowed...
const WINDOW_MINUTES = 15;     // ...per family within this window

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const { family_code, pin } = await req.json().catch(() => ({}));
  if (typeof family_code !== "string" || !/^\d{4}$/.test(pin ?? "")) {
    return json({ error: "invalid_request" }, 400);
  }
  const code = family_code.trim().toUpperCase();

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await admin.from("pin_attempts")
    .select("id", { count: "exact", head: true })
    .eq("family_code", code).eq("succeeded", false).gte("attempted_at", since);
  if ((count ?? 0) >= MAX_FAILED) return json({ error: "too_many_attempts" }, 429);

  const { data: caregiver } = await admin.from("caregivers").select("id").eq("family_code", code).maybeSingle();
  const { data: kids } = caregiver
    ? await admin.from("children").select("id, pin_hash").eq("caregiver_id", caregiver.id)
    : { data: [] as { id: string; pin_hash: string }[] };

  let matchId: string | null = null;
  for (const k of kids ?? []) {
    if (await verifyPin(pin, k.pin_hash)) { matchId = k.id; break; }
  }

  await admin.from("pin_attempts").insert({ family_code: code, succeeded: matchId !== null });

  // Same response for "unknown family" and "wrong PIN" so codes can't be probed.
  if (!matchId) return json({ error: "invalid_credentials" }, 401);
  return json({ child_session_token: await signChildToken(matchId), child_id: matchId });
});
