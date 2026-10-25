import React, { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { MYTHS_NOTE, mythsFor, type Condition } from "../lib/condition";
import { CHECKIN_FIELDS, LEVELS, VISIT_PROMPTS, optionLabel, type CheckIn, type Level } from "../lib/cycleCare";
import { dateKey } from "../lib/exercise";
import {
  CHECKUP_STEPS,
  REFRAMES,
  SIGNS,
  SIGNS_NOTE,
  SLEEP_FACTS,
  SLEEP_HELP,
  TOPICS,
  VISIT_TIP,
  WELLBEING_HELP,
  WELLBEING_STEPS,
  WIND_DOWN,
  type TopicId,
} from "../lib/topics";
import {
  EMPTY_TRACKER,
  SYMPTOMS,
  addQuestion,
  dayNoteFor,
  describeDay,
  endPeriod,
  periodSummary,
  recentSummary,
  removeDay,
  removePeriod,
  removeQuestion,
  sanitizeTracker,
  saveDay,
  startPeriod,
  type SymptomId,
  type TrackerResult,
  type TrackerState,
} from "../lib/tracker";
import { useCycleCarePart } from "./useCycleCarePart";

// The PCOS / PCOD topics: an illustrated banner each, opening onto something
// to try. Myths, symptoms, wellbeing and sleep sit on the Overview; doctor
// visits and the personal tracker in Cycle Care. Panels stay in the page
// while closed (just hidden), so screen readers and search find them.

const IMAGES: Record<TopicId, string> = {
  myths: new URL("../../conditions/pcos-pcod/dusk/photos/topics/myths.webp", import.meta.url).href,
  symptoms: new URL("../../conditions/pcos-pcod/dusk/photos/topics/symptoms.webp", import.meta.url).href,
  wellbeing: new URL("../../conditions/pcos-pcod/dusk/photos/topics/wellbeing.webp", import.meta.url).href,
  sleep: new URL("../../conditions/pcos-pcod/dusk/photos/topics/sleep.webp", import.meta.url).href,
  doctor: new URL("../../conditions/pcos-pcod/dusk/photos/topics/doctor.webp", import.meta.url).href,
  tracker: new URL("../../conditions/pcos-pcod/dusk/photos/topics/tracker.webp", import.meta.url).href,
};
// The sleep picture is a night room, so its words are light.
const LIGHT_TEXT: readonly TopicId[] = ["sleep"];

const fieldClass =
  "w-full rounded-2xl border border-olive-200 bg-white px-4 py-3 text-base text-textBody focus:outline-none focus:ring-2 focus:ring-olive-500";

const TopicSection: React.FC<{ id: TopicId; open?: boolean; children: React.ReactNode }> = ({ id, open: startOpen = false, children }) => {
  const [open, setOpen] = useState(startOpen);
  const panelId = useId();
  const t = TOPICS[id];
  return (
    <section className="dk-topic" aria-labelledby={`${panelId}-title`} data-open={open ? "true" : "false"}>
      <div className="dk-topic-banner" data-tone={LIGHT_TEXT.includes(id) ? "light" : "dark"}>
        <img src={IMAGES[id]} alt="" />
        <div className="dk-topic-words">
          <p className="dk-topic-kicker">{t.kicker}</p>
          <h2 id={`${panelId}-title`} className="dk-topic-title dk-serif">
            {t.title}
          </h2>
          <p className="dk-topic-blurb">{t.blurb}</p>
          <button type="button" className="dk-topic-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
            {open ? "Close" : "Explore"}
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>
      <div id={panelId} className="dk-topic-panel" hidden={!open}>
        {children}
      </div>
    </section>
  );
};

const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode; label?: string }> = ({ on, onClick, children, label }) => (
  <Button size="sm" variant={on ? "olive" : "outline"} aria-pressed={on} aria-label={label} onClick={onClick}>
    {children}
  </Button>
);

// ------------------------------------------------------------------ 1. Myths and facts

