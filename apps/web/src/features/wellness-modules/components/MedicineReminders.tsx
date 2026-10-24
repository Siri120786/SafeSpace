import React, { useCallback, useEffect, useState } from "react";
import {
  acknowledgeReminder,
  createReminder,
  deleteReminder,
  getDueReminders,
  listReminders,
} from "@safespace/api-client";
import type { AppSession, DueReminder, Reminder } from "@safespace/shared-types";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import {
  DAY_LABELS,
  MEDICINE_TITLES,
  REMINDER_PRIVACY_NOTE,
  browserTimeZone,
  buildMedicineReminder,
  describeSchedule,
  dueMedicineAlerts,
  medicationReminders,
} from "../lib/medicineReminders";

const fieldClass =
  "w-full rounded-2xl border border-olive-200 bg-white px-4 py-3 text-base text-textBody focus:outline-none focus:ring-2 focus:ring-olive-500";

/** How often the open page re-checks what is due. Alerts are in-app only. */
const POLL_MS = 30_000;

export const MedicineReminders: React.FC<{ session?: AppSession }> = ({ session = null }) => {
  const signedIn = session?.kind === "auth_user";
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [due, setDue] = useState<DueReminder[]>([]);
  const [title, setTitle] = useState<string>(MEDICINE_TITLES[0]);
  const [time, setTime] = useState("08:00");
  const [days, setDays] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!session || session.kind !== "auth_user") return;
    try {
      const [all, dueNow] = await Promise.all([listReminders(session), getDueReminders(session)]);
      setReminders(medicationReminders(all));
      setDue(dueMedicineAlerts(dueNow));
    } catch {
      setError("Could not load your reminders right now.");
    }
  }, [session]);

  useEffect(() => {
    if (!signedIn) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [signedIn, refresh]);

  const add = async () => {
    const built = buildMedicineReminder(title, time, days, browserTimeZone());
    if (!built.ok) return setError(built.error);
    setError(null);
    setBusy(true);
    try {
      await createReminder({ kind: "self" }, built.input);
      await refresh();
    } catch {
      setError("Could not save that reminder. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteReminder(id);
      await refresh();
    } catch {
      setError("Could not remove that reminder.");
    }
  };

  const done = async (d: DueReminder) => {
    if (!session) return;
    try {
      await acknowledgeReminder(session, d.reminder.id, d.occursOn);
      await refresh();
    } catch {
      setError("Could not mark that as done.");
    }
  };

  return (
    <Card className="space-y-3">
      <h2 className="font-display text-xl text-textHeading">Medicine and supplement reminders</h2>

      {due.map((d) => (
        <div key={`${d.reminder.id}-${d.occursOn}`} role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-olive-500 bg-white px-4 py-3">
          <span className="text-base text-textHeading">{d.reminder.title}</span>
          <Button size="sm" variant="olive" onClick={() => void done(d)}>
            Done
          </Button>
        </div>
      ))}

      {!signedIn ? (
        <p role="status" className="text-sm text-textBody">
          Sign in with your adult account to set reminders.
        </p>
      ) : (
        <>
          <label htmlFor="med-title" className="block text-sm text-textBody">
            Reminder line
          </label>
          <select id="med-title" className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)}>
            {MEDICINE_TITLES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label htmlFor="med-time" className="block text-sm text-textBody">
            Time
          </label>
          <input id="med-time" type="time" className={fieldClass} value={time} onChange={(e) => setTime(e.target.value)} />
          <fieldset className="space-y-1">
            <legend className="text-sm text-textBody">Days (leave empty for every day)</legend>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((label, i) => (
                <Button key={label} size="sm" variant={days.includes(i) ? "olive" : "outline"} aria-pressed={days.includes(i)} onClick={() => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))}>
                  {label}
                </Button>
              ))}
            </div>
          </fieldset>
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void add()}>
            Add reminder
          </Button>
          <ul className="space-y-1">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-base text-textBody">
                <span>
                  {r.title} · {describeSchedule(r)}
                </span>
                <Button size="sm" variant="ghost" aria-label={`Remove reminder at ${r.timeOfDay}`} onClick={() => void remove(r.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="text-sm text-textMuted">{REMINDER_PRIVACY_NOTE}</p>
    </Card>
  );
};
