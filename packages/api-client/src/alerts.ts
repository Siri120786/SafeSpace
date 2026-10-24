// packages/api-client/src/alerts.ts
// Alerts (docs/role-flow/CONTRACT.md section 7): the talk board's "I need
// help" reaches every caregiver of the child, whatever the sharing choice.
// In-app only. Caregivers read alerts under RLS and mark them reviewed with
// mark_alert_reviewed(); children raise one through the child-alerts Edge
// Function (a second tap within 2 minutes returns the same alert).

import { getSafeSpaceClient } from "./supabaseClient";
import { ContractError, invokeEdge, toContractError } from "./edge";
import type { AlertSource, AppSession, CaregiverAlert, ListAlertsOptions } from "@safespace/shared-types";

interface AlertRow {
  id: string;
  child_id: string;
  triggered_by: AlertSource;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  children: { name: string } | null;
}

function toAlert(r: AlertRow): CaregiverAlert {
  return {
    id: r.id,
    childId: r.child_id,
    childName: r.children?.name ?? "",
    source: r.triggered_by,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
    reviewedBy: r.reviewed_by,
  };
}

// Alerts for every child the signed-in caregiver cares for, newest first.
export async function listAlerts(options: ListAlertsOptions = {}): Promise<CaregiverAlert[]> {
  const limit = options.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new ContractError("invalid_input");
  let query = getSafeSpaceClient().from("emergency_events")
    .select("id, child_id, triggered_by, created_at, reviewed_at, reviewed_by, children(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (options.unreviewedOnly) query = query.is("reviewed_at", null);
  const { data, error } = await query;
  if (error) throw toContractError(error);
  return ((data ?? []) as unknown as AlertRow[]).map(toAlert);
}

// Any caregiver of the child. Marking an already-reviewed alert keeps the first reviewer.
export async function markAlertReviewed(alertId: string): Promise<void> {
  const { error } = await getSafeSpaceClient().rpc("mark_alert_reviewed", { p_alert_id: alertId });
  if (error) throw toContractError(error);
}

// Child session only: the talk board's "I need help", or "I want a grown-up"
// on the feelings cards (role-flow 8e). Returns the alert id.
export async function raiseHelpAlert(session: AppSession, source: "talk_board" | "feelings_cards" = "talk_board"): Promise<string> {
  if (session?.kind !== "child") throw new ContractError("unsupported_session");
  const data = await invokeEdge<{ alertId: string }>("child-alerts", {
    action: "raise_help",
    child_session_token: session.childSessionToken,
    source,
  });
  return data.alertId;
}
