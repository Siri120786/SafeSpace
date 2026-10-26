import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { acknowledgeReminder, getDueReminders, listMyRoutines, setRoutineStepCompleted } from "@safespace/api-client";
import { ROUTINE_STEP_ICONS, type DueReminder, type RoutineWithSteps } from "@safespace/shared-types";
import {
  localDate,
  nowNext,
  openReminders,
  childModuleKeys,
  useChildSpace,
  type DayStep,
} from "../features/child-space";
import { ROUTES } from "../routes";
import { childToolPath, splitConditionTools } from "../features/conditions";
import { ReadAloudButton, reminderSpeech } from "../features/speech";
import { useMusicPlayer } from "../features/music";
import { ThemedHome, ToolThemePicker, useAppTheme } from "../features/themes";
import { TryNext } from "../features/recommendations/TryNext";

const REFRESH_MS = 60_000;

// Labels are tiles.<key> in the locale files.
const TILES: { to: string; key: string; emoji: string }[] = [
  { to: ROUTES.CHILD_TALK, key: "talkBoard", emoji: "🗣️" },
  { to: ROUTES.CHILD_STORIES, key: "stories", emoji: "📖" },
  { to: ROUTES.CHILD_MOOD, key: "howIFeel", emoji: "🌱" },
  { to: ROUTES.CHILD_ROUTINES, key: "myRoutines", emoji: "✅" },
  { to: ROUTES.CHILD_JOURNAL, key: "myJournal", emoji: "📓" },
  { to: ROUTES.CHILD_REMINDERS, key: "reminders", emoji: "⏰" },
  { to: ROUTES.CHILD_CALM_SPACE, key: "calmSpace", emoji: "🌊" },
  { to: ROUTES.CHILD_GAMES, key: "games", emoji: "🎲" },
  { to: ROUTES.CHILD_COMPANION, key: "companion", emoji: "💬" },
  { to: ROUTES.CHILD_NUTRITION, key: "nutrition", emoji: "🥕" },
];
// Where each "Try this next" suggestion goes; Music is dropped when it's off.
const TRY_NEXT_ROUTES = {
  mood_check_in: ROUTES.CHILD_MOOD,
  calm_space: ROUTES.CHILD_CALM_SPACE,
  routines: ROUTES.CHILD_ROUTINES,
  journal: ROUTES.CHILD_JOURNAL,
  music: ROUTES.CHILD_MUSIC,
  games: ROUTES.CHILD_GAMES,
  companion: ROUTES.CHILD_COMPANION,
  stories: ROUTES.CHILD_STORIES,
};
const MUSIC_TILE = { to: ROUTES.CHILD_MUSIC, key: "music", emoji: "🎵" };
const MODULES_TILE = { to: ROUTES.CHILD_MODULES, key: "mySpaces", emoji: "🌈" };
const SETTINGS_TILE = { to: ROUTES.CHILD_SETTINGS, key: "settings", emoji: "⚙️" };

type Translate = (key: string, options?: Record<string, unknown>) => string;

// English, for callers without a translator (and the tests).
const ENGLISH_STATUS: Record<string, string> = {
  "home.child.statusEmpty": "Nothing planned today. Pick anything you like!",
  "home.child.statusDone": "All done for today. Well done!",
  "home.child.statusLeft_one": "1 step left today. You've got this!",
  "home.child.statusLeft_other": "{{count}} steps left today. You've got this!",
};
const english: Translate = (key, o) => {
  const k = key === "home.child.statusLeft" ? `${key}_${o?.count === 1 ? "one" : "other"}` : key;
  return (ENGLISH_STATUS[k] ?? key).replace("{{count}}", String(o?.count ?? ""));
};

// A short word about today, for a theme's guide to say.
export function dayStatus(plan: { steps: DayStep[]; allDone: boolean } | null, t: Translate = english): string | undefined {
  if (!plan) return undefined;
  if (plan.steps.length === 0) return t("home.child.statusEmpty");
  if (plan.allDone) return t("home.child.statusDone");
  const left = plan.steps.filter((s) => !s.done).length;
  return t("home.child.statusLeft", { count: left });
}

