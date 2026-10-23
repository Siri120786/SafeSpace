// supabase/functions/reminders/index.ts
// Child-facing reminders Edge Function: wiring only. Request logic lives in
// ./handler.ts. Uses the service role, scoped to the child_id derived from the
// verified child-session token.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { childSessionVerifier, sessionVersionLookup } from "../_shared/childSession.ts";
import { createRemindersHandler, type ChildRemindersStore } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Signature, expiry AND session version (a PIN reset ends sessions).
const verifyChildToken = childSessionVerifier(sessionVersionLookup(admin));

const COLUMNS = "id, profile_id, child_id, kind, title, routine_id, time_of_day, days_of_week, timezone, is_enabled, lead_minutes, created_at, updated_at";

const log = (event: string, detail?: string) =>
  console.error(`reminders: ${event}${detail ? ` (${detail})` : ""}`);

const store: ChildRemindersStore = {
  async listReminders(childId) {
    const { data, error } = await admin.from("reminders").select(COLUMNS)
      .eq("child_id", childId).order("time_of_day", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async listAcknowledgements(reminderIds, fromDate, toDate) {
    const { data, error } = await admin.from("reminder_acknowledgements")
      .select("reminder_id, occurs_on").in("reminder_id", reminderIds)
      .gte("occurs_on", fromDate).lte("occurs_on", toDate);
    if (error) throw error;
    return data ?? [];
  },

  async childOwnsReminder(childId, reminderId) {
    const { data, error } = await admin.from("reminders").select("id")
      .eq("id", reminderId).eq("child_id", childId).maybeSingle();
    if (error) throw error;
    return !!data;
  },

  async acknowledge(reminderId, occursOn) {
    const { error } = await admin.from("reminder_acknowledgements")
      .upsert({ reminder_id: reminderId, occurs_on: occursOn }, { onConflict: "reminder_id,occurs_on", ignoreDuplicates: true });
    if (error) throw error;
  },
};

serve(createRemindersHandler({ store, verifyChildToken, log }));
