import React, { useState } from "react";
import { Link } from "react-router-dom";
import { PHASE_INSTRUCTIONS, PHASE_LABELS, cycleSeconds } from "../../../calm-tools/lib/breathing";
import { useBreathingTimer } from "../../../calm-tools/hooks/useBreathingTimer";
import { GROUNDING_STEPS, isLastStep, nextStepIndex, prevStepIndex } from "../../../calm-tools/lib/grounding";
import { ANXIETY_TIPS, REVIEW_NOTICE, SUPPORT_TEXT } from "../../../wellness-modules/lib/content";
import { OceanShell } from "./OceanShell";

// Calm Space (the anxiety module) in the ocean: its home, "Breathe with the
// jellyfish" and 5-4-3-2-1 grounding, for adults (/modules/calm-space) and
// children (/child/modules/calm-space). Same exercises and wording rules as
// the calm tools; only the look is the ocean's.

interface CalmPageProps {
  lowSensory: boolean;
  onExit: () => void;
  notice?: string | null;
  // Where the modules are mounted: /modules, or /child/modules for a child.
  base: string;
}

export const calmSpacePath = (base: string, page?: "breathing" | "grounding") =>
  `${base}/calm-space${page ? `/${page}` : ""}`;

// Thin line icons (no emoji), in the ocean's warm glow.
const Icon: React.FC<{ name: "breath" | "senses" | "arrow" }> = ({ name }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {name === "breath" && (
      <>
        <path d="M3 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2" />
        <path d="M3 13c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2" />
        <path d="M3 17c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2" />
      </>
    )}
    {name === "senses" && (
      <>
        <circle cx="12" cy="12" r="2.2" />
        <circle cx="12" cy="12" r="5.6" />
        <circle cx="12" cy="12" r="9" />
      </>
    )}
    {name === "arrow" && <path d="M5 12h14M13 6l6 6-6 6" />}
  </svg>
);

