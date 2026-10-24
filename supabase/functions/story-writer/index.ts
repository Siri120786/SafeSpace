// supabase/functions/story-writer/index.ts
// Story-writer Edge Function: wiring only. Request logic lives in ./handler.ts.
//
// Uses its OWN Gemini key, STORIES_GEMINI_API_KEY, separate from the AI
// Companion's GEMINI_API_KEY, so stories have their own free-tier quota and
// the key can be rotated or revoked on its own. The key never leaves this
// function. STORIES_GEMINI_MODEL overrides the model per environment.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorSummary } from "../_shared/errors.ts";
import { extractGeminiText } from "../_shared/aiCompanion.ts";
import { buildWriterRequest } from "../_shared/storyWriter.ts";
import { createStoryWriterHandler } from "./handler.ts";

// Same model as the AI Companion (fast, no thinking overhead); a story with
// Telugu is a few thousand tokens.
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const MODEL_TIMEOUT_MS = 45_000;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const log = (event: string, detail?: string) =>
  console.error(`story-writer: ${event}${detail ? ` (${detail})` : ""}`);

async function authenticateAdult(authorization: string): Promise<string | null> {
  const asCaller = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await asCaller.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

// story_writer_take_slot (migration 20261028000000): atomic, service role only.
async function takeSlot(userId: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await admin.rpc("story_writer_take_slot", {
    p_profile_id: userId, p_limit: limit, p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  if (typeof data !== "boolean") throw new Error("unexpected_slot_result");
  return data;
}

serve(createStoryWriterHandler({
  authenticateAdult,
  takeSlot,
  log,
  async askModel(ageBand, turns) {
    const apiKey = Deno.env.get("STORIES_GEMINI_API_KEY");
    if (!apiKey) {
      log("model_not_configured");
      return null;
    }
    const model = Deno.env.get("STORIES_GEMINI_MODEL") || DEFAULT_MODEL;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(buildWriterRequest(ageBand, turns)),
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      });
      if (!res.ok) {
        log("model_http_error", String(res.status));
        return null;
      }
      return extractGeminiText(await res.json());
    } catch (e) {
      log("model_call_failed", errorSummary(e));
      return null;
    }
  },
}));
