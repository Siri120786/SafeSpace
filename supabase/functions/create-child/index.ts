// supabase/functions/create-child/index.ts
// Caregiver-authenticated child creation: wiring only. Request logic lives in
// ./handler.ts. The caller's JWT is verified with the anon-key client; writes
// go through create_child() with the service role, which only ever runs here
// on the server.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashPin, verifyPin } from "../_shared/pin.ts";
import { createCreateChildHandler, CreateChildRejected, type CreateChildStore } from "./handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const log = (event: string, detail?: string) =>
  console.error(`create-child: ${event}${detail ? ` (${detail})` : ""}`);

async function getUserId(authorization: string): Promise<string | null> {
  const asCaller = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await asCaller.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

const store: CreateChildStore = {
  async isCaregiver(userId) {
    const { data, error } = await admin.from("caregivers").select("id").eq("id", userId).maybeSingle();
    if (error) throw error;
    return !!data;
  },

  async listSiblingPinHashes(caregiverId) {
    const { data, error } = await admin.from("children").select("pin_hash").eq("caregiver_id", caregiverId);
    if (error) throw error;
    return (data ?? []).map((r: { pin_hash: string }) => r.pin_hash);
  },

  async createChild({ caregiverId, name, age, pinHash, modules }) {
    const { data, error } = await admin.rpc("create_child", {
      p_caregiver_id: caregiverId,
      p_name: name,
      p_age: age,
      p_pin_hash: pinHash,
      p_modules: modules,
    });
    if (error) {
      if (error.message?.includes("not_a_caregiver")) throw new CreateChildRejected("not_a_caregiver");
      if (error.message?.includes("invalid_input")) throw new CreateChildRejected("invalid_input");
      throw error;
    }
    return data as string;
  },
};

serve(createCreateChildHandler({ store, getUserId, hashPin, verifyPin, log }));
