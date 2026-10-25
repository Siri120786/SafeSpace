import React, { useContext, useEffect, useState } from "react";
import { getCalmPlan, saveCalmPlan } from "@safespace/api-client";
import { AuthContext } from "../../../auth/context/AuthContext";
import { PHASE_INSTRUCTIONS, PHASE_LABELS } from "../../../calm-tools/lib/breathing";
import { useBreathingTimer } from "../../../calm-tools/hooks/useBreathingTimer";
import { GROUNDING_STEPS } from "../../../calm-tools/lib/grounding";
import { addItem, EMPTY_PLAN, removeItem, sanitizePlan, type CalmPlan, type CalmPlanList } from "./calmPlan";
import {
  AFTER_NIGHTMARE,
  CALM_PLAN_SECTIONS,
  CONTAINER_STEPS,
  MEMORY_STEPS,
  RESPONSES,
  RESPONSES_NOTE,
  SAFE_PLACE_STEPS,
  SLEEP_HELP,
  SUPPORT_HELP,
  SUPPORT_OPTIONS,
  TOOLS,
  TOPICS,
  WIND_DOWN,
  type ToolId,
  type TopicId,
} from "./content";

// Safe Harbor's parts below the relaxation card: the toolkit, My calm plan
// and the learning topics. Everything opens still and quiet; nothing plays
// a sound. Panels stay in the page while closed (hidden), so screen readers
// and tests find them.

// Pictures supplied by the team: an adult and a child version where the
// team made both.
const PHOTO = {
  safePlaceAdult: new URL("./photos/safe-place-adult.webp", import.meta.url).href,
  safePlaceChild: new URL("./photos/safe-place-child.webp", import.meta.url).href,
  containerAdult: new URL("./photos/container-adult.webp", import.meta.url).href,
  containerChild: new URL("./photos/container-child.webp", import.meta.url).href,
  planAdult: new URL("./photos/plan-adult.webp", import.meta.url).href,
  planChild: new URL("./photos/plan-child.webp", import.meta.url).href,
  responses: new URL("./photos/responses.webp", import.meta.url).href,
  memories: new URL("./photos/memories.webp", import.meta.url).href,
  sleepAdult: new URL("./photos/sleep-adult.webp", import.meta.url).href,
  sleepChild: new URL("./photos/sleep-child.webp", import.meta.url).href,
  support: new URL("./photos/support.webp", import.meta.url).href,
};

const toolPhoto = (id: ToolId, forChild: boolean): string | null =>
  id === "safe-place" ? (forChild ? PHOTO.safePlaceChild : PHOTO.safePlaceAdult) : id === "container" ? (forChild ? PHOTO.containerChild : PHOTO.containerAdult) : null;

const topicPhoto = (id: TopicId, forChild: boolean): string =>
  id === "responses" ? PHOTO.responses : id === "memories" ? PHOTO.memories : id === "sleep" ? (forChild ? PHOTO.sleepChild : PHOTO.sleepAdult) : PHOTO.support;

// Children see the gentler topics only.
const CHILD_TOPICS: readonly TopicId[] = ["memories", "sleep"];