const OceanNotes: React.FC = () => (
  <div className="oc-card oc-small">
    <p role="note" style={{ marginTop: 0 }}>
      {REVIEW_NOTICE} Your entries stay on this page only and are not saved yet.
    </p>
    <p>{SUPPORT_TEXT}</p>
  </div>
);

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------
export const OceanCalmSpace: React.FC<CalmPageProps> = ({ lowSensory, onExit, notice, base }) => (
  <OceanShell lowSensory={lowSensory} onExit={onExit} notice={notice}>
    <p className="oc-kicker oc-display">BREATHE · NOTICE · SETTLE</p>
    <h1 className="oc-title oc-display">Calm Space</h1>
    <p className="oc-lead">
      Slow down with the jellyfish. Nothing to rush and nothing to get right: just a few quiet minutes for you.
    </p>

    <div className="oc-stack">
      <div className="oc-grid">
        <Link to={calmSpacePath(base, "breathing")} className="oc-card oc-row" aria-label="Breathe with the jellyfish: start breathing">
          <span className="oc-icon"><Icon name="breath" /></span>
          <div className="oc-row-text">
            <h2 className="oc-display">Breathe with the jellyfish</h2>
            <p>Breathe in, hold and breathe out slowly, while the jellyfish pulse with you.</p>
          </div>
          <span className="oc-arrow"><Icon name="arrow" /></span>
        </Link>
        <Link to={calmSpacePath(base, "grounding")} className="oc-card oc-row" aria-label="5-4-3-2-1 grounding: start grounding">
          <span className="oc-icon"><Icon name="senses" /></span>
          <div className="oc-row-text">
            <h2 className="oc-display">5-4-3-2-1 grounding</h2>
            <p>Notice what you can see, touch, hear, smell and taste, one sense at a time.</p>
          </div>
          <span className="oc-arrow"><Icon name="arrow" /></span>
        </Link>
      </div>

      <section className="oc-card" aria-labelledby="oc-tips">
        <h2 id="oc-tips" className="oc-display">Gentle tips</h2>
        <ul className="oc-list">
          {ANXIETY_TIPS.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>

      <OceanNotes />
    </div>
  </OceanShell>
);

// ---------------------------------------------------------------------------
// Breathe with the jellyfish
// ---------------------------------------------------------------------------
export const OceanBreathing: React.FC<CalmPageProps> = ({ lowSensory, onExit, notice }) => {
  const { pattern, state, running, notStarted, paused, start, pause, reset } = useBreathingTimer();

  let headline: string;
  let detail: string;
  if (state.finished) {
    headline = "Well done";
    detail = "You finished your breathing. Notice how your body feels now, like the water after a wave.";
  } else if (notStarted) {
    headline = "Ready when you are";
    detail = `Breathe in for ${pattern.inhaleSeconds}, hold for ${pattern.holdSeconds}, and breathe out for ${pattern.exhaleSeconds}, ${pattern.cycles} times. The jellyfish will pulse once with every breath.`;
  } else if (paused) {
    headline = "Paused";
    detail = "Press Resume when you're ready, or Reset to start again.";
  } else {
    headline = PHASE_LABELS[state.phase];
    detail = PHASE_INSTRUCTIONS[state.phase];
  }

  // The bubble fills as you breathe in and empties as you breathe out, unless
  // motion is turned down. The jellyfish match the breath's pace while it runs.
  const active = running || paused;
  const growing = state.phase === "inhale" || state.phase === "hold";
  const scale = lowSensory || !active ? 1 : growing ? 1.22 : 0.84;
  const phaseSeconds =
    state.phase === "inhale" ? pattern.inhaleSeconds : state.phase === "hold" ? pattern.holdSeconds : pattern.exhaleSeconds;

  return (
    <OceanShell lowSensory={lowSensory} onExit={onExit} exitLabel="Back to Calm Space" notice={notice} pulsePeriod={running ? cycleSeconds(pattern) : null}>
      <p className="oc-kicker oc-display">CALM SPACE</p>
      <h1 className="oc-title oc-display">Breathe with the jellyfish</h1>
      <div className="oc-stack">
        <div className="oc-card" style={{ textAlign: "center" }}>
          <div
            className="oc-bubble"
            aria-hidden="true"
            data-testid="breathing-circle"
            style={{ transform: `scale(${scale})`, transition: lowSensory ? "none" : `transform ${phaseSeconds}s ease-in-out` }}
          >
            <span className="oc-display">{active && !state.finished ? state.secondsLeft : ""}</span>
          </div>
          <div role="status" aria-live="polite">
            <h2 className="oc-display">{headline}</h2>
            <p>{detail}</p>
          </div>
          {!notStarted && (
            <div className="oc-steps" aria-label={`Breath ${Math.min(state.cycle, pattern.cycles)} of ${pattern.cycles}`}>
              {Array.from({ length: pattern.cycles }, (_, i) => (
                <i key={i} data-on={i < Math.min(state.cycle, pattern.cycles) ? "true" : "false"} />
              ))}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 8 }}>
            {running ? (
              <button type="button" className="oc-btn oc-btn-amber" onClick={pause}>Pause</button>
            ) : (
              <button type="button" className="oc-btn oc-btn-amber" onClick={start}>
                {state.finished ? "Start again" : paused ? "Resume" : "Start"}
              </button>
            )}
            <button type="button" className="oc-btn oc-btn-glass" onClick={reset} disabled={notStarted}>Reset</button>
          </div>
        </div>
      </div>
    </OceanShell>
  );
};

// ---------------------------------------------------------------------------
// 5-4-3-2-1 grounding
// ---------------------------------------------------------------------------
export const OceanGrounding: React.FC<CalmPageProps> = ({ lowSensory, onExit, notice }) => {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const step = GROUNDING_STEPS[index];
  const last = isLastStep(index);

  return (
    <OceanShell lowSensory={lowSensory} onExit={onExit} exitLabel="Back to Calm Space" notice={notice}>
      <p className="oc-kicker oc-display">CALM SPACE</p>
      <h1 className="oc-title oc-display">5-4-3-2-1 grounding</h1>
      <div className="oc-stack">
        <div className="oc-card">
          {done ? (
            <div role="status" aria-live="polite" style={{ textAlign: "center" }}>
              <h2 className="oc-display">Well done</h2>
              <p>You noticed the world around you with all five senses. Take one slow breath before you go on.</p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 18 }}>
                <button type="button" className="oc-btn oc-btn-glass" onClick={() => { setIndex(0); setDone(false); }}>
                  Do it again
                </button>
                <button type="button" className="oc-btn oc-btn-amber" onClick={onExit}>Finish</button>
              </div>
            </div>
          ) : (
            <>
              <div className="oc-steps" style={{ justifyContent: "flex-start" }} aria-label={`Step ${index + 1} of ${GROUNDING_STEPS.length}`}>
                {GROUNDING_STEPS.map((s, i) => <i key={s.title} data-on={i <= index ? "true" : "false"} />)}
              </div>
              <div role="status" aria-live="polite">
                <h2 className="oc-display">{step.title}</h2>
                <p style={{ color: "var(--oc-text)", fontSize: 17 }}>{step.instruction}</p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginTop: 20 }}>
                <button type="button" className="oc-btn oc-btn-glass" onClick={() => setIndex(prevStepIndex(index))} disabled={index === 0}>
                  Back
                </button>
                {last ? (
                  <button type="button" className="oc-btn oc-btn-amber" onClick={() => setDone(true)}>Done</button>
                ) : (
                  <button type="button" className="oc-btn oc-btn-amber" onClick={() => setIndex(nextStepIndex(index))}>Next</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </OceanShell>
  );
};
