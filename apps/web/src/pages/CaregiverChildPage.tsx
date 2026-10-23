import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getChildDetail } from "@safespace/api-client";
import type { CaregiverChildDetail, WellnessPeriodDays } from "@safespace/shared-types";
import { Card } from "../components/ui/Card";
import { MoodHistoryList } from "../features/mood";
import {
  AiChatList,
  CaregiverPageShell,
  ROLE_LABELS,
  SHARING_LABELS,
  aiChatsNote,
  caregiverChildPath,
  hiddenActivityText,
  iconEmoji,
} from "../features/caregiver";
import { ROUTES } from "../routes";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const days = (d: number[]) => (d.length === 0 || d.length === 7 ? "Every day" : d.map((n) => DAY_NAMES[n]).join(", "));

// /caregiver/children/:childId: one child's day and recent activity, as the
// age-15 sharing rule allows (docs/role-flow/CONTRACT.md sections 3 and 5).
export const CaregiverChildPage: React.FC = () => {
  const { childId = "" } = useParams();
  const [period, setPeriod] = useState<WellnessPeriodDays>(7);
  const [detail, setDetail] = useState<CaregiverChildDetail | null>(null);
  const [error, setError] = useState<"not_found" | "failed" | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    getChildDetail(childId, period)
      .then((d) => active && setDetail(d))
      .catch((e: unknown) => active && setError((e as Error).message === "not_found" ? "not_found" : "failed"));
    return () => {
      active = false;
    };
  }, [childId, period]);

  if (error === "not_found") {
    return (
      <CaregiverPageShell title="Child not found" backTo={ROUTES.CAREGIVER_HOME}>
        <Card><p className="text-textBody">This child isn't one of yours, or no longer is.</p></Card>
      </CaregiverPageShell>
    );
  }
  if (!detail) {
    return (
      <CaregiverPageShell title="Loading..." backTo={ROUTES.CAREGIVER_HOME}>
        {error && <p role="alert" className="text-sm text-red-700">Couldn't load this child right now.</p>}
      </CaregiverPageShell>
    );
  }

  const { child, activity, summary } = detail;
  const note = aiChatsNote(child.name, detail.sharing);
  const periodButton = (p: WellnessPeriodDays) =>
    `px-3 py-1.5 rounded-xl text-xs font-medium ${period === p ? "bg-white text-deepGreen shadow-sm" : "text-textMuted"}`;

  return (
    <CaregiverPageShell
      title={child.name}
      subtitle={`Age ${detail.ageYears} · ${SHARING_LABELS[detail.sharing]} · ${ROLE_LABELS[detail.myRole]}`}
      backTo={ROUTES.CAREGIVER_HOME}
    >
      <nav aria-label={`Manage ${child.name}`} className="flex flex-wrap gap-2">
        {([["routines", "Routines"], ["reminders", "Reminders"], ["settings", "Settings"], ["caregivers", "Caregivers"]] as const).map(([section, label]) => (
          <Link
            key={section}
            to={caregiverChildPath(child.id, section)}
            className="rounded-full border border-olive-200 bg-white px-4 py-1.5 text-xs font-semibold text-deepGreen hover:bg-olive-50"
          >
            {label}
          </Link>
        ))}
      </nav>
      {error && <p role="alert" className="text-sm text-red-700">Couldn't refresh right now; showing what was loaded.</p>}
      {detail.unreviewedAlerts > 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-medium">
            {detail.unreviewedAlerts} alert{detail.unreviewedAlerts === 1 ? "" : "s"} for {child.name} to review.
          </span>
          <Link to={ROUTES.CAREGIVER_ALERTS} className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white">
            Review alerts
          </Link>
        </div>
      )}

      <Section title="Today's routines" action={{ to: caregiverChildPath(child.id, "routines"), label: "Set up routines" }}>
        {detail.routines.length === 0 ? (
          <p className="text-sm text-textMuted">No routines today.</p>
        ) : (
          <ul className="space-y-3">
            {detail.routines.map((r) => (
              <li key={r.id}>
                <p className="text-sm font-medium text-textHeading">{r.title} <span className="text-xs font-normal text-textMuted">· {days(r.daysOfWeek)}</span></p>
                <ul className="mt-1 space-y-1">
                  {r.steps.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-sm text-textBody">
                      <span aria-hidden="true">{activity.visible ? (s.completedOnDate ? "✅" : "⬜") : "•"}</span>
                      {iconEmoji(s.icon) && <span aria-hidden="true">{iconEmoji(s.icon)}</span>}
                      <span>{s.scheduledTime ? `${s.scheduledTime} ` : ""}{s.label}</span>
                      {activity.visible && <span className="sr-only">{s.completedOnDate ? "done" : "not done yet"}</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Reminders" action={{ to: caregiverChildPath(child.id, "reminders"), label: "Set up reminders" }}>
        {detail.reminders.length === 0 ? (
          <p className="text-sm text-textMuted">No reminders set up.</p>
        ) : (
          <ul className="space-y-1">
            {detail.reminders.map((r) => (
              <li key={r.id} className="text-sm text-textBody">
                {r.timeOfDay} · {r.title} <span className="text-xs text-textMuted">· {days(r.daysOfWeek)}
                {r.leadMinutes > 0 && ` · ${r.leadMinutes} min heads-up`}{!r.isEnabled && " · off"}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {!activity.visible ? (
        <Card className="p-6 border border-olive-100">
          <p className="text-textBody">{hiddenActivityText(child.name)}</p>
          <p className="text-xs text-textMuted mt-1">
            Only {child.name} can change this. Alerts, routines and reminders still show here.
          </p>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-medium text-textHeading">Recent activity</h2>
            <div role="group" aria-label="Period" className="inline-flex gap-1 rounded-2xl border border-olive-100 bg-olive-50/60 p-1">
              <button className={periodButton(7)} aria-pressed={period === 7} onClick={() => setPeriod(7)}>7 days</button>
              <button className={periodButton(30)} aria-pressed={period === 30} onClick={() => setPeriod(30)}>30 days</button>
            </div>
          </div>

          {summary && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Days with a check-in" value={`${summary.mood.daysWithCheckin} / ${summary.periodDays}`} />
              <Stat label="Routine steps done" value={`${summary.routines.completedSteps} / ${summary.routines.scheduledSteps}`} />
              <Stat label="Journal entries" value={String(summary.journal.entries)} />
            </div>
          )}

          <Section title="Mood check-ins">
            <MoodHistoryList history={detail.recentMoods ?? []} status="ready" errorMessage={null} onRetry={() => {}} title="Latest check-ins" />
          </Section>

          <Section title="Journal">
            {(detail.recentJournal ?? []).length === 0 ? (
              <p className="text-sm text-textMuted">No journal entries yet.</p>
            ) : (
              <ul className="space-y-3">
                {detail.recentJournal!.map((j) => (
                  <li key={j.id} className="rounded-2xl bg-olive-50/50 px-4 py-3">
                    <p className="text-xs text-textMuted">{new Date(j.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    <p className="text-sm text-textBody whitespace-pre-wrap break-words">{j.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="AI Companion chats">
            {note && <p className="text-xs text-textMuted">{note}</p>}
            <AiChatList childId={child.id} childName={child.name} conversations={detail.aiConversations ?? []} />
          </Section>

          <p className="text-xs text-textMuted">These are counts and entries, not an assessment.</p>
        </>
      )}
    </CaregiverPageShell>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode; action?: { to: string; label: string } }> = ({
  title,
  children,
  action,
}) => (
  <Card className="p-6 space-y-3 border border-olive-100">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-display text-lg font-medium text-textHeading">{title}</h2>
      {action && (
        <Link to={action.to} className="text-xs font-semibold text-deepGreen underline">
          {action.label}
        </Link>
      )}
    </div>
    {children}
  </Card>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl bg-white border border-olive-100 p-3">
    <div className="font-display text-xl text-textHeading">{value}</div>
    <div className="text-[11px] text-textMuted leading-tight mt-1">{label}</div>
  </div>
);

export default CaregiverChildPage;
