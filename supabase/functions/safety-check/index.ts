// supabase/functions/safety-check/index.ts
// The crisis check as an endpoint: wiring only. Request logic lives in
// ./handler.ts. Reads nothing and writes nothing.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { childSessionVerifier, sessionVersionLookup } from "../_shared/childSession.ts";
import { createSafetyCheckHandler } from "./handler.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Signature, expiry AND session version (a PIN reset ends sessions).
const verifyChildToken = childSessionVerifier(sessionVersionLookup(admin));

const log = (event: string, detail?: string) =>
  console.error(`safety-check: ${event}${detail ? ` (${detail})` : ""}`);

async function authenticateAdult(authorization: string): Promise<string | null> {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!anonKey) return null;
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

serve(createSafetyCheckHandler({ verifyChildToken, authenticateAdult, log }));
