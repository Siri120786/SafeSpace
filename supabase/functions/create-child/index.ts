// supabase/functions/create-child/index.ts
// Caregiver-authenticated. Hashes the PIN server-side and creates the child +
// module assignments. The PIN never touches the database in plaintext.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, preflight } from "../_shared/http.ts";
import { hashPin, verifyPin } from "../_shared/pin.ts";

const VALID_MODULES = ["autism", "adhd", "anxiety", "depression", "ptsd", "pcos_pcod"];

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Act AS the caregiver: their JWT flows through, so RLS applies to every query.
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return json({ error: "unauthorized" }, 401);

  const { name, age, pin, modules } = await req.json().catch(() => ({}));
  if (!name || !Number.isInteger(age) || age < 4 || age > 17 || !/^\d{4}$/.test(pin ?? "")) {
    return json({ error: "invalid_request" }, 400);
  }
  const mods: string[] = Array.isArray(modules) ? modules.filter((m) => VALID_MODULES.includes(m)) : [];

  // PINs must be unique within a family, otherwise verify-child-pin is ambiguous.
  const { data: siblings } = await supabase.from("children").select("pin_hash");
  for (const s of siblings ?? []) {
    if (await verifyPin(pin, s.pin_hash)) return json({ error: "pin_already_used_in_family" }, 409);
  }

  // Privacy tier follows the age bands in the architecture spec (§3).
  const privacy_tier = age <= 8 ? "full" : age <= 12 ? "partial" : "private";

  const { data: child, error } = await supabase.from("children")
    .insert({ caregiver_id: userData.user.id, name, age, pin_hash: await hashPin(pin), privacy_tier })
    .select("id").single();
  if (error) return json({ error: "create_failed" }, 500);

  if (mods.length) {
    await supabase.from("child_modules").insert(mods.map((module_key) => ({ child_id: child.id, module_key })));
  }
  return json({ child_id: child.id });
});
