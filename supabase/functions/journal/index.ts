// supabase/functions/journal/index.ts
// Child-facing journaling Edge Function: wiring only. Request logic lives in
// ./handler.ts. Uses the service role, scoped to the child_id derived from the
// verified child-session token.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { childSessionVerifier, sessionVersionLookup } from "../_shared/childSession.ts";
import { createJournalHandler, type ChildJournalStore } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Signature, expiry AND session version (a PIN reset ends sessions).
const verifyChildToken = childSessionVerifier(sessionVersionLookup(admin));

const COLUMNS = "id, profile_id, child_id, module_key, entry_type, content, is_private_note, created_at, updated_at";

const log = (event: string, detail?: string) =>
  console.error(`journal: ${event}${detail ? ` (${detail})` : ""}`);

const store: ChildJournalStore = {
  async createEntry(row) {
    const { data, error } = await admin.from("journal_entries").insert(row).select(COLUMNS).single();
    if (error || !data) throw error ?? new Error("journal_insert_failed");
    return data;
  },

  async listEntries(childId, limit, entryType) {
    let query = admin.from("journal_entries").select(COLUMNS).eq("child_id", childId)
      .order("created_at", { ascending: false }).limit(limit);
    if (entryType) query = query.eq("entry_type", entryType);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },
};

serve(createJournalHandler({ store, verifyChildToken, log }));
