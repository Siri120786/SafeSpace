// supabase/functions/emergency-escalation/index.ts
//
// Implements the 5-step flow from docs/Architecture_Specification.md §5:
//   1. Distress signal detected   (caller passes this in — see triggered_by)
//   2. Safety classifier check    (runSafetyClassifier — rule-based + light NLP,
//                                  DELIBERATELY NOT diagnostic, see comment below)
//   3. Privacy override applied   (handled by DB policy, not here — see migration
//                                  0001, emergency_events RLS has no privacy_tier check)
//   4. AI-crafted alert drafted   (draftAlertSummary)
//   5. Contact notified & logged  (insert row + send notification)
//
// This function deliberately does the LEAST AI-open-ended work of any Edge
// Function in this project. It drafts a short, structured summary from fixed
// inputs — it never free-generates or interprets beyond that.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, preflight } from "../_shared/http.ts";
import { verifyChildToken } from "../_shared/childToken.ts";

interface EscalationRequest {
  child_session_token: string;   // scoped token issued at PIN verification, not a caregiver JWT
  triggered_by: "check_in" | "aac_tap" | "journal_flag";
  raw_signal_text?: string;      // e.g. the journal text that tripped the flag, if applicable
}

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const body: EscalationRequest = await req.json();

  // Every child action is scoped by a signed session issued at PIN verification.
  // This is NOT a Supabase Auth JWT — children have no auth.users row (see
  // migration 0001 comment). Verify it and resolve to a child_id server-side.
  const childId = await verifyChildToken(body.child_session_token);
  if (!childId) {
    return json({ error: "invalid_session" }, 401);
  }

  // --- Step 2: Safety classifier check ---------------------------------
  // Rule-based + lightweight NLP only. This function's ONLY job is
  // "escalate or not" — it must never attempt to name a condition or
  // diagnosis. See docs/Architecture_Specification.md §5, step 2.
  const classifierResult = runSafetyClassifier(body.raw_signal_text ?? "");

  if (!classifierResult.shouldEscalate) {
    return json({ escalated: false, reason: "below_threshold" });
  }

  // --- Step 4: AI-crafted alert + resources -----------------------------
  const alertSummary = await draftAlertSummary({
    triggeredBy: body.triggered_by,
    classifierScore: classifierResult.score,
  });

  // --- Step 5: Contact notified & logged --------------------------------
  // Step 3 (privacy override) is enforced by the emergency_events RLS
  // policy in migration 0001 — this insert is readable by the caregiver
  // regardless of the child's privacy_tier, unconditionally.
  const { data: event, error } = await supabaseAdmin
    .from("emergency_events")
    .insert({
      child_id: childId,
      triggered_by: body.triggered_by,
      classifier_score: classifierResult.score,
      ai_alert_summary: alertSummary,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to log emergency event:", error);
    return json({ error: "logging_failed" }, 500);
  }

  await notifyCaregiver(childId, alertSummary);

  await supabaseAdmin
    .from("emergency_events")
    .update({ caregiver_notified_at: new Date().toISOString() })
    .eq("id", event.id);

  return json({
    escalated: true,
    // The user-facing side of step 4 — always returned, regardless of
    // whether the notification succeeds, per "never block crisis resources
    // on a notification round-trip."
    crisis_resources: getCrisisResources(),
  });
});

// ----------------------------------------------------------------------------
// Deliberately conservative: rule-based keyword/pattern matching plus a
// bounded NLP confidence score. NEVER expand this into a general-purpose
// sentiment classifier that attempts to characterize the child's mental
// state beyond "escalate or not." See Architecture_Specification.md §5.
// ----------------------------------------------------------------------------
function runSafetyClassifier(text: string): { shouldEscalate: boolean; score: number } {
  const highRiskPatterns = [/\bhurt myself\b/i, /\bwant to die\b/i, /\bcan'?t (do|take) this anymore\b/i];
  const matched = highRiskPatterns.some((p) => p.test(text));
  return { shouldEscalate: matched, score: matched ? 0.9 : 0.1 };
}

async function draftAlertSummary(input: { triggeredBy: string; classifierScore: number }): Promise<string> {
  // TODO: replace with a scoped LLM call once AI orchestration is wired up
  // (see supabase/functions/ai-orchestrator). Keep the prompt FIXED and
  // narrow — this must stay a structured summary, never open-ended content.
  return `A distress signal was detected (source: ${input.triggeredBy}). ` +
         `Please check in with your child as soon as you can.`;
}

async function notifyCaregiver(childId: string, summary: string): Promise<void> {
  // TODO: wire to actual push/SMS/email provider.
  console.log(`[NOTIFY] child=${childId} summary="${summary}"`);
}

function getCrisisResources() {
  // TODO: replace with region-appropriate, kept-current resources.
  return [
    { name: "Crisis Text Line", contact: "Text HOME to 741741" },
  ];
}

