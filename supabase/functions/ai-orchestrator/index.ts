// supabase/functions/ai-orchestrator/index.ts
//
// Central routing point for every AI call in the system. Per docs/Architecture_
// Specification.md §6: Journaling, Stories, and Emergency call AI services;
// Routines NEVER does. This function makes that a structural guarantee, not
// a convention someone has to remember — an unlisted feature key is rejected
// before any AI call happens.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { json, preflight } from "../_shared/http.ts";
import { verifyChildToken } from "../_shared/childToken.ts";

type FeatureKey = "journaling" | "stories" | "emergency"; // NOTE: "routines" intentionally absent

interface OrchestrationRequest {
  feature: FeatureKey;
  child_session_token: string;
  payload: Record<string, unknown>;
}

// The allow-list IS the enforcement mechanism. Do not add "routines" here —
// if a routine planner ever needs this route, that's a sign the feature has
// grown beyond a planner and the architecture decision should be revisited
// deliberately, not silently patched around.
const AI_ENABLED_FEATURES: Record<FeatureKey, (payload: Record<string, unknown>) => Promise<unknown>> = {
  journaling: callJournalingPipeline,   // speech-to-text + NLP sentiment/safety flags
  stories: callStoriesPipeline,         // LLM generation, optionally image/video
  emergency: callEmergencyAlertDraft,   // narrow, structured summary only (see emergency-escalation/index.ts)
};

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const body: OrchestrationRequest = await req.json();

  const handler = AI_ENABLED_FEATURES[body.feature];
  if (!handler) {
    // This branch is what fires if something ever tries to route "routines"
    // (or any typo/unknown key) through here. 400, not a silent no-op.
    return json({ error: "feature_not_ai_enabled", feature: body.feature }, 400);
  }

  const childId = await verifyChildToken(body.child_session_token);
  if (!childId) return json({ error: "invalid_session" }, 401);

  try {
    const result = await handler(body.payload);
    return json({ result });
  } catch (err) {
    console.error(`AI orchestration failed for feature=${body.feature}:`, err);
    return json({ error: "ai_call_failed" }, 502);
  }
});

async function callJournalingPipeline(payload: Record<string, unknown>) {
  // 1. Speech-to-text (if payload.audio present)
  // 2. NLP sentiment / safety-flag extraction
  // 3. If flagged high-risk, the CALLER (journaling feature) is responsible
  //    for separately invoking emergency-escalation — this function only
  //    returns the flag, it does not escalate itself.
  // TODO: wire to actual STT/NLP provider.
  return { transcript: payload.audio ? "[transcribed text placeholder]" : payload.text, sentiment_flags: {} };
}

async function callStoriesPipeline(payload: Record<string, unknown>) {
  // TODO: wire to actual LLM (+ optional image/video generation).
  return { content_text: "[generated story placeholder]", content_image_url: null };
}

async function callEmergencyAlertDraft(payload: Record<string, unknown>) {
  // Intentionally the narrowest of the three — see emergency-escalation/index.ts
  // for why this stays a fixed-template summary rather than open generation.
  return { summary: "[structured alert summary placeholder]" };
}

