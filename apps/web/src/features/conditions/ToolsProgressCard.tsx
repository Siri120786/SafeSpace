import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getChildToolsOverview, type ChildToolsOverview } from "@safespace/api-client";
import { Card } from "../../components/ui/Card";
import { focusWeek, goalProgress, habitWeek, hasAnyToolActivity, openTasks, recentFeelings } from "./caregiverTools";

// "Focus and feelings" on a caregiver's child page (role-flow 8f): the ADHD
// and autism tools at a glance. Only rendered where the child's activity is
// visible (under 15, or 15+ and sharing); the data is read under the same RLS
// rule. Counts and lists, not an assessment.
export const ToolsProgressCard: React.FC<{ childId: string; childName: string; setupPath: string }> = ({ childId, childName, setupPath }) => {
  const [overview, setOverview] = useState<ChildToolsOverview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    getChildToolsOverview(childId)
      .then((o) => live && setOverview(o))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [childId]);

  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <Card className="p-6 space-y-4 border border-olive-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-medium text-textHeading">Focus and feelings</h2>
        <Link to={setupPath} className="text-xs font-semibold text-deepGreen underline">Set up tools</Link>
      </div>

      {failed && <p role="alert" className="text-sm text-red-700">Couldn't load {childName}'s tools right now.</p>}
      {!failed && !overview && <p className="text-sm text-textMuted">Loading...</p>}
      {overview && !hasAnyToolActivity(overview) && (
        <p className="text-sm text-textMuted">{childName} hasn't used Focus Zone or the feelings cards yet.</p>
      )}

      {overview && hasAnyToolActivity(overview) && (() => {
        const focus = focusWeek(overview);
        const goal = goalProgress(overview.stars);
        const tasks = openTasks(overview.tasks);
        const habits = habitWeek(overview.habits, overview.checks);
        const feelings = recentFeelings(overview.feelings);
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Mini label="Focus sessions this week" value={String(focus.sessions)} />
              <Mini label="Focus minutes this week" value={String(focus.minutes)} />
              <Mini label="Days in a row" value={String(focus.streakDays)} />
            </div>

            <div>
              <p className="text-sm font-medium text-textHeading">
                ⭐ {goal.current} star{goal.current === 1 ? "" : "s"} toward {goal.icon ? `${goal.icon} ` : ""}{goal.title} ({goal.target})
              </p>
              <div className="mt-1.5 h-2.5 rounded-full bg-olive-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={goal.percent} aria-label="Progress to the star goal">
                <div className="h-2.5 rounded-full bg-deepGreen" style={{ width: `${goal.percent}%` }} />
              </div>
              <p className="mt-1 text-xs text-textMuted">
                {goal.lifetime} earned in all{goal.isDefault ? " · no goal chosen yet (this is the default)" : ""}
              </p>
            </div>

            {tasks.length > 0 && (
              <div>
                <p className="text-sm font-medium text-textHeading">Tasks in progress</p>
                <ul className="mt-1 space-y-1">
                  {tasks.map((t) => (
                    <li key={t.id} className="text-sm text-textBody">
                      {t.title} <span className="text-xs text-textMuted">· {t.total ? `${t.done} of ${t.total} steps` : "no steps yet"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {habits.length > 0 && (
              <div>
                <p className="text-sm font-medium text-textHeading">Habits, last 7 days</p>
                <ul className="mt-1 space-y-1.5">
                  {habits.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 text-sm text-textBody">
                      <span>{h.icon ? `${h.icon} ` : ""}{h.title}</span>
                      <span className="flex gap-1" aria-label={`${h.days.filter((d) => d.ticked).length} of 7 days`}>
                        {h.days.map((d) => (
                          <span
                            key={d.dateKey}
                            title={`${d.label}: ${d.ticked ? "done" : "not ticked"}`}
                            className={`h-3 w-3 rounded-full ${d.ticked ? "bg-deepGreen" : "bg-olive-100"}`}
                          />
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {feelings.length > 0 && (
              <div>
                <p className="text-sm font-medium text-textHeading">Feelings cards picked</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {feelings.map((f) => (
                    <li key={f.id} className="rounded-full bg-olive-50 px-3 py-1 text-xs text-textBody">
                      {f.emoji} {f.label} <span className="text-textMuted">· {when(f.at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })()}
    </Card>
  );
};

const Mini: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl bg-olive-50/60 px-3 py-3">
    <p className="font-display text-2xl text-textHeading">{value}</p>
    <p className="text-xs text-textMuted">{label}</p>
  </div>
);
