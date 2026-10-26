// supabase/functions/journal-analysis/index.ts
// Rule-based journal insights: wiring only. Request logic lives in
// ./handler.ts. Children: service role, scoped to the child_id from the
// verified child session. Adults and caregivers: a client carrying their own
// JWT, so every read runs under their own RLS (a caregiver only sees what the
// child shares, never private notes).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { childSessionVerifier, sessionVersionLookup } from "../_shared/childSession.ts";
import { createJournalAnalysisHandler, type JournalAnalysisStore, type Reader } from "./handler.ts";
import type { EntryRow } from "../_shared/journalAnalysis.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Signature, expiry AND session version (a PIN reset ends sessions).
const verifyChildToken = childSessionVerifier(sessionVersionLookup(admin));
// Enough for a very busy month; the rules only need recent entries.
const MAX_ROWS = 500;

const log = (event: string, detail?: string) =>
  console.error(`journal-analysis: ${event}${detail ? ` (${detail})` : ""}`);

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

const store: JournalAnalysisStore = {
  async entries(reader: Reader, since: string) {
    let q;
    if (reader.kind === "child") {
      q = admin.from("journal_entries").select("content, entry_type, created_at").eq("child_id", reader.childId);
    } else if (reader.kind === "caregiver_child") {
      // RLS: shared activity only, never private notes. The filter repeats it.
      q = adultClient(reader.authorization).from("journal_entries")
        .select("content, entry_type, created_at").eq("child_id", reader.childId).eq("is_private_note", false);
    } else {
      q = adultClient(reader.authorization).from("journal_entries")
        .select("content, entry_type, created_at").eq("profile_id", reader.profileId).is("child_id", null);
    }
    const { data, error } = await q.gte("created_at", since).order("created_at", { ascending: false }).limit(MAX_ROWS);
    if (error) throw error;
    return (data ?? []) as EntryRow[];
  },
};

serve(createJournalAnalysisHandler({ store, verifyChildToken, authenticateAdult, log }));
