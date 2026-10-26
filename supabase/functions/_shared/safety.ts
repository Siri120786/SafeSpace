// supabase/functions/_shared/safety.ts
// The one crisis check (safety-check) and the child alert step
// (emergency-escalation), shared by the AI Companion, journal and mood
// check-in functions and by the two Edge Functions of those names. Pure: no
// Deno APIs, so it runs under Node in the tests.
//
// The check is the AI Companion's existing crisis screen (screenForCrisis):
// narrow English and Hindi phrases, NOT a complete or multilingual detector,
// and it needs clinician review before real use. It only answers "crisis
// words or not": never a score, a label or a diagnosis.
//
// On a match:
//   - everyone sees the fixed safety message (112, Tele-MANAS 14416);
//   - for a child, the server raises an in-app alert for their caregivers
//     (raise_safety_alert, migration 20261031000000). The alert names where it
//     came from, never the child's words, and the child is told gently.
// Individuals get the message only: they have no linked contact to alert.

import { safetyMessage, screenForCrisis } from "./aiCompanion.ts";
import { errorSummary } from "./errors.ts";

export type SafetySource = "companion_flag" | "journal_flag" | "check_in";

// Shown to the child under the safety message when their grown-up was alerted.
export const CHILD_ALERT_NOTICE = "We've let your grown-up know so they can check in with you.";

// India-first; re-check with the team before release (as the safety message says).
export const CRISIS_RESOURCES = [
  { name: "Emergency", contact: "Call 112" },
  { name: "Tele-MANAS (free, confidential, any time)", contact: "Call 14416" },
] as const;

export interface SafetyNotice {
  message: string;            // the fixed safety message
  caregiverAlerted: boolean;
  notice: string | null;      // CHILD_ALERT_NOTICE when caregiverAlerted
}

/** Crisis words or not. The single check every flow uses. */
export function safetyCheck(text: unknown): boolean {
  return typeof text === "string" && text.length > 0 && screenForCrisis(text);
}

export type RaiseSafetyAlert = (childId: string, source: SafetySource) => Promise<string>;

/**
 * Runs the check on text a child wrote and, on a match, raises the caregiver
 * alert. Returns null when there were no crisis words. A failed alert never
 * blocks the safety message: it is logged (name/code only) and reported as
 * not alerted.
 */
export async function escalateChildText(
  text: unknown,
  childId: string,
  source: SafetySource,
  raise: RaiseSafetyAlert,
  log: (event: string, detail?: string) => void,
): Promise<SafetyNotice | null> {
  if (!safetyCheck(text)) return null;
  let caregiverAlerted = false;
  try {
    await raise(childId, source);
    caregiverAlerted = true;
  } catch (e) {
    log("safety_alert_failed", errorSummary(e));
  }
  return { message: safetyMessage("en"), caregiverAlerted, notice: caregiverAlerted ? CHILD_ALERT_NOTICE : null };
}

/** The message alone, for an adult (no alert). */
export function adultSafetyNotice(text: unknown): SafetyNotice | null {
  return safetyCheck(text) ? { message: safetyMessage("en"), caregiverAlerted: false, notice: null } : null;
}
