import React, { useEffect, useState } from "react";
import { getChildWellnessDaily } from "@safespace/api-client";
import type { WellnessDay, WellnessPeriodDays } from "@safespace/shared-types";
import { DayStrip } from "../../../components/ui/DayStrip";
import { activityLegend, activityRows, mostFeltMood } from "../../wellness-ui/timelines";

// The caregiver's day-by-day view of a child (wellness_daily): mood check-ins,
// routine steps and journal days as calm day strips, each with a plain
// sentence. Only shown while the child shares activity (the page decides).
export const ActivityTimeline: React.FC<{ childId: string; period: WellnessPeriodDays }> = ({ childId, period }) => {
  const [days, setDays] = useState<WellnessDay[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    getChildWellnessDaily(childId, period)
      .then((d) => live && setDays(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [childId, period]);

  if (failed) return <p className="text-sm text-textMuted">The timeline couldn't load just now.</p>;
  if (!days) return <p className="text-sm text-textMuted">Loading the timeline…</p>;

  const felt = mostFeltMood(days);
  return (
    <section aria-label="Activity timeline" className="rounded-3xl bg-white border border-olive-100 p-5 space-y-4">
      {felt && <p className="font-display text-lg text-textHeading">{felt}</p>}
      <DayStrip rows={activityRows(days)} legend={activityLegend(days)} />
    </section>
  );
};

export default ActivityTimeline;
