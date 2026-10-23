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
}

// Non-diagnostic counts for the last 7 days, read with the caregiver's own RLS
// (docs/sprint-3/CONTRACTS.md section 5).
export const ChildOverviewCard: React.FC<Props> = ({ child }) => {
  const [overview, setOverview] = useState<ChildOverview | null>(null);
  const [error, setError] = useState(false);

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
          </div>
        </div>
        {overview && (overview.dueRemindersToday ?? 0) > 0 && (
          <span className="text-xs font-semibold text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full whitespace-nowrap">
            {overview.dueRemindersToday} reminder{overview.dueRemindersToday === 1 ? "" : "s"} due today
          </span>
        )}
      </div>

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
