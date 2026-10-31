// supabase/functions/mood-checkin/index.ts
// Child-facing mood check-ins. Children have no auth.users row, so RLS cannot
// identify them; this function resolves the signed child-session token to a
// child_id and reads/writes ONLY that child's rows with the service role.
// Adult users do not call this function: they use the mood_checkins table
// directly under RLS (see packages/api-client/src/mood.ts).
//
// Actions:
//   create  { child_session_token, mood, intensity?, note? }  (private notes were removed)
//   list    { child_session_token, limit? }
// Responses carry raw mood_checkins rows (snake_case), the same shape as a
// direct table read, so each client keeps a single row mapper.
//
// No distress scoring: a mood on its own never raises anything. Only a note
// that trips the crisis screen does (_shared/safety.ts): the child sees the
// safety message and their caregivers get an in-app alert naming the mood
// check-in, never the words (raise_safety_alert).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, preflight } from "../_shared/http.ts";
import { childSessionVerifier, sessionVersionLookup } from "../_shared/childSession.ts";
import { clampLimit, validateMoodCheckin } from "../_shared/moodCheckin.ts";
import { escalateChildText } from "../_shared/safety.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Signature, expiry AND session version (a PIN reset ends sessions).
const verifyChildToken = childSessionVerifier(sessionVersionLookup(admin));

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

    // Private notes were removed (role flow); the DB trigger refuses them too.
    if (result.value.is_private_note) return json({ error: "invalid_input" }, 400);

    const { data, error } = await admin.from("mood_checkins")
      .insert({ child_id: childId, ...result.value })
      .select(COLUMNS)
      .single();
    if (error || !data) {
      console.error("mood-checkin create failed:", error);
      return json({ error: "create_failed" }, 500);
    }
    const safety = await escalateChildText(result.value.note, childId, "check_in", async (id, source) => {
      const { data: alertId, error: alertError } = await admin.rpc("raise_safety_alert", { p_child_id: id, p_source: source });
      if (alertError) throw alertError;
      return alertId as string;
    }, (event, detail) => console.error(`mood-checkin: ${event}${detail ? ` (${detail})` : ""}`));
    return json({ checkin: data, safety });
  }

  return json({ error: "invalid_action" }, 400);
});