export const MythsTopic: React.FC<{ condition: Condition | null }> = ({ condition }) => {
  const [turned, setTurned] = useState<Record<string, boolean>>({});
  const myths = mythsFor(condition);
  const count = myths.filter((m) => turned[m.myth]).length;
  const heading = condition === "pcos" ? "PCOS" : condition === "pcod" ? "PCOD" : "PCOS and PCOD";
  return (
    <TopicSection id="myths">
      <Card className="space-y-3">
        <h3 className="font-display text-xl text-textHeading">{heading} myths and facts</h3>
        <p className="text-sm text-textBody">Tap a card to turn it over.</p>
        <ul className="dk-flips">
          {myths.map((m) => {
            const on = !!turned[m.myth];
            return (
              <li key={m.myth}>
                <button type="button" className="dk-flip" data-on={on ? "true" : "false"} aria-pressed={on} onClick={() => setTurned((t) => ({ ...t, [m.myth]: !t[m.myth] }))}>
                  <span className="dk-flip-face dk-flip-front">
                    <span className="dk-flip-tag">Myth</span>
                    <span>Myth: {m.myth}</span>
                  </span>
                  <span className="dk-flip-face dk-flip-back" aria-hidden={!on}>
                    <span className="dk-flip-tag">Fact</span>
                    <span>{m.fact}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p role="status" className="text-sm text-textBody">
          You've turned over {count} of {myths.length}.
        </p>
        <p className="text-sm text-textMuted">{MYTHS_NOTE}</p>
      </Card>
    </TopicSection>
  );
};

// ------------------------------------------------------------------ 2. Symptoms

export const SymptomsTopic: React.FC = () => {
  const [picked, setPicked] = useState(SIGNS[0].id);
  const [tracker, setTracker] = useCycleCarePart<TrackerState>("tracker", EMPTY_TRACKER, sanitizeTracker);
  const [added, setAdded] = useState<string | null>(null);
  const sign = SIGNS.find((s) => s.id === picked) ?? SIGNS[0];
  const question = `I've noticed ${sign.label.toLowerCase()}. What could it mean for me?`;
  const asked = tracker.questions.some((q) => q.toLowerCase() === question.toLowerCase());
  return (
    <TopicSection id="symptoms">
      <Card className="space-y-3">
        <p className="text-sm text-textBody">{SIGNS_NOTE}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Possible signs">
          {SIGNS.map((s) => (
            <Chip key={s.id} on={picked === s.id} onClick={() => setPicked(s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
        <div className="dk-detail" role="status" aria-live="polite">
          <h3 className="font-display text-xl text-textHeading">{sign.label}</h3>
          <p className="text-base text-textBody">{sign.about}</p>
          <p className="text-base text-textBody">
            <span className="text-textHeading">What can help: </span>
            {sign.help}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={asked}
          onClick={() => {
            const r = addQuestion(tracker, question);
            if (r.ok) {
              setTracker(r.state);
              setAdded(sign.label);
            }
          }}
        >
          {asked ? "In your doctor questions" : "Add to my doctor questions"}
        </Button>
        {added && <p className="text-sm text-textMuted">Added. You'll find it under Doctor visits in Cycle Care.</p>}
      </Card>
    </TopicSection>
  );
};

// ------------------------------------------------------------------ 3. Emotional wellbeing

export const WellbeingTopic: React.FC<{ base: string }> = ({ base }) => {
  const [thought, setThought] = useState<number | null>(null);
  const [done, setDone] = useState<Record<number, boolean>>({});
  return (
    <TopicSection id="wellbeing">
      <Card className="space-y-3">
        <h3 className="font-display text-xl text-textHeading">Answer a hard thought kindly</h3>
        <p className="text-sm text-textBody">Pick a thought that sounds familiar to see a kinder way to say it.</p>
        <div className="flex flex-col gap-2">
          {REFRAMES.map((r, i) => (
            <button key={r.harsh} type="button" className="dk-reframe" data-on={thought === i ? "true" : "false"} aria-pressed={thought === i} onClick={() => setThought(thought === i ? null : i)}>
              <span className="dk-reframe-harsh">"{r.harsh}"</span>
              {thought === i && <span className="dk-reframe-kind">Try instead: "{r.kind}"</span>}
            </button>
          ))}
        </div>
      </Card>
      <Card className="space-y-3">
        <h3 className="font-display text-xl text-textHeading">When stress builds up</h3>
        <ul className="space-y-2">
          {WELLBEING_STEPS.map((s, i) => (
            <li key={s} className="flex items-start gap-3">
              <input id={`wb-${i}`} type="checkbox" className="mt-1 h-5 w-5" checked={!!done[i]} onChange={() => setDone((d) => ({ ...d, [i]: !d[i] }))} />
              <label htmlFor={`wb-${i}`} className="text-base text-textBody">
                {s}
              </label>
            </li>
          ))}
        </ul>
        <Link to={`${base}/calm-space/breathing`} className="underline text-deepGreen text-sm">
          Breathe with the jellyfish in Calm Space
        </Link>
        <p className="text-sm text-textMuted">{WELLBEING_HELP}</p>
      </Card>
    </TopicSection>
  );
};

// ------------------------------------------------------------------ 4. Sleep and rest

export const SleepTopic: React.FC<{ base: string }> = ({ base }) => {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const count = WIND_DOWN.filter((_, i) => done[i]).length;
  return (
    <TopicSection id="sleep">
      <Card className="space-y-3">
        <h3 className="font-display text-xl text-textHeading">Tonight's wind-down</h3>
        <p className="text-sm text-textBody">Tick what you'd like to try tonight. Even one is a good start.</p>
        <ul className="space-y-2">
          {WIND_DOWN.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <input id={`wd-${i}`} type="checkbox" className="h-5 w-5" checked={!!done[i]} onChange={() => setDone((d) => ({ ...d, [i]: !d[i] }))} />
              <label htmlFor={`wd-${i}`} className="text-base text-textBody">
                {s}
              </label>
            </li>
          ))}
        </ul>
        <div className="dk-meter" aria-hidden="true">
          <span style={{ width: `${(count / WIND_DOWN.length) * 100}%` }} />
        </div>
        <p role="status" className="text-sm text-textBody">
          {count === 0 ? "Nothing ticked yet, and that's okay." : `${count} of ${WIND_DOWN.length} in tonight's routine.`} This list resets when you leave.
        </p>
      </Card>
      <Card className="space-y-2">
        <h3 className="font-display text-xl text-textHeading">Good to know</h3>
        <ul className="list-disc pl-5 text-base text-textBody space-y-1">
          {SLEEP_FACTS.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <Link to={`${base}/calm-space/breathing`} className="underline text-deepGreen text-sm">
          Open the breathing exercise
        </Link>
        <p className="text-sm text-textMuted">{SLEEP_HELP}</p>
      </Card>
    </TopicSection>
  );
};

// ------------------------------------------------------------------ 5. Doctor visits

const QuestionList: React.FC<{ tracker: TrackerState; setTracker: (t: TrackerState) => void; prompts: readonly string[] }> = ({ tracker, setTracker, prompts }) => {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const apply = (r: TrackerResult, clear = false) => {
    if (!r.ok) return setError(r.error);
    setError(null);
    setTracker(r.state);
    if (clear) setText("");
  };
  return (
    <Card className="space-y-3">
      <h3 className="font-display text-xl text-textHeading">Doctor visit prep</h3>
      <p className="text-sm text-textBody">Tap an idea to add it to your list, or write your own. Your list is saved.</p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((q) => (
          <Button key={q} size="sm" variant="outline" disabled={tracker.questions.includes(q)} onClick={() => apply(addQuestion(tracker, q))}>
            {q}
          </Button>
        ))}
      </div>
      <label htmlFor="visit-input" className="block text-sm text-textBody">
        Add your own question
      </label>
      <input id="visit-input" className={fieldClass} value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
      <Button size="sm" variant="primary" onClick={() => apply(addQuestion(tracker, text), true)}>
        Add question
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {tracker.questions.length > 0 && (
        <ol className="dk-questions">
          {tracker.questions.map((q, i) => (
            <li key={q} className="flex items-center justify-between gap-3 text-base text-textBody">
              <span>{q}</span>
              <Button size="sm" variant="ghost" aria-label={`Remove ${q}`} onClick={() => setTracker(removeQuestion(tracker, i))}>
                Remove
              </Button>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
};

export const DoctorTopic: React.FC<{ prompts?: readonly string[] }> = ({ prompts = VISIT_PROMPTS }) => {
  const [step, setStep] = useState(0);
  const [tracker, setTracker, saveFailed] = useCycleCarePart<TrackerState>("tracker", EMPTY_TRACKER, sanitizeTracker);
  const s = CHECKUP_STEPS[step];
  return (
    <TopicSection id="doctor">
      <Card className="space-y-3">
        <h3 className="font-display text-xl text-textHeading">What a check-up may include</h3>
        <ol className="dk-stepper" aria-label="Check-up steps">
          {CHECKUP_STEPS.map((c, i) => (
            <li key={c.title}>
              <button type="button" aria-current={i === step ? "step" : undefined} data-done={i < step ? "true" : "false"} onClick={() => setStep(i)}>
                <span className="dk-stepper-dot">{i + 1}</span>
                <span className="sr-only">{c.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="dk-detail" role="status" aria-live="polite">
          <h4 className="text-base text-textHeading">
            {step + 1}. {s.title}
          </h4>
          <p className="text-base text-textBody">{s.detail}</p>
        </div>
        <div className="flex justify-between gap-2">
          <Button size="sm" variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Back
          </Button>
          <Button size="sm" variant="outline" disabled={step === CHECKUP_STEPS.length - 1} onClick={() => setStep(step + 1)}>
            Next
          </Button>
        </div>
      </Card>
      <QuestionList tracker={tracker} setTracker={setTracker} prompts={prompts} />
      <Card className="space-y-2">
        <h3 className="font-display text-xl text-textHeading">To bring with you</h3>
        <p className="text-base text-textBody">{periodSummary(tracker)}</p>
        <p className="text-base text-textBody">{recentSummary(tracker)}</p>
        <p className="text-sm text-textMuted">
          {VISIT_TIP}
          {saveFailed ? " Your last change didn't save. It will try again with your next change." : ""}
        </p>
      </Card>
    </TopicSection>
  );
};

// ------------------------------------------------------------------ 6. Personal tracker

type TrackerTab = "periods" | "today" | "history";

export const TrackerTopic: React.FC = () => {
  const [tracker, setTracker, saveFailed] = useCycleCarePart<TrackerState>("tracker", EMPTY_TRACKER, sanitizeTracker);
  const today = dateKey();
  const [tab, setTab] = useState<TrackerTab>("periods");
  const [periodDate, setPeriodDate] = useState(today);
  const [day, setDay] = useState(today);
  const saved = dayNoteFor(tracker, day);
  const [draft, setDraft] = useState<{ day: string; checkIn: CheckIn; symptoms: SymptomId[] } | null>(null);
  const current = draft?.day === day ? draft : { day, checkIn: saved?.checkIn ?? {}, symptoms: saved?.symptoms ?? [] };
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const open = tracker.periods.find((p) => p.end === null);

  const apply = (r: TrackerResult) => {
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    setError(null);
    setTracker(r.state);
    return true;
  };
  // Each tap builds on the latest draft, so quick taps all count.
  const edit = (change: (c: { checkIn: CheckIn; symptoms: SymptomId[] }) => Partial<{ checkIn: CheckIn; symptoms: SymptomId[] }>) => {
    setSavedNote(null);
    setDraft((prev) => {
      const base = prev?.day === day ? prev : { day, checkIn: saved?.checkIn ?? {}, symptoms: saved?.symptoms ?? [] };
      return { ...base, ...change(base) };
    });
  };

  const TABS: { id: TrackerTab; label: string }[] = [
    { id: "periods", label: "Periods" },
    { id: "today", label: "How I feel" },
    { id: "history", label: "My notes" },
  ];

  return (
    <TopicSection id="tracker" open>
      <Card className="space-y-4">
        <div className="dk-tabs" role="tablist" aria-label="Tracker">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" id={`trk-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`trk-${t.id}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div id="trk-periods" role="tabpanel" aria-labelledby="trk-tab-periods" hidden={tab !== "periods"} className="space-y-3">
          <h3 className="font-display text-xl text-textHeading">My periods</h3>
          <p role="status" className="text-base text-textBody">
            {periodSummary(tracker, today)}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="trk-period-date" className="block text-sm text-textBody">
                {open ? "The day it ended" : "The day it started"}
              </label>
              <input id="trk-period-date" type="date" className={fieldClass + " sm:w-52"} max={today} value={periodDate} onChange={(e) => setPeriodDate(e.target.value)} />
            </div>
            <Button size="sm" variant="primary" onClick={() => apply(open ? endPeriod(tracker, open.start, periodDate, today) : startPeriod(tracker, periodDate, today))}>
              {open ? "Save end day" : "Add period"}
            </Button>
          </div>
          {tracker.periods.length > 0 && (
            <ul className="space-y-2">
              {tracker.periods.slice(0, 12).map((p) => (
                <li key={p.start} className="flex items-center justify-between gap-3 rounded-2xl border border-olive-200 bg-white px-4 py-2 text-base text-textBody">
                  <span>
                    {formatDay(p.start)} {p.end ? `to ${formatDay(p.end)}` : "· still going"}
                  </span>
                  <Button size="sm" variant="ghost" aria-label={`Remove the period that started ${formatDay(p.start)}`} onClick={() => setTracker(removePeriod(tracker, p.start))}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div id="trk-today" role="tabpanel" aria-labelledby="trk-tab-today" hidden={tab !== "today"} className="space-y-3">
          <h3 className="font-display text-xl text-textHeading">How are you today?</h3>
          <p className="text-sm text-textBody">Choose only what you want to. There are no right answers.</p>
          <div className="space-y-1">
            <label htmlFor="trk-day" className="block text-sm text-textBody">
              Day
            </label>
            <input id="trk-day" type="date" className={fieldClass + " sm:w-52"} max={today} value={day} onChange={(e) => { setDay(e.target.value); setSavedNote(null); }} />
          </div>
          {CHECKIN_FIELDS.map((f) => (
            <fieldset key={f.id} className="space-y-1">
              <legend className="text-sm font-medium text-textHeading">{f.label}</legend>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((lv) => (
                  <Chip key={lv} on={current.checkIn[f.id] === lv} onClick={() => edit((c) => ({ checkIn: { ...c.checkIn, [f.id]: c.checkIn[f.id] === lv ? undefined : (lv as Level) } }))}>
                    {optionLabel(f, lv)}
                  </Chip>
                ))}
              </div>
            </fieldset>
          ))}
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium text-textHeading">Anything you noticed</legend>
            <div className="flex flex-wrap gap-2">
              {SYMPTOMS.map((s) => {
                const on = current.symptoms.includes(s.id);
                return (
                  <Chip key={s.id} on={on} onClick={() => edit((c) => ({ symptoms: c.symptoms.includes(s.id) ? c.symptoms.filter((x) => x !== s.id) : [...c.symptoms, s.id] }))}>
                    {s.label}
                  </Chip>
                );
              })}
            </div>
          </fieldset>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              if (apply(saveDay(tracker, day, current.checkIn, current.symptoms, today))) {
                setDraft(null);
                setSavedNote(day === today ? "Saved for today." : `Saved for ${formatDay(day)}.`);
              }
            }}
          >
            Save this day
          </Button>
          {savedNote && (
            <p role="status" className="text-sm text-textBody">
              {savedNote}
            </p>
          )}
        </div>

        <div id="trk-history" role="tabpanel" aria-labelledby="trk-tab-history" hidden={tab !== "history"} className="space-y-3">
          <h3 className="font-display text-xl text-textHeading">My notes</h3>
          <p className="text-base text-textBody">{recentSummary(tracker, today)}</p>
          {tracker.days.length === 0 ? (
            <p className="text-sm text-textMuted">Days you save will show here, newest first.</p>
          ) : (
            <ul className="space-y-2">
              {tracker.days.slice(0, 30).map((d) => (
                <li key={d.date} className="flex items-center justify-between gap-3 rounded-2xl border border-olive-200 bg-white px-4 py-2">
                  <span className="text-base text-textBody">
                    <span className="text-textHeading">{formatDay(d.date)}</span> · {describeDay(d)}
                  </span>
                  <Button size="sm" variant="ghost" aria-label={`Remove the notes for ${formatDay(d.date)}`} onClick={() => setTracker(removeDay(tracker, d.date))}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <p className="text-sm text-textMuted">
          Your tracker is saved to your account, and only you can see it: not a caregiver, not anyone else. It records and looks back; it does not predict periods or diagnose anything.
          {saveFailed ? " Your last change didn't save. It will try again with your next change." : ""}
        </p>
      </Card>
    </TopicSection>
  );
};

function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
