// packages/api-client/src/journalInsights.ts
// Rule-based journal insights (last 30 days) from the journal-analysis Edge
// Function. Journal text never leaves SafeSpace; nothing is stored.
//   - Individuals and children: their own journal.
//   - Caregivers: getChildJournalInsights(childId), under their own RLS, so the
//     child's sharing choice applies and private notes are left out.

import { ContractError, invokeEdge } from "./edge";
import type { AppSession, JournalInsights } from "@safespace/shared-types";

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The signed-in Individual's or child's own journal insights. */
export async function getJournalInsights(session: AppSession): Promise<JournalInsights> {
  if (session?.kind !== "child" && session?.kind !== "auth_user") throw new ContractError("unsupported_session");
  const body: Record<string, unknown> = { action: "get", timezone: timezone() };
  if (session.kind === "child") body.child_session_token = session.childSessionToken;
  return (await invokeEdge<{ insights: JournalInsights }>("journal-analysis", body)).insights;
}

/** A caregiver's view of one child's shared journal (no private notes). */
export async function getChildJournalInsights(childId: string): Promise<JournalInsights> {
  return (await invokeEdge<{ insights: JournalInsights }>("journal-analysis", {
    action: "get", child_id: childId, timezone: timezone(),
  })).insights;
}
