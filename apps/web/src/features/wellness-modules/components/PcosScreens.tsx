import React, { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DuskShell, type DuskPage } from "../../conditions/pcos-pcod/dusk/DuskShell";
import {
  ABOUT,
  CONDITIONS,
  DIFFERENCES,
  DIFFERENCES_NOTE,
  MOVE_SHARED_NOTE,
  MYTHS_NOTE,
  TERMS_NOTE,
  YOGA_NOTE,
  moveFocusFor,
  mythsFor,
} from "../lib/condition";
import {
  ACTIVITIES,
  EMPTY_EXERCISE,
  LONG_DAY_NOTE,
  REST_NOTE,
  WEEKDAYS,
  activityLabel,
  addEntry,
  dateKey,
  entriesOn,
  exerciseReaction,
  isLongDay,
  minutesOn,
  parseMinutes,
  planStatus,
  removeEntry,
  sanitizeExercise,
  setPlanDay,
  setWeeklyGoal,
  summarizeWeek,
  weekDates,
  weekMessage,
  type ActivityType,
  type ExerciseState,
} from "../lib/exercise";
import { EMPTY_ASSESSMENT, sanitizeAssessment, type Assessment } from "../lib/healthAssessment";
import { Coach, DietSection, ProfileSection } from "./CycleCareHealth";
import { WaterTally } from "./CycleCareExtras";
import { MovementPicker } from "./CycleCareExtras";
import { Notes, type ModuleScreenProps } from "./ModuleScreens";
import { useCycleCarePart, useCycleCareStore } from "./useCycleCarePart";
import { CycleCareAccountNote } from "./CycleCareAccountNote";
import { useCondition } from "./useCondition";
import { MythsTopic, SleepTopic, SymptomsTopic, WellbeingTopic } from "./PcosTopics";
import { canOpenCycleCare } from "../lib/content";

const fieldClass =
  "w-full rounded-2xl border border-olive-200 bg-white px-4 py-3 text-base text-textBody focus:outline-none focus:ring-2 focus:ring-olive-500";

const baseOf = (p: ModuleScreenProps) => p.paths?.base ?? "/modules";

// The PCOS / PCOD pages sit on the dusk hillside (the module's own look).
export const PcosShell: React.FC<
  ModuleScreenProps & { title: string; heading?: string; page: DuskPage; lead?: string; children: React.ReactNode }
> = ({ title, heading, page, lead, children, ...p }) => (
  <DuskShell title={title} heading={heading} page={page} lead={lead} base={baseOf(p)} lowSensory={p.lowSensory} onExit={p.onExit} notice={p.notice}>
    {children}
  </DuskShell>
);

export const AdultsOnly: React.FC<ModuleScreenProps & { title: string; page: DuskPage }> = ({ title, page, ...p }) => (
  <PcosShell title={title} page={page} {...p}>
    <Card>
      <p role="status" className="text-base text-textBody">
        {title} is for adult accounts only for now.
      </p>
    </Card>
  </PcosShell>
);

// ------------------------------------------------------------------ Physical Exercise

