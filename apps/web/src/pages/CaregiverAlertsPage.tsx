import React, { useState } from "react";
import { markAlertReviewed } from "@safespace/api-client";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useAuth } from "../features/auth";
import {
  ALERT_SOURCE_LABELS,
  CaregiverPageShell,
  formatAlertTime,
  reviewedByText,
  useAlerts,
} from "../features/caregiver";
import { ROUTES } from "../routes";

// All alerts for the caregiver's children, newest first; any caregiver of the
// child can mark one reviewed (docs/role-flow/CONTRACT.md section 7). In-app only.
export const CaregiverAlertsPage: React.FC = () => {
  const { session } = useAuth();
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(true);
  const { alerts, error, reload } = useAlerts(onlyUnreviewed);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const myId = session?.kind === "auth_user" ? session.profile.id : "";

  async function review(id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      await markAlertReviewed(id);
      await reload();
    } catch {
      setActionError("Couldn't mark that alert reviewed. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  const tab = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
      active ? "bg-white text-deepGreen shadow-sm" : "text-textMuted hover:text-textHeading"
    }`;

  return (
    <CaregiverPageShell
      title="Alerts"
      subtitle="When a child presses &quot;I need help&quot;, every one of their caregivers sees it here."
      backTo={ROUTES.CAREGIVER_HOME}
    >
      <div role="tablist" aria-label="Which alerts" className="inline-flex gap-1 rounded-2xl border border-olive-100 bg-olive-50/60 p-1">
        <button role="tab" aria-selected={onlyUnreviewed} className={tab(onlyUnreviewed)} onClick={() => setOnlyUnreviewed(true)}>
          Needs review
        </button>
        <button role="tab" aria-selected={!onlyUnreviewed} className={tab(!onlyUnreviewed)} onClick={() => setOnlyUnreviewed(false)}>
          All
        </button>
      </div>

      {(error || actionError) && (
        <p role="alert" className="text-sm text-red-700">{actionError ?? "Couldn't load alerts right now."}</p>
      )}
      {!alerts && !error && <p className="text-textBody">Loading alerts...</p>}
      {alerts && alerts.length === 0 && (
        <Card>
          <p className="text-textBody">{onlyUnreviewed ? "Nothing needs reviewing right now." : "No alerts yet."}</p>
        </Card>
      )}

      <ul className="space-y-3">
        {alerts?.map((a) => {
          const reviewed = reviewedByText(a, myId);
          return (
            <li key={a.id}>
              <Card className={`p-5 flex flex-wrap items-center justify-between gap-3 border ${reviewed ? "border-olive-100" : "border-red-200 bg-red-50/40"}`}>
                <div>
                  <p className="font-display text-base font-medium text-textHeading">{a.childName || "Your child"}</p>
                  <p className="text-sm text-textBody">{ALERT_SOURCE_LABELS[a.source]}</p>
                  <p className="text-xs text-textMuted mt-0.5">
                    <time dateTime={a.createdAt}>{formatAlertTime(a.createdAt)}</time>
                    {reviewed && ` · ${reviewed}`}
                  </p>
                </div>
                {!reviewed && (
                  <Button variant="olive" size="sm" onClick={() => review(a.id)} disabled={busyId === a.id}>
                    {busyId === a.id ? "Saving..." : "Mark reviewed"}
                  </Button>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-textMuted">
        Alerts show here and on your home page only. SafeSpace doesn't send texts, emails or phone notifications.
      </p>
    </CaregiverPageShell>
  );
};

export default CaregiverAlertsPage;