const Arrow: React.FC<{ open?: boolean }> = ({ open }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="hb-chev" data-open={open ? "true" : "false"}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/** A small step-through: Back and Next, one line at a time. */
const Steps: React.FC<{ steps: readonly string[]; label: string; done: string }> = ({ steps, label, done }) => {
  const [i, setI] = useState(0);
  const last = i === steps.length - 1;
  return (
    <div className="hb-steps">
      <p className="hb-date hb-mono">
        {label}, {i + 1} of {steps.length}
      </p>
      <p role="status" aria-live="polite" className="hb-steps-text">
        {steps[i]}
      </p>
      <div className="hb-dots" aria-hidden="true">
        {steps.map((s, k) => (
          <i key={s} data-on={k <= i ? "true" : "false"} />
        ))}
      </div>
      <div className="hb-controls">
        <button type="button" className="hb-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
          Back
        </button>
        {last ? (
          <span className="hb-done hb-mono">{done}</span>
        ) : (
          <button type="button" className="hb-ghost hb-ghost-strong" onClick={() => setI(i + 1)}>
            Next
          </button>
        )}
      </div>
    </div>
  );
};

const GroundingTool: React.FC = () => (
  <Steps steps={GROUNDING_STEPS.map((g) => `${g.title}. ${g.instruction}`)} label="Grounding" done="Well done. Take one slow breath." />
);

const BreatheTool: React.FC<{ lowSensory: boolean }> = ({ lowSensory }) => {
  const { pattern, state, running, notStarted, paused, start, pause, reset } = useBreathingTimer();
  const active = running || paused;
  const growing = state.phase === "inhale" || state.phase === "hold";
  const scale = lowSensory || !active ? 1 : growing ? 1.25 : 0.8;
  const seconds = state.phase === "inhale" ? pattern.inhaleSeconds : state.phase === "hold" ? pattern.holdSeconds : pattern.exhaleSeconds;
  const headline = state.finished ? "Well done" : notStarted ? "Ready when you are" : paused ? "Paused" : PHASE_LABELS[state.phase];
  const detail = state.finished
    ? "Notice how your body feels now."
    : notStarted
      ? `In for ${pattern.inhaleSeconds}, hold for ${pattern.holdSeconds}, out for ${pattern.exhaleSeconds}.`
      : paused
        ? "Press Resume when you're ready."
        : PHASE_INSTRUCTIONS[state.phase];
  return (
    <div className="hb-breathe">
      <div className="hb-drop" aria-hidden="true" style={{ transform: `scale(${scale})`, transition: lowSensory ? "none" : `transform ${seconds}s ease-in-out` }}>
        <span className="hb-serif">{active && !state.finished ? state.secondsLeft : ""}</span>
      </div>
      <div role="status" aria-live="polite">
        <p className="hb-steps-text">{headline}</p>
        <p className="hb-small">{detail}</p>
      </div>
      <div className="hb-controls">
        <button type="button" className="hb-ghost" onClick={reset} disabled={notStarted}>
          Reset
        </button>
        {running ? (
          <button type="button" className="hb-ghost hb-ghost-strong" onClick={pause}>
            Pause
          </button>
        ) : (
          <button type="button" className="hb-ghost hb-ghost-strong" onClick={start}>
            {state.finished ? "Again" : paused ? "Resume" : "Start"}
          </button>
        )}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ toolkit

export const Toolkit: React.FC<{ lowSensory: boolean; forChild?: boolean }> = ({ lowSensory, forChild = false }) => {
  const [open, setOpen] = useState<ToolId | null>(null);
  return (
    <section className="hb-toolkit" aria-labelledby="hb-toolkit-title">
      <h2 id="hb-toolkit-title" className="hb-kicker hb-mono">
        YOUR TOOLKIT
      </h2>
      <ul className="hb-tools">
        {TOOLS.map((t, n) => {
          const isOpen = open === t.id;
          const photo = toolPhoto(t.id, forChild);
          return (
            <li key={t.id} className="hb-tool" data-open={isOpen ? "true" : "false"}>
              <button type="button" className="hb-tool-head" aria-expanded={isOpen} aria-controls={`hb-tool-${t.id}`} onClick={() => setOpen(isOpen ? null : t.id)}>
                <span className="hb-tool-num hb-serif">{n + 1}</span>
                <span className="hb-tool-words">
                  <span className="hb-tool-name">{t.name}</span>
                  <span className="hb-tool-line">{t.line}</span>
                </span>
                <Arrow open={isOpen} />
              </button>
              <div id={`hb-tool-${t.id}`} className="hb-tool-body" hidden={!isOpen}>
                {photo && <img className="hb-tool-photo" src={photo} alt="" />}
                {t.id === "grounding" && <GroundingTool />}
                {t.id === "breathe" && <BreatheTool lowSensory={lowSensory} />}
                {t.id === "safe-place" && <Steps steps={SAFE_PLACE_STEPS} label="A safe place" done="Your safe place is always there." />}
                {t.id === "container" && <Steps steps={CONTAINER_STEPS} label="Put it away" done="It can stay there for now." />}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

// ------------------------------------------------------------------ calm plan

export const CalmPlanCard: React.FC<{ forChild: boolean }> = ({ forChild }) => {
  const session = useContext(AuthContext)?.session ?? null;
  const [plan, setPlan] = useState<CalmPlan>(EMPTY_PLAN);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "failed" | "offline">(session ? "loading" : "offline");
  const [drafts, setDrafts] = useState<Record<CalmPlanList, string>>({ signs: "", helps: "", people: "", places: "" });
  const [error, setError] = useState<{ list: CalmPlanList; text: string } | null>(null);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    getCalmPlan(session)
      .then((raw) => {
        if (!alive) return;
        setPlan(sanitizePlan(raw));
        setStatus("ready");
      })
      .catch(() => alive && setStatus("failed"));
    return () => {
      alive = false;
    };
  }, [session]);

  const persist = (next: CalmPlan) => {
    setPlan(next);
    if (!session) return;
    setStatus("saving");
    saveCalmPlan(session, next)
      .then(() => setStatus("saved"))
      .catch(() => setStatus("failed"));
  };
  const add = (list: CalmPlanList, text: string) => {
    const r = addItem(plan, list, text);
    if (!r.ok) return setError({ list, text: r.error });
    setError(null);
    setDrafts((d) => ({ ...d, [list]: "" }));
    persist(r.plan);
  };

  const statusText =
    status === "loading"
      ? "Loading your plan…"
      : status === "saving"
        ? "Saving…"
        : status === "saved"
          ? "Saved."
          : status === "failed"
            ? "That didn't save. Please try again in a moment."
            : "";

  return (
    <section className="hb-plan" aria-labelledby="hb-plan-title">
      <div className="hb-plan-banner" aria-hidden="true">
        <img src={forChild ? PHOTO.planChild : PHOTO.planAdult} alt="" />
      </div>
      <div className="hb-plan-head">
        <div>
          <h2 id="hb-plan-title" className="hb-plan-title hb-serif">
            My calm plan
          </h2>
          <p className="hb-small">Fill it in on a calm day, so it's ready on a hard one. Add only what you want to.</p>
        </div>
        <p role="status" aria-live="polite" className="hb-plan-status hb-mono">
          {statusText}
        </p>
      </div>
      <div className="hb-plan-grid">
        {CALM_PLAN_SECTIONS.map((s) => (
          <div key={s.id} className="hb-plan-col">
            <h3 className="hb-plan-sub">{s.title}</h3>
            <p className="hb-small">{s.prompt}</p>
            {plan[s.id].length > 0 && (
              <ul className="hb-plan-items">
                {plan[s.id].map((item, i) => (
                  <li key={item}>
                    <span>{item}</span>
                    <button type="button" className="hb-x" aria-label={`Remove ${item}`} onClick={() => persist(removeItem(plan, s.id, i))}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="hb-ideas">
              {s.ideas
                .filter((idea) => !plan[s.id].some((x) => x.toLowerCase() === idea.toLowerCase()))
                .map((idea) => (
                  <button key={idea} type="button" className="hb-idea" onClick={() => add(s.id, idea)}>
                    + {idea}
                  </button>
                ))}
            </div>
            <form
              className="hb-add"
              onSubmit={(e) => {
                e.preventDefault();
                add(s.id, drafts[s.id]);
              }}
            >
              <label htmlFor={`hb-add-${s.id}`} className="sr-only">
                Add to {s.title}
              </label>
              <input
                id={`hb-add-${s.id}`}
                value={drafts[s.id]}
                maxLength={120}
                placeholder="Write your own"
                onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
              />
              <button type="submit" className="hb-ghost">
                Add
              </button>
            </form>
            {error?.list === s.id && (
              <p role="alert" className="hb-error">
                {error.text}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="hb-small hb-plan-note">
        {forChild
          ? "Your plan is saved to your account. Your grown-ups can see it, unless you're 15 or older and chose not to share."
          : "Your plan is saved to your account, and only you can see it."}
      </p>
    </section>
  );
};

// ------------------------------------------------------------------ topics (adults)

const TopicBody: React.FC<{ id: TopicId }> = ({ id }) => {
  const [pick, setPick] = useState(0);
  const [ticked, setTicked] = useState<Record<number, boolean>>({});
  if (id === "responses") {
    const r = RESPONSES[pick];
    return (
      <div className="hb-topic-inner">
        <div className="hb-chips" role="group" aria-label="Trauma responses">
          {RESPONSES.map((x, i) => (
            <button key={x.id} type="button" className="hb-chip" aria-pressed={pick === i} onClick={() => setPick(i)}>
              {x.name}
            </button>
          ))}
        </div>
        <div className="hb-detail" role="status" aria-live="polite">
          <p className="hb-steps-text">{r.name}</p>
          <p className="hb-small">{r.what}</p>
          <p className="hb-small">
            <span className="hb-em">It can feel like: </span>
            {r.feels}
          </p>
          <p className="hb-small">
            <span className="hb-em">What can help: </span>
            {r.helps}
          </p>
        </div>
        <p className="hb-small hb-dim">{RESPONSES_NOTE}</p>
      </div>
    );
  }
  if (id === "memories") {
    return (
      <div className="hb-topic-inner">
        <Steps steps={MEMORY_STEPS.map((m) => `${m.title}. ${m.detail}`)} label="Right now" done="You're here, and you're safe now." />
      </div>
    );
  }
  if (id === "sleep") {
    return (
      <div className="hb-topic-inner">
        <p className="hb-steps-text">Tonight's wind-down</p>
        <ul className="hb-checks">
          {WIND_DOWN.map((w, i) => (
            <li key={w}>
              <input id={`hb-wd-${i}`} type="checkbox" checked={!!ticked[i]} onChange={() => setTicked((t) => ({ ...t, [i]: !t[i] }))} />
              <label htmlFor={`hb-wd-${i}`}>{w}</label>
            </li>
          ))}
        </ul>
        <p className="hb-steps-text">After a bad dream</p>
        <ol className="hb-list">
          {AFTER_NIGHTMARE.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
        <p className="hb-small hb-dim">{SLEEP_HELP}</p>
      </div>
    );
  }
  const s = SUPPORT_OPTIONS[pick];
  return (
    <div className="hb-topic-inner">
      <p className="hb-small">Who might you talk to?</p>
      <div className="hb-chips" role="group" aria-label="Kinds of support">
        {SUPPORT_OPTIONS.map((x, i) => (
          <button key={x.id} type="button" className="hb-chip" aria-pressed={pick === i} onClick={() => setPick(i)}>
            {x.name}
          </button>
        ))}
      </div>
      <div className="hb-detail" role="status" aria-live="polite">
        <p className="hb-steps-text">{s.name}</p>
        <p className="hb-small">{s.detail}</p>
      </div>
      <p className="hb-small hb-dim">{SUPPORT_HELP}</p>
    </div>
  );
};

export const HarborTopics: React.FC<{ forChild?: boolean }> = ({ forChild = false }) => {
  const [open, setOpen] = useState<TopicId | null>(null);
  return (
    <section className="hb-topics" aria-labelledby="hb-topics-title">
      <h2 id="hb-topics-title" className="hb-kicker hb-mono">
        {forChild ? "WHEN THINGS FEEL HARD" : "UNDERSTAND AND HEAL"}
      </h2>
      <div className="hb-topic-grid">
        {TOPICS.filter((t) => !forChild || CHILD_TOPICS.includes(t.id)).map((t) => {
          const isOpen = open === t.id;
          return (
            <article key={t.id} className="hb-topic" data-open={isOpen ? "true" : "false"}>
              <div className="hb-topic-banner" data-topic={t.id}>
                <img src={topicPhoto(t.id, forChild)} alt="" />
                <div className="hb-topic-words">
                  <p className="hb-topic-kicker hb-mono">{t.kicker.toUpperCase()}</p>
                  <h3 className="hb-topic-title hb-serif">{t.title}</h3>
                  <p className="hb-small">{t.blurb}</p>
                  <button type="button" className="hb-ghost hb-ghost-strong" aria-expanded={isOpen} aria-controls={`hb-topic-${t.id}`} onClick={() => setOpen(isOpen ? null : t.id)}>
                    {isOpen ? "Close" : "Explore"}
                  </button>
                </div>
              </div>
              <div id={`hb-topic-${t.id}`} className="hb-topic-body" hidden={!isOpen}>
                <TopicBody id={t.id} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
