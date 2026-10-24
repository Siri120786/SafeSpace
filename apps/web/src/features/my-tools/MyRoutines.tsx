import React, { useCallback, useEffect, useState } from "react";
import { listMyRoutines, setRoutineStepCompleted } from "@safespace/api-client";
import { ROUTINE_STEP_ICONS, type AppSession, type RoutineWithSteps } from "@safespace/shared-types";
import { recentDays } from "./toolsLogic";

export type Guard = <T>(p: Promise<T>) => Promise<T>;
const noGuard: Guard = (p) => p;

interface Props {
  session: AppSession;
  guard?: Guard;
  emptyText?: string;
}

// The signed-in person's routines for a day (today or up to 6 days back),
// ticking each step. Shared by children and Individuals.
export const MyRoutines: React.FC<Props> = ({ session, guard = noGuard, emptyText = "No routines for this day." }) => {
  const days = recentDays(new Date());
  const [date, setDate] = useState(days[0].date);
  const [routines, setRoutines] = useState<RoutineWithSteps[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRoutines(await guard(listMyRoutines(session, { date })));
      setError(null);
    } catch {
      setError("Couldn't load routines right now.");
    }
  }, [session, guard, date]);

  useEffect(() => {
    setRoutines(null);
    load();
  }, [load]);

  async function tick(stepId: string, done: boolean) {
    setBusy(stepId);
    try {
      await guard(setRoutineStepCompleted(session, stepId, date, done));
      await load();
    } catch {
      setError("That didn't save. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <label className="mt-0 block text-sm font-semibold text-charcoal">
        Day
        <select
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-base"
        >
          {days.map((d) => <option key={d.date} value={d.date}>{d.label}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {routines === null && !error && <p className="text-sm">Loading…</p>}
      {routines?.length === 0 && <p className="rounded-3xl bg-white p-5 text-base shadow-card">{emptyText}</p>}
      {routines?.map((r) => {
        const done = r.steps.filter((s) => s.completedOnDate).length;
        return (
          <section key={r.id} className="rounded-3xl bg-white p-5 shadow-card">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 className="font-display text-xl font-bold text-charcoal">{r.title}</h2>
              <span className="text-sm text-charcoal/70">{done} of {r.steps.length} done</span>
            </div>
            <ul className="space-y-2">
              {r.steps.map((s) => (
                <li key={s.id}>
                  <label className={`mt-0 flex items-center gap-3 rounded-2xl px-3 py-2 text-charcoal ${s.completedOnDate ? "bg-botanical-50" : "bg-ivory-100"}`}>
                    <input
                      type="checkbox"
                      checked={s.completedOnDate}
                      disabled={busy === s.id}
                      onChange={(e) => tick(s.id, e.target.checked)}
                      className="h-6 w-6 accent-botanical-700"
                    />
                    <span aria-hidden="true" className="text-2xl">{(s.icon && ROUTINE_STEP_ICONS[s.icon]?.emoji) || "⭐"}</span>
                    <span className={`flex-1 text-base ${s.completedOnDate ? "line-through text-charcoal/60" : ""}`}>{s.label}</span>
                    {s.scheduledTime && <span className="text-sm font-semibold text-botanical-800">{s.scheduledTime}</span>}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
};