// "Now" once its time has come; during a heads-up, "In 5 minutes".
function reminderWhenText(occursAt: string, now: Date, t: Translate): string {
  const mins = Math.ceil((new Date(occursAt).getTime() - now.getTime()) / 60_000);
  return mins <= 0 ? t("home.child.now") : t("home.child.inMinutes", { count: mins });
}

const emojiFor = (s: DayStep) => (s.icon ? ROUTINE_STEP_ICONS[s.icon]?.emoji : null) ?? "⭐";

// /child: Today. Now / Next from the routine schedule (P1), steps to tick off,
// reminders that are due or in their heads-up (P2), and a tile for every tool.
// In a designed theme (Space, Animals: for the ADHD or autism module) the
// same day sits on a light panel under the theme's greeting, with its tiles.
export const ChildHomePage: React.FC = () => {
  const { t } = useTranslation();
  const { session, child, guard } = useChildSpace();
  const tools = splitConditionTools(child.assignedModules);
  const { musicOff } = useMusicPlayer();
  const theme = useAppTheme();
  const [now, setNow] = useState(() => new Date());
  const [routines, setRoutines] = useState<RoutineWithSteps[] | null>(null);
  const [due, setDue] = useState<DueReminder[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const at = new Date();
    setNow(at);
    try {
      const [r, d] = await Promise.all([
        guard(listMyRoutines(session, { date: localDate(at) })),
        guard(getDueReminders(session, at)),
      ]);
      setRoutines(r);
      setDue(d);
      setError(null);
    } catch {
      setError(t("home.child.errorLoad"));
    }
  }, [session, guard, t]);

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
      setError(t("home.child.errorSave"));
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
      setError(t("home.child.errorSave"));
    } finally {
      setBusy(null);
    }
  }

  const plan = routines ? nowNext(routines, now) : null;
  const reminders = openReminders(due);

  const tiles = [
    // The tools for this child's own modules first (role-flow 8c).
    ...tools.mine.map((tool) => ({ to: childToolPath(tool.key), label: t(`tiles.tool.${tool.key}`, { defaultValue: tool.label }), emoji: tool.emoji })),
    ...[
      ...TILES.slice(0, 2),
      // Hidden when their caregiver has turned music off (role-flow 9c).
      ...(musicOff ? [] : [MUSIC_TILE]),
      ...TILES.slice(2),
      ...(childModuleKeys(child.assignedModules).length > 0 ? [MODULES_TILE] : []),
      // Always a way to the tools page; named for what it adds.
      { to: ROUTES.CHILD_TOOLS, key: tools.more.length === 0 ? "allMyTools" : tools.mine.length ? "moreTools" : "focusFeelings", emoji: "🧰" },
      SETTINGS_TILE,
    ].map((tile) => ({ to: tile.to, label: t(`tiles.${tile.key}`), emoji: tile.emoji })),
  ];

  const today = (
    <>
      {error && <p role="alert" className="rounded-2xl bg-white px-4 py-3 text-sm text-red-700">{error}</p>}

      {reminders.length > 0 && (
        <section aria-label={t("tiles.reminders")} className="space-y-2">
          {reminders.map((d) => (
            <div key={`${d.reminder.id}-${d.occursOn}`} className="flex items-center justify-between gap-3 rounded-3xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">{reminderWhenText(d.occursAt, now, t)}</p>
                <p className="font-display text-lg font-bold">{d.reminder.title}</p>
              </div>
              <span className="flex items-center gap-2">
                <ReadAloudButton text={reminderSpeech(d)} label={t("home.child.readAloud", { title: d.reminder.title })} />
                <button
                  type="button"
                  onClick={() => finishReminder(d)}
                  disabled={busy === d.reminder.id}
                  className="rounded-full bg-botanical-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {t("common.done")}
                </button>
              </span>
            </div>
          ))}
        </section>
      )}

      {plan === null ? (
        <p className="text-sm font-semibold text-botanical-800">{t("home.child.loading")}</p>
      ) : plan.steps.length === 0 ? (
        <section className="rounded-3xl bg-white p-6 shadow-card text-center">
          <p className="font-display text-xl font-bold">{t("home.child.nothingTitle")}</p>
          <p className="text-sm text-charcoal/70">{t("home.child.nothingText")}</p>
        </section>
      ) : plan.allDone ? (
        <section className="rounded-3xl bg-white p-6 shadow-card text-center">
          <p className="text-4xl" aria-hidden="true">🎉</p>
          <p className="font-display text-xl font-bold">{t("home.child.allDone")}</p>
        </section>
      ) : (
        <section aria-label={t("home.child.nowAndNext")} className="grid gap-3 sm:grid-cols-2">
          <NowCard kind="now" step={plan.now} emptyText={t("home.child.nothingNow")} onDone={plan.now ? () => tick(plan.now!.stepId, true) : undefined} busy={busy === plan.now?.stepId} />
          <NowCard kind="next" step={plan.next} emptyText={t("home.child.lastOne")} />
        </section>
      )}

      {plan && plan.steps.length > 0 && (
        <section className="rounded-3xl bg-white p-5 shadow-card">
          <h2 className="font-display text-xl font-bold mb-3">{t("home.child.today")}</h2>
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

      <TryNext session={session} routes={musicOff ? { ...TRY_NEXT_ROUTES, music: undefined } : TRY_NEXT_ROUTES} />
    </>
  );

  // The meadow look (the landing page's boy and puppy) for every child; with
  // the ADHD or autism module, their chosen theme. Low-sensory mode keeps it
  // still.
  return (
    <ThemedHome
      theme={theme.active === "plain" ? "calm" : theme.active}
      stillOnly={theme.lowSensory}
      eyebrow={t("home.child.eyebrow")}
      greeting={t("home.child.greeting", { name: child.name })}
      line={t("home.child.line")}
      status={dayStatus(plan, t)}
      picker={theme.canChoose ? <ToolThemePicker look="bold" value={theme.chosen} onChange={theme.choose} /> : undefined}
      tiles={tiles}
      tilesLabel={t("home.child.tilesLabel")}
    >
      {today}
    </ThemedHome>
  );
};

const NowCard: React.FC<{ kind: "now" | "next"; step: DayStep | null; emptyText: string; onDone?: () => void; busy?: boolean }> = ({
  kind,
  step,
  emptyText,
  onDone,
  busy,
}) => {
  const { t } = useTranslation();
  const isNow = kind === "now";
  const label = t(isNow ? "home.child.now" : "home.child.next");
  return (
  <div className={`rounded-3xl p-5 shadow-card ${isNow ? "bg-botanical-700 text-white" : "bg-white"}`}>
    <div className="flex items-center justify-between gap-2">
      <p className={`text-xs font-semibold uppercase tracking-wider ${isNow ? "text-white/80" : "text-botanical-800"}`}>{label}</p>
      {step && (
        <ReadAloudButton
          text={step.time
            ? t("home.child.speakStepAt", { label, step: step.label, time: step.time })
            : t("home.child.speakStep", { label, step: step.label })}
          label={t(isNow ? "home.child.readNow" : "home.child.readNext")}
          tone={isNow ? "dark" : "light"}
        />
      )}
    </div>
    {step ? (
      <>
        <p className="mt-1 flex items-center gap-3">
          <span aria-hidden="true" className="text-4xl">{emojiFor(step)}</span>
          <span className="font-display text-2xl font-bold">{step.label}</span>
        </p>
        <p className={`text-sm ${isNow ? "text-white/80" : "text-charcoal/70"}`}>
          {step.routineTitle}{step.time ? ` · ${step.time}` : ""}
        </p>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            disabled={busy}
            className="mt-3 rounded-full bg-white px-5 py-2 text-sm font-bold text-botanical-800 disabled:opacity-60"
          >
            {t("home.child.didIt")}
          </button>
        )}
      </>
    ) : (
      <p className="mt-1 font-display text-lg">{emptyText}</p>
    )}
  </div>
  );
};

export default ChildHomePage;
