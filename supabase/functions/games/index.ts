// supabase/functions/games/index.ts
// Child-facing Games Corner Edge Function: wiring only. Request logic lives in
// ./handler.ts. Uses the service role, scoped to the child_id derived from the
// verified child-session token.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { childSessionVerifier, sessionVersionLookup } from "../_shared/childSession.ts";
import { createGamesHandler, type ChildGamesStore } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Signature, expiry AND session version (a PIN reset ends sessions).
const verifyChildToken = childSessionVerifier(sessionVersionLookup(admin));

const log = (event: string, detail?: string) =>
  console.error(`games: ${event}${detail ? ` (${detail})` : ""}`);

const store: ChildGamesStore = {
  async listProgress(childId) {
    const { data, error } = await admin.from("game_progress")
      .select("game_id, difficulty, rounds_completed, best_score, last_played_at")
      .eq("child_id", childId);
    if (error) throw error;
    return data ?? [];
  },

  async getPreferences(childId) {
    const { data, error } = await admin.from("game_preferences")
      .select("difficulty, reduced_motion, sound_enabled, voice_enabled")
      .eq("child_id", childId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },

  async recordRound(childId, gameId, difficulty, score) {
    const { error } = await admin.rpc("record_child_game_round", {
      p_child_id: childId, p_game_id: gameId, p_difficulty: difficulty, p_score: score,
    });
    if (error) throw error;
  },

  async savePreferences(childId, prefs) {
    const { error } = await admin.rpc("save_child_game_preferences", {
      p_child_id: childId,
      p_difficulty: prefs.difficulty,
      p_reduced_motion: prefs.reducedMotion,
      p_sound_enabled: prefs.soundEnabled,
      p_voice_enabled: prefs.voiceEnabled,
    });
    if (error) throw error;
  },

  async listCreations(childId) {
    const { data, error } = await admin.from("game_creations")
      .select("id, kind, content, created_at")
      .eq("child_id", childId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async saveCreation(childId, creation) {
    const { error } = await admin.from("game_creations")
      .upsert({ child_id: childId, id: creation.id, kind: creation.kind, content: creation.content },
        { onConflict: "child_id,id", ignoreDuplicates: true });
    if (error) throw error;
  },

  async deleteCreation(childId, id) {
    const { error } = await admin.from("game_creations").delete().eq("child_id", childId).eq("id", id);
    if (error) throw error;
  },
};

serve(createGamesHandler({ store, verifyChildToken, log }));
