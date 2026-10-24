import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { acknowledgeReminder, getDueReminders, listMyRoutines, setRoutineStepCompleted } from "@safespace/api-client";
import { ROUTINE_STEP_ICONS, type DueReminder, type RoutineWithSteps } from "@safespace/shared-types";
import {
  ChildPageShell,
  localDate,
  nowNext,
  openReminders,
  childModuleKeys,
  reminderWhen,
  useChildSpace,
  type DayStep,
} from "../features/child-space";
import { ROUTES } from "../routes";
import { ReadAloudButton, reminderSpeech } from "../features/speech";

const REFRESH_MS = 60_000;

const TILES: { to: string; label: string; emoji: string }[] = [
  { to: ROUTES.CHILD_TALK, label: "Talk board", emoji: "🗣️" },
  { to: ROUTES.CHILD_STORIES, label: "Stories", emoji: "📖" },
  { to: ROUTES.CHILD_MOOD, label: "How I feel", emoji: "🌱" },
  { to: ROUTES.CHILD_ROUTINES, label: "My routines", emoji: "✅" },
  { to: ROUTES.CHILD_JOURNAL, label: "My journal", emoji: "📓" },
  { to: ROUTES.CHILD_REMINDERS, label: "Reminders", emoji: "⏰" },
  { to: ROUTES.CHILD_CALM_TOOLS, label: "Calm tools", emoji: "🍃" },
  { to: ROUTES.CHILD_COMPANION, label: "AI Companion", emoji: "💬" },
];
const MODULES_TILE = { to: ROUTES.CHILD_MODULES, label: "My spaces", emoji: "🌈" };
const SETTINGS_TILE = { to: ROUTES.CHILD_SETTINGS, label: "Settings", emoji: "⚙️" };

const emojiFor = (s: DayStep) => (s.icon ? ROUTINE_STEP_ICONS[s.icon]?.emoji : null) ?? "⭐";

