import React, { useEffect, useState } from "react";
import { getChildOverview } from "@safespace/api-client";
import type { Child, ChildOverview, ChildSharingStatus } from "@safespace/shared-types";
import { MODULE_LABELS } from "../moduleLabels";
import { Card } from "../../../components/ui/Card";
import { Chip } from "../../../components/ui/Chip";

const SHARING_LABELS: Record<ChildSharingStatus, string> = {
  under_15: "Under 15: you see their activity",
  not_asked: "15+: hasn't chosen yet, so it's shared",
  shared: "15+: chose to share with you",
  not_shared: "15+: chose not to share",
};

interface Props {
  child: Child;
  familyCode: string | null;   // the primary caregiver's code: what the child's device needs
}

// Non-diagnostic counts for the last 7 days, read with the caregiver's own RLS
// (docs/sprint-3/CONTRACTS.md section 5).
export const ChildOverviewCard: React.FC<Props> = ({ child, familyCode }) => {
  const [overview, setOverview] = useState<ChildOverview | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!familyCode) return;
    try {
      await navigator.clipboard.writeText(familyCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; the code is still on screen.
    }
  }

  useEffect(() => {
    let active = true;
    getChildOverview(child.id, 7)
      .then((o) => active && setOverview(o))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [child.id]);

  const s = overview?.summary;

  return (
    <Card className="p-6 space-y-4 border border-olive-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[13rem]">
          <div className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-olive-500 to-deepGreen text-white font-display font-medium flex items-center justify-center shadow-sm">
            {child.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-display text-lg font-medium text-textHeading">{child.name}</h3>
            <p className="text-xs text-textMuted">Age {child.ageYears}</p>
            <p className="text-xs text-textMuted">{SHARING_LABELS[child.sharing]}</p>
            {child.myRole === "co_caregiver" && <p className="text-xs text-textMuted">You're a co-caregiver</p>}
          </div>
        </div>
        {overview && overview.unreviewedAlerts > 0 && (
          <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-full whitespace-nowrap">
            {overview.unreviewedAlerts} alert{overview.unreviewedAlerts === 1 ? "" : "s"} to review
          </span>
        )}
        {overview && (overview.dueRemindersToday ?? 0) > 0 && (
          <span className="text-xs font-semibold text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full whitespace-nowrap">
            {overview.dueRemindersToday} reminder{overview.dueRemindersToday === 1 ? "" : "s"} due today
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-olive-50/70 border border-olive-100 px-4 py-2.5">
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-deepGreen">Family code</span>
          <span className="font-display text-lg tracking-[0.2em] text-textHeading" aria-live="polite">
            {familyCode ?? "······"}
          </span>
        </div>
        <button
          type="button"
          onClick={copyCode}
          disabled={!familyCode}
          aria-label={`Copy ${child.name}'s family code`}
          className="text-xs font-medium text-deepGreen underline disabled:opacity-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="-mt-2 text-[11px] text-textMuted">{child.name} signs in with this code and their own PIN.</p>

      {child.assignedModules.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {child.assignedModules.map((m) => (
            <Chip key={m} label={MODULE_LABELS[m] ?? m} variant="olive" size="sm" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-textMuted">This week's summary couldn't load right now.</p>}
      {!error && overview && !overview.activity.visible && (
        <p className="text-sm text-textMuted">{child.name} has chosen not to share their activity.</p>
      )}
      {!error && !overview && <p className="text-sm text-textMuted">Loading this week...</p>}
      {s && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Days with a check-in" value={`${s.mood.daysWithCheckin} / ${s.periodDays}`} />
          <Stat label="Routine steps done" value={`${s.routines.completedSteps} / ${s.routines.scheduledSteps}`} />
          <Stat label="Journal entries" value={String(s.journal.entries)} />
        </div>
      )}
    </Card>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl bg-olive-50/70 px-2 py-3">
    <div className="font-display text-xl font-medium text-textHeading">{value}</div>
    <div className="text-[11px] text-textMuted mt-0.5">{label}</div>
  </div>
);