export const PhysicalExercise: React.FC<ModuleScreenProps & { role: string | null }> = ({ role, ...p }) => {
  const [condition] = useCondition();
  const [state, setState, saveFailed] = useCycleCarePart<ExerciseState>("exercise", EMPTY_EXERCISE, sanitizeExercise);
  const [type, setType] = useState<ActivityType>("walk");
  const [minutes, setMinutes] = useState("");
  const [goalText, setGoalText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const today = dateKey();

  if (!canOpenCycleCare(role)) return <AdultsOnly title="Physical Exercise" page="exercise" {...p} />;

  const log = (t: ActivityType, m: number | null) => {
    if (m === null) return setError("Please enter minutes between 1 and 300.");
    const r = addEntry(state, today, t, m);
    if (!r.ok) return setError(r.error);
    setError(null);
    setState(r.state);
    setMinutes("");
  };
  const week = summarizeWeek(state, today);
  const reaction = exerciseReaction(state, today, new Date().getHours());
  const todays = entriesOn(state, today);

  const changePlan = (day: number, t: ActivityType | "rest", m: number) => {
    const r = setPlanDay(state, day, t === "rest" ? null : { type: t, minutes: m });
    if (!r.ok) return setError(r.error);
    setError(null);
    setState(r.state);
  };

  return (
    <PcosShell title="Physical Exercise" page="exercise" lead="Daily minutes, yoga time and a weekly plan that moves at your pace." {...p}>
      <div className="space-y-4">
        <Card className="space-y-2">
          <Coach stance={reaction.stance} text={reaction.text} lowSensory={p.lowSensory} />
        </Card>

        <Card className="space-y-2">
          <h2 className="font-display text-xl text-textHeading">Movement for your condition</h2>
          <ul className="list-disc pl-5 text-base text-textBody space-y-1">
            {moveFocusFor(condition).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <p className="text-sm text-textMuted">{MOVE_SHARED_NOTE}</p>
        </Card>

        <MovementPicker />

        <Card className="space-y-3">
          <h2 className="font-display text-xl text-textHeading">Today's movement</h2>
          <div className="flex flex-wrap gap-2">
            {ACTIVITIES.map((a) => (
              <Button key={a.id} size="sm" variant={type === a.id ? "olive" : "outline"} aria-pressed={type === a.id} onClick={() => setType(a.id)}>
                {a.label}
              </Button>
            ))}
          </div>
          <label htmlFor="ex-minutes" className="block text-sm text-textBody">
            Minutes
          </label>
          <input id="ex-minutes" inputMode="numeric" className={fieldClass} value={minutes} maxLength={3} onChange={(e) => setMinutes(e.target.value)} />
          <Button size="sm" variant="primary" onClick={() => log(type, parseMinutes(minutes))}>
            Add to today
          </Button>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <ul className="space-y-1">
            {todays.map((e, i) => (
              <li key={`${e.type}-${i}`} className="flex items-center justify-between gap-3 text-base text-textBody">
                <span>
                  {activityLabel(e.type)} · {e.minutes} min
                </span>
                <Button size="sm" variant="ghost" aria-label={`Remove ${activityLabel(e.type)} ${e.minutes} minutes`} onClick={() => setState(removeEntry(state, state.log.indexOf(e)))}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <p role="status" className="text-base text-textHeading">
            Today: {minutesOn(state, today)} minutes
          </p>
          {isLongDay(state, today) && <p className="text-sm text-textBody">{LONG_DAY_NOTE}</p>}
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-xl text-textHeading">Yoga time</h2>
          <p className="text-sm text-textBody">Tap to add a yoga session to today.</p>
          <div className="flex flex-wrap gap-2">
            {[10, 20, 30].map((m) => (
              <Button key={m} size="sm" variant="outline" onClick={() => log("yoga", m)}>
                {m} min yoga
              </Button>
            ))}
          </div>
          <p role="status" className="text-base text-textHeading">
            Yoga today: {minutesOn(state, today, "yoga")} min · this week: {week.yogaMinutes} min
          </p>
          <p className="text-sm text-textMuted">{YOGA_NOTE}</p>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-xl text-textHeading">My weekly workout plan</h2>
          <p className="text-sm text-textBody">Plan each day, or choose Rest. The plan repeats every week and ticks itself when you log enough minutes.</p>
          <ul className="space-y-3">
            {WEEKDAYS.map((name, i) => {
              const planned = state.plan[i];
              const date = weekDates(today)[i];
              const status = planStatus(state, date);
              return (
                <li key={name} className="rounded-2xl border border-olive-200 bg-white px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium text-textHeading">
                      {name}
                      {date === today ? " (today)" : ""}
                    </span>
                    <span className="text-sm text-textBody">{status === "rest" ? "Rest" : status === "done" ? "Done" : status === "partly" ? "Started" : "To do"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor={`plan-type-${i}`} className="sr-only">
                      {name} activity
                    </label>
                    <select id={`plan-type-${i}`} className={fieldClass + " sm:w-48"} value={planned?.type ?? "rest"} onChange={(e) => changePlan(i, e.target.value as ActivityType | "rest", planned?.minutes ?? 20)}>
                      <option value="rest">Rest</option>
                      {ACTIVITIES.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                    {planned && (
                      <>
                        <label htmlFor={`plan-min-${i}`} className="sr-only">
                          {name} minutes
                        </label>
                        <input
                          id={`plan-min-${i}`}
                          inputMode="numeric"
                          className={fieldClass + " sm:w-28"}
                          defaultValue={String(planned.minutes)}
                          maxLength={3}
                          onBlur={(e) => {
                            const m = parseMinutes(e.target.value);
                            if (m !== null) changePlan(i, planned.type, m);
                          }}
                        />
                        <span className="text-sm text-textBody">min</span>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-textMuted">{REST_NOTE}</p>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-xl text-textHeading">This week</h2>
          <p role="status" className="text-base text-textBody">
            {weekMessage(state, today)}
          </p>
          <ul className="text-base text-textBody space-y-1">
            {ACTIVITIES.filter((a) => week.byType[a.id] > 0).map((a) => (
              <li key={a.id}>
                {a.label}: {week.byType[a.id]} min
              </li>
            ))}
          </ul>
          <label htmlFor="ex-goal" className="block text-sm text-textBody">
            My own weekly minutes goal (optional, leave blank for none)
          </label>
          <input id="ex-goal" inputMode="numeric" className={fieldClass} value={goalText} placeholder={state.weeklyGoal ? String(state.weeklyGoal) : ""} maxLength={4} onChange={(e) => setGoalText(e.target.value)} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const r = setWeeklyGoal(state, goalText);
              if (!r.ok) return setError(r.error);
              setError(null);
              setState(r.state);
              setGoalText("");
            }}
          >
            Save goal
          </Button>
          <p className="text-sm text-textMuted">
            Your movement is saved to your account, and only you can see it. SafeSpace does not count calories burned or link movement to weight.
            {saveFailed ? " Your last change didn't save. It will try again with your next change." : ""}
          </p>
        </Card>
        <Notes extra="Always follow your own doctor's advice about exercise." />
      </div>
    </PcosShell>
  );
};

// ------------------------------------------------------------------ Food

export const FoodModule: React.FC<ModuleScreenProps & { role: string | null }> = ({ role, ...p }) => {
  const [condition] = useCondition();
  if (!canOpenCycleCare(role)) return <AdultsOnly title="Food" page="food" {...p} />;
  return (
    <PcosShell title="Food" page="food" lead="Your diet plan, water and meal ideas, one gentle step at a time." {...p}>
      <div className="space-y-4">
        <DietSection lowSensory={p.lowSensory} condition={condition} />
        <WaterTally />
        <Notes extra="Always follow the eating plan your own doctor or dietitian gives you." />
      </div>
    </PcosShell>
  );
};

// ------------------------------------------------------------------ PCOS / PCOD hub

export const PcosPcodHub: React.FC<ModuleScreenProps & { role: string | null }> = ({ role, ...p }) => {
  const [condition, setCondition] = useCondition();
  const [profile, setProfile, saveFailed] = useCycleCarePart<Assessment>("profile", EMPTY_ASSESSMENT, sanitizeAssessment);
  const store = useCycleCareStore();
  const [clearFailed, setClearFailed] = useState(false);

  if (!canOpenCycleCare(role)) return <AdultsOnly title="PCOS / PCOD" page="hub" {...p} />;

  const clearAll = () => {
    setClearFailed(false);
    store?.deleteAll().catch(() => setClearFailed(true));
  };
  const shownAbout = condition === "pcos" || condition === "pcod" ? [ABOUT[condition]] : [ABOUT.pcos, ABOUT.pcod];

  return (
    <PcosShell
      title="PCOS / PCOD"
      heading="Every part of you deserves to be cherished"
      page="hub"
      lead="Gentle care for your cycle, body and mind. Learn what your doctor means, keep your own notes, and move and eat in ways that feel kind."
      {...p}
    >
      <div className="space-y-4">
        <CycleCareAccountNote />
        <Card className="space-y-3">
          <h2 className="font-display text-xl text-textHeading">What does your doctor call it?</h2>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map((c) => (
              <Button key={c.id} size="sm" variant={condition === c.id ? "olive" : "outline"} aria-pressed={condition === c.id} onClick={() => setCondition(c.id)}>
                {c.label}
              </Button>
            ))}
          </div>
          <p className="text-sm text-textBody">{TERMS_NOTE}</p>
        </Card>

        {shownAbout.map((a) => (
          <Card key={a.title} className="space-y-2">
            <h2 className="font-display text-xl text-textHeading">{a.title}</h2>
            <ul className="list-disc pl-5 text-base text-textBody space-y-1">
              {a.points.map((pt) => (
                <li key={pt}>{pt}</li>
              ))}
            </ul>
          </Card>
        ))}

        <Card className="space-y-3">
          <h2 className="font-display text-xl text-textHeading">PCOD and PCOS at a glance</h2>
          {DIFFERENCES.map((d) => (
            <details key={d.aspect} className="rounded-2xl border border-olive-200 bg-white px-4 py-3">
              <summary className="cursor-pointer text-base text-textHeading">{d.aspect}</summary>
              <p className="mt-2 text-base text-textBody">PCOS: {d.pcos}</p>
              <p className="mt-1 text-base text-textBody">PCOD: {d.pcod}</p>
            </details>
          ))}
          <p className="text-sm text-textMuted">{DIFFERENCES_NOTE}</p>
        </Card>

        <MythsTopic condition={condition} />
        <SymptomsTopic />
        <WellbeingTopic base={baseOf(p)} />
        <SleepTopic base={baseOf(p)} />

        <ProfileSection profile={profile} setProfile={setProfile} />

        <Card className="space-y-2">
          <p className="text-sm text-textMuted">
            Your choices, diet plan, movement, health profile and tracker are saved to your account. Only you can see them: not a caregiver, not anyone else.
            {saveFailed ? " Your last change didn't save. It will try again with your next change." : ""}
          </p>
          <Button size="sm" variant="outline" onClick={clearAll}>
            Clear all my PCOS / PCOD data
          </Button>
          {clearFailed && <p role="alert" className="text-sm text-red-700">That didn't clear. Please try again.</p>}
        </Card>
        <Notes extra="Always follow your own doctor's advice." />
      </div>
    </PcosShell>
  );
};
