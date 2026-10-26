import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { getDueReminders, listMyRoutines } from "@safespace/api-client";
import { ROUTINE_STEP_ICONS, type AppSession } from "@safespace/shared-types";
import { Card } from "../../components/ui/Card";
import { localDate } from "../child-space/childHome";
import { todaySummary, type TodaySummary } from "./toolsLogic";

interface Props {
  session: AppSession;
  routinesPath: string;
  remindersPath: string;
}

const REFRESH_MS = 60_000;

// The Individual dashboard's "Today": the routine step to do now and any
// reminders due, linking to the full pages.
export const TodayCard: React.FC<Props> = ({ session, routinesPath, remindersPath }) => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const now = new Date();
      try {
        const [routines, due] = await Promise.all([
          listMyRoutines(session, { date: localDate(now) }),
          getDueReminders(session, now),
        ]);
        if (active) {
          setSummary(todaySummary(routines, due, now));
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session]);

  const step = summary?.current;
  const emoji = step?.icon ? ROUTINE_STEP_ICONS[step.icon]?.emoji : null;
  return (
    <Card className="p-6 border border-olive-100 space-y-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
        {t("home.child.today")}
      </span>
      {error && <p className="text-sm text-textMuted">{t("home.today.error")}</p>}
      {!summary && !error && <p className="text-sm text-textMuted">{t("home.child.loading")}</p>}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to={summary.hasRoutines ? routinesPath : `${routinesPath}?edit=1`} className="rounded-2xl bg-olive-50/70 border border-olive-100 px-4 py-3 hover:bg-olive-50 focus:outline-none focus:ring-2 focus:ring-olive-500">
            <span className="block text-xs text-textMuted">{t("tiles.routines")}</span>
            {!summary.hasRoutines ? (
              <span className="block text-sm text-textHeading">{t("home.today.noRoutines")}</span>
            ) : summary.allDone ? (
              <span className="block text-sm text-textHeading">{t("home.today.allDone")} 🎉</span>
            ) : step ? (
              <span className="block text-sm text-textHeading">
                {t("home.today.now")} {emoji && <span aria-hidden="true">{emoji} </span>}<strong>{step.label}</strong>
                <span className="block text-xs text-textMuted">{t("home.today.stepsLeft", { count: summary.stepsLeft })}</span>
              </span>
            ) : (
              <span className="block text-sm text-textHeading">
                {t("home.today.nothingDue")}
                <span className="block text-xs text-textMuted">{t("home.today.stepsLater", { count: summary.stepsLeft })}</span>
              </span>
            )}
          </Link>
          <Link to={remindersPath} className="rounded-2xl bg-olive-50/70 border border-olive-100 px-4 py-3 hover:bg-olive-50 focus:outline-none focus:ring-2 focus:ring-olive-500">
            <span className="block text-xs text-textMuted">{t("tiles.reminders")}</span>
            <span className="block text-sm text-textHeading">
              {summary.remindersDue === 0
                ? t("home.today.noReminders")
                : <Trans i18nKey="home.today.remindersDue" count={summary.remindersDue} components={{ b: <strong /> }} />}
            </span>
          </Link>
        </div>
      )}
    </Card>
  );
};
