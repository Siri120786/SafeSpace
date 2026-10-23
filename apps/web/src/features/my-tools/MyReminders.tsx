import React, { useCallback, useEffect, useState } from "react";
import { acknowledgeReminder, getDueReminders, listReminders } from "@safespace/api-client";
import type { AppSession, DueReminder, Reminder } from "@safespace/shared-types";
import { laterToday } from "./toolsLogic";
import { ReadAloudButton, reminderSpeech } from "../speech";
import type { Guard } from "./MyRoutines";

const REFRESH_MS = 60_000;

interface Props {
  session: AppSession;
  guard?: Guard;
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

// Today's reminders: what's due now (including heads-ups), what's done, and
// what's still to come. Refreshes every minute while open.
export const MyReminders: React.FC<Props> = ({ session, guard = (p) => p }) => {
  const [due, setDue] = useState<DueReminder[] | null>(null);
  const [all, setAll] = useState<Reminder[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = new Date();
    setNow(t);
    try {
      const [d, r] = await Promise.all([guard(getDueReminders(session, t)), guard(listReminders(session))]);
      setDue(d);
      setAll(r);
      setError(null);
    } catch {
      setError("Couldn't load reminders right now.");
    }
  }, [session, guard]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function done(d: DueReminder) {
    setBusy(d.reminder.id);
    try {
      await guard(acknowledgeReminder(session, d.reminder.id, d.occursOn));
      await load();
    } catch {
      setError("That didn't save. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (due === null) return error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <p className="text-sm">Loading…</p>;

  const open = due.filter((d) => !d.acknowledged);
  const finished = due.filter((d) => d.acknowledged);
  const later = laterToday(all, due, now);
  const card = "rounded-3xl bg-white p-5 shadow-card space-y-2";

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <section className={card}>
        <h2 className="font-display text-xl font-bold text-charcoal">Now</h2>
        {open.length === 0 ? (
          <p className="text-base">Nothing to do right now.</p>
        ) : (
          <ul className="space-y-2">
            {open.map((d) => (
              <li key={`${d.reminder.id}-${d.occursOn}`} className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-3 py-2">
                <span className="text-base text-charcoal">
                  <span className="font-semibold">{timeOf(d.occursAt)}</span> · {d.reminder.title}
                </span>
                <span className="flex items-center gap-2">
                  <ReadAloudButton text={reminderSpeech(d)} label={`Read "${d.reminder.title}" aloud`} />
                  <button
                    type="button"
                    onClick={() => done(d)}
                    disabled={busy === d.reminder.id}
                    className="rounded-full bg-botanical-700 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Done
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="font-display text-xl font-bold text-charcoal">Later today</h2>
        {later.length === 0 ? (
          <p className="text-base">Nothing else today.</p>
        ) : (
          <ul className="space-y-1">
            {later.map((r) => (
              <li key={r.id} className="text-base text-charcoal"><span className="font-semibold">{r.timeOfDay}</span> · {r.title}</li>
            ))}
          </ul>
        )}
      </section>

      {finished.length > 0 && (
        <section className={card}>
          <h2 className="font-display text-xl font-bold text-charcoal">Done today</h2>
          <ul className="space-y-1">
            {finished.map((d) => (
              <li key={`${d.reminder.id}-${d.occursOn}`} className="text-base text-charcoal/70 line-through">
                {timeOf(d.occursAt)} · {d.reminder.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