// /child: Today. Now / Next from the routine schedule (P1), steps to tick off,
// reminders that are due or in their heads-up (P2), and a tile for every tool.
export const ChildHomePage: React.FC = () => {
  const { session, child, guard } = useChildSpace();
  const [now, setNow] = useState(() => new Date());
  const [routines, setRoutines] = useState<RoutineWithSteps[] | null>(null);
  const [due, setDue] = useState<DueReminder[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = new Date();
    setNow(t);
    try {
      const [r, d] = await Promise.all([
        guard(listMyRoutines(session, { date: localDate(t) })),
        guard(getDueReminders(session, t)),
      ]);
      setRoutines(r);
      setDue(d);
      setError(null);
    } catch {
      setError("Some things didn't load. Try again in a minute.");
    }
  }, [session, guard]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function tick(stepId: string, done: boolean) {
    setBusy(stepId);
    try {
      await guard(setRoutineStepCompleted(session, stepId, localDate(now), done));
      await load();
    } catch {
      setError("That didn't save. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function finishReminder(d: DueReminder) {
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

  const plan = routines ? nowNext(routines, now) : null;
  const reminders = openReminders(due);

  return (
    <ChildPageShell title={`Hi ${child.name}!`}>
      {error && <p role="alert" className="rounded-2xl bg-white px-4 py-3 text-sm text-red-700">{error}</p>}

      {reminders.length > 0 && (
        <section aria-label="Reminders" className="space-y-2">
          {reminders.map((d) => (
            <div key={`${d.reminder.id}-${d.occursOn}`} className="flex items-center justify-between gap-3 rounded-3xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">{reminderWhen(d, now)}</p>
                <p className="font-display text-lg font-bold">{d.reminder.title}</p>
              </div>
              <span className="flex items-center gap-2">
                <ReadAloudButton text={reminderSpeech(d)} label={`Read "${d.reminder.title}" aloud`} />
                <button
                  type="button"
                  onClick={() => finishReminder(d)}
                  disabled={busy === d.reminder.id}
                  className="rounded-full bg-botanical-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Done
                </button>
              </span>
            </div>
          ))}
        </section>
      )}

      {plan === null ? (
        <p className="text-sm font-semibold text-botanical-800">Loading today…</p>
      ) : plan.steps.length === 0 ? (
        <section className="rounded-3xl bg-white p-6 shadow-card text-center">
          <p className="font-display text-xl font-bold">Nothing planned for today</p>
          <p className="text-sm text-charcoal/70">Pick something below whenever you like.</p>
        </section>
      ) : plan.allDone ? (
        <section className="rounded-3xl bg-white p-6 shadow-card text-center">
          <p className="text-4xl" aria-hidden="true">🎉</p>
          <p className="font-display text-xl font-bold">All done for today!</p>
        </section>
      ) : (
        <section aria-label="Now and next" className="grid gap-3 sm:grid-cols-2">
          <NowCard label="Now" step={plan.now} emptyText="Nothing right now" onDone={plan.now ? () => tick(plan.now!.stepId, true) : undefined} busy={busy === plan.now?.stepId} />
          <NowCard label="Next" step={plan.next} emptyText="That's the last one" />
        </section>
      )}

      {plan && plan.steps.length > 0 && (
        <section className="rounded-3xl bg-white p-5 shadow-card">
          <h2 className="font-display text-xl font-bold mb-3">Today</h2>
          <ul className="space-y-2">
            {plan.steps.map((s) => (
              <li key={s.stepId}>
                <label className={`mt-0 flex items-center gap-3 rounded-2xl px-3 py-2 text-charcoal ${s.done ? "bg-botanical-50" : "bg-ivory-100"}`}>
                  <input
                    type="checkbox"
                    checked={s.done}
                    disabled={busy === s.stepId}
                    onChange={(e) => tick(s.stepId, e.target.checked)}
                    className="h-6 w-6 accent-botanical-700"
                  />
                  <span aria-hidden="true" className="text-2xl">{emojiFor(s)}</span>
                  <span className={`flex-1 text-base ${s.done ? "line-through text-charcoal/60" : ""}`}>{s.label}</span>
                  {s.time && <span className="text-sm font-semibold text-botanical-800">{s.time}</span>}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="My tools" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[...TILES, ...(childModuleKeys(child.assignedModules).length > 0 ? [MODULES_TILE] : []), SETTINGS_TILE].map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="flex flex-col items-center justify-center gap-1 rounded-3xl bg-white px-3 py-5 text-center shadow-card focus:outline-none focus:ring-2 focus:ring-botanical-700"
          >
            <span aria-hidden="true" className="text-3xl">{t.emoji}</span>
            <span className="font-display text-base font-bold">{t.label}</span>
          </Link>
        ))}
      </nav>
    </ChildPageShell>
  );
};

const NowCard: React.FC<{ label: string; step: DayStep | null; emptyText: string; onDone?: () => void; busy?: boolean }> = ({
  label,
  step,
  emptyText,
  onDone,
  busy,
}) => (
  <div className={`rounded-3xl p-5 shadow-card ${label === "Now" ? "bg-botanical-700 text-white" : "bg-white"}`}>
    <div className="flex items-center justify-between gap-2">
      <p className={`text-xs font-semibold uppercase tracking-wider ${label === "Now" ? "text-white/80" : "text-botanical-800"}`}>{label}</p>
      {step && (
        <ReadAloudButton
          text={`${label}: ${step.label}${step.time ? ` at ${step.time}` : ""}.`}
          label={`Read ${label.toLowerCase()} aloud`}
          tone={label === "Now" ? "dark" : "light"}
        />
      )}
    </div>
    {step ? (
      <>
        <p className="mt-1 flex items-center gap-3">
          <span aria-hidden="true" className="text-4xl">{emojiFor(step)}</span>
          <span className="font-display text-2xl font-bold">{step.label}</span>
        </p>
        <p className={`text-sm ${label === "Now" ? "text-white/80" : "text-charcoal/70"}`}>
          {step.routineTitle}{step.time ? ` · ${step.time}` : ""}
        </p>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            disabled={busy}
            className="mt-3 rounded-full bg-white px-5 py-2 text-sm font-bold text-botanical-800 disabled:opacity-60"
          >
            I did it!
          </button>
        )}
      </>
    ) : (
      <p className="mt-1 font-display text-lg">{emptyText}</p>
    )}
  </div>
);

export default ChildHomePage;
