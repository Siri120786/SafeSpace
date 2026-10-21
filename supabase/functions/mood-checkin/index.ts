// supabase/functions/mood-checkin/index.ts
// Child-facing mood check-ins. Children have no auth.users row, so RLS cannot
// identify them; this function resolves the signed child-session token to a
// child_id and reads/writes ONLY that child's rows with the service role.
// Adult users do not call this function: they use the mood_checkins table
// directly under RLS (see packages/api-client/src/mood.ts).
//
// Actions:
//   create  { child_session_token, mood, intensity?, note?, is_private_note? }
//   list    { child_session_token, limit? }
// Responses carry raw mood_checkins rows (snake_case), the same shape as a
// direct table read, so each client keeps a single row mapper.
//
// No distress scoring or escalation happens here. Wiring mood check-ins into
// emergency-escalation waits for the approved safety policy
// (docs/SPRINT_2_FOUNDATION.md).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, preflight } from "../_shared/http.ts";
import { verifyChildToken } from "../_shared/childToken.ts";
import { clampLimit, validateMoodCheckin } from "../_shared/moodCheckin.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const COLUMNS = "id, profile_id, child_id, mood, intensity, note, is_private_note, created_at";

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const childId = await verifyChildToken(body.child_session_token);
  if (!childId) return json({ error: "invalid_session" }, 401);

  if (body.action === "list") {
    const { data, error } = await admin.from("mood_checkins")
      .select(COLUMNS)
      .eq("child_id", childId)
      .order("created_at", { ascending: false })
      .limit(clampLimit(body.limit));
    if (error) {
      console.error("mood-checkin list failed:", error);
      return json({ error: "list_failed" }, 500);
    }
    return json({ checkins: data ?? [] });
  }

  if (body.action === "create") {
    const result = validateMoodCheckin(body);
    if (!result.ok) return json({ error: result.error }, 400);

    if (result.value.is_private_note) {
      // Checked here for a clear error; the DB trigger enforces it as well.
      const { data: child } = await admin.from("children")
        .select("privacy_tier").eq("id", childId).single();
      if (child?.privacy_tier !== "partial") {
        return json({ error: "private_note_not_allowed_for_privacy_tier" }, 400);
      }
    }

    const { data, error } = await admin.from("mood_checkins")
      .insert({ child_id: childId, ...result.value })
      .select(COLUMNS)
      .single();
    if (error || !data) {
      console.error("mood-checkin create failed:", error);
      return json({ error: "create_failed" }, 500);
    }
    return json({ checkin: data });
  }

  return json({ error: "invalid_action" }, 400);
});
