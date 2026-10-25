import React, { useEffect, useRef, useState } from "react";
import { isExitKey } from "../../../calm-tools/lib/lowSensory";
import { ENCOURAGEMENTS, GOAL_IDEAS, GRATITUDE_PROMPT, HOBBY_IDEAS, REVIEW_NOTICE, SUPPORT_TEXT } from "../../../wellness-modules/lib/content";

// Bright Days (the depression module): a dark garden at night with a closed
// door in a beam of light. Each small step (a goal done, a gratitude note)
// opens the door a little more in the small view beside "Today's light" (the
// video, made by Siri, 10 s, 1080p, plays forward to that point and stops).
// The big door stays closed until all five are done; then the page scrolls
// back up and the whole opening plays onto a sunny garden. The videos never
// loop or play on their own; unticking a goal moves them back. Low-sensory
// mode jumps to the frame with no motion.

export const DOOR_VIDEO = new URL("./door-open.mp4", import.meta.url).href;

// How many small steps fill the garden with light.
export const FULL_LIGHT_STEPS = 5;

/** 0 to 1: how far the door has opened. */
export function lightFor(steps: number): number {
  if (!Number.isFinite(steps) || steps <= 0) return 0;
  return Math.min(1, steps / FULL_LIGHT_STEPS);
}

export function lightLine(steps: number): string {
  if (steps <= 0) return "Each small step lets a little light in.";
  if (steps >= FULL_LIGHT_STEPS) return "The door is open. Every step today counted.";
  return `${steps} small ${steps === 1 ? "step" : "steps"} today. The light is growing.`;
}

// Where in the video the door is for a given light: 0 = closed, 1 = the
// garden through the open door (a hair before the end, so the last frame
// stays on screen).
export function doorTime(light: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(0, Math.min(1, light)) * Math.max(0, duration - 0.05);
}

// A gentle eased scroll to the top. Done by hand: some browsers ignore
// `behavior: "smooth"`. Lands at the top even if animation frames stop.
function scrollToTop(ms: number) {
  const from = window.scrollY;
  if (ms <= 0 || from <= 0) {
    window.scrollTo(0, 0);
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - t, 3);
    window.scrollTo(0, Math.round(from * (1 - eased)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  window.setTimeout(() => window.scrollTo(0, 0), ms + 120);
}

// Moves a video to `target`: plays forward to it and stops there, or jumps
// (going back, or in low-sensory mode). Returns a function that cancels it.
function moveTo(v: HTMLVideoElement, target: number, still: boolean): () => void {
  if (still || target < v.currentTime - 0.02) {
    v.pause();
    v.currentTime = target;
    return () => undefined;
  }
  if (Math.abs(target - v.currentTime) < 0.02) return () => undefined;
  // Checked every frame for a clean stop, and on the video's own time updates
  // too, since browsers stop animation frames when the page isn't visible.
  let frame = 0;
  const reached = () => {
    if (v.currentTime < target) return false;
    v.pause();
    cancelAnimationFrame(frame);
    v.removeEventListener("timeupdate", onTime);
    return true;
  };
  const tick = () => {
    if (!reached()) frame = requestAnimationFrame(tick);
  };
  const onTime = () => void reached();
  v.addEventListener("timeupdate", onTime);
  v.play()
    .then(() => {
      frame = requestAnimationFrame(tick);
    })
    .catch(() => {
      v.removeEventListener("timeupdate", onTime);
      v.currentTime = target;
    });
  return () => {
    cancelAnimationFrame(frame);
    v.removeEventListener("timeupdate", onTime);
    v.pause();
  };
}

interface RoomProps {
  lowSensory: boolean;
  onExit: () => void;
  notice?: string | null;
}

export const BrightDaysRoom: React.FC<RoomProps> = ({ lowSensory, onExit, notice }) => {
  const [goals, setGoals] = useState<{ text: string; done: boolean }[]>([]);
  const [goalText, setGoalText] = useState("");
  const [gratitude, setGratitude] = useState<string[]>([]);
  const [gratitudeText, setGratitudeText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<{ where: "goal" | "note"; text: string } | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const peek = useRef<HTMLVideoElement>(null);

  const steps = goals.filter((g) => g.done).length + gratitude.length;
  const light = lightFor(steps);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isExitKey(e.key)) onExit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExit]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The small view follows the light step by step.
  useEffect(() => {
    const v = peek.current;
    if (!v) return;
    let stop = () => undefined as void;
    const go = () => {
      stop = moveTo(v, doorTime(light, v.duration), lowSensory);
    };
    if (v.readyState >= 1) go();
    else v.addEventListener("loadedmetadata", go, { once: true });
    return () => {
      v.removeEventListener("loadedmetadata", go);
      stop();
    };
  }, [light, lowSensory]);

  // The big door stays closed until every step is done. Then the page goes
  // back up to it and the whole opening plays, closed door to garden, so the
  // moment isn't missed while scrolled down. Untick a step and it closes again.
  const open = light >= 1;
  const wasOpen = useRef(false);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let stop = () => undefined as void;
    let timer = 0;
    const go = () => {
      const end = doorTime(1, v.duration);
      if (!open) {
        stop = moveTo(v, 0, true);
      } else if (!wasOpen.current) {
        // Just opened: up to the door, then from closed to open.
        scrollToTop(lowSensory ? 0 : 800);
        v.pause();
        v.currentTime = 0;
        timer = window.setTimeout(() => {
          stop = moveTo(v, end, lowSensory);
        }, lowSensory ? 0 : 900);
      } else {
        stop = moveTo(v, end, true);
      }
      wasOpen.current = open;
    };
    if (v.readyState >= 1) go();
    else v.addEventListener("loadedmetadata", go, { once: true });
    return () => {
      v.removeEventListener("loadedmetadata", go);
      window.clearTimeout(timer);
      stop();
    };
  }, [open, lowSensory]);

  const addGoal = (text: string) => {
    const t = text.trim();
    if (!t) return setError({ where: "goal", text: "Please type a goal first." });
    setError(null);
    setGoals((g) => [...g, { text: t, done: false }]);
    setGoalText("");
  };
  const toggle = (i: number) => {
    const becameDone = !goals[i].done;
    setGoals((g) => g.map((x, j) => (j === i ? { ...x, done: !x.done } : x)));
    setMessage(becameDone ? ENCOURAGEMENTS[i % ENCOURAGEMENTS.length] : null);
  };
  const addGratitude = () => {
    const t = gratitudeText.trim();
    if (!t) return setError({ where: "note", text: "Please write something first." });
    setError(null);
    setGratitude((g) => [...g, t]);
    setGratitudeText("");
  };
  const toContent = () => document.getElementById("bd-content")?.scrollIntoView({ behavior: lowSensory ? "auto" : "smooth" });

  return (
    <div className="bd" data-low-sensory={lowSensory ? "true" : "false"} style={{ ["--bd-light" as string]: String(light) }}>
      <div className="bd-scene" aria-hidden="true">
        <div className="bd-frame">
          <video ref={video} className="bd-video" src={DOOR_VIDEO} muted playsInline preload="auto" />
          <span className="bd-mend" />
        </div>
        <div className="bd-shade" />
      </div>

      <header className="bd-bar" data-scrolled={scrolled ? "true" : "false"}>
        <span className="bd-mark">SafeSpace</span>
        <div className="bd-bar-actions">
          <button type="button" className="bd-pill" onClick={onExit} aria-label="Exit Bright Days and return home">Exit</button>
        </div>
      </header>

      <section className="bd-hero">
        <h1 className="bd-title bd-serif">
          Small steps
          <br className="bd-br" /> let the light in
        </h1>
        <p className="bd-lead">Bright Days, for the low days. One small goal, one good thing, at your own pace.</p>
        <button type="button" className="bd-cta" onClick={toContent}>
          Take a small step
        </button>
      </section>

      <div className="bd-body">
        <div id="bd-content" className="bd-content">
          {notice && (
            <p role="status" className="bd-notice">
              {notice}
            </p>
          )}

          <section className="bd-meter" aria-labelledby="bd-meter-title">
            <div className="bd-peek" aria-hidden="true">
              <video ref={peek} src={DOOR_VIDEO} muted playsInline preload="auto" />
              <span className="bd-mend" />
            </div>
            <div className="bd-meter-words">
              <h2 id="bd-meter-title" className="bd-kicker">TODAY'S LIGHT</h2>
              <div className="bd-meter-bar" aria-hidden="true">
                <span style={{ width: `${light * 100}%` }} />
              </div>
              <p role="status" aria-live="polite" className="bd-meter-line bd-serif">
                {lightLine(steps)}
              </p>
            </div>
          </section>

          <div className="bd-grid">
            <section className="bd-card" aria-labelledby="bd-goals-title">
              <h2 id="bd-goals-title" className="bd-card-title bd-serif">My small goals</h2>
              <p className="bd-small">Pick your own. Skip any you like. Ideas:</p>
              <div className="bd-chips">
                {GOAL_IDEAS.filter((idea) => !goals.some((g) => g.text === idea)).map((g) => (
                  <button key={g} type="button" className="bd-chip" onClick={() => addGoal(g)}>
                    + {g}
                  </button>
                ))}
              </div>
              <form
                className="bd-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  addGoal(goalText);
                }}
              >
                <label htmlFor="goal-input" className="sr-only">
                  Or write your own
                </label>
                <input id="goal-input" value={goalText} placeholder="Or write your own" onChange={(e) => setGoalText(e.target.value)} />
                <button type="submit" className="bd-btn">
                  Add goal
                </button>
              </form>
              {error?.where === "goal" && (
                <p role="alert" className="bd-error">
                  {error.text}
                </p>
              )}
              {goals.length > 0 && (
                <ul className="bd-goals">
                  {goals.map((g, i) => (
                    <li key={`${g.text}-${i}`} data-done={g.done ? "true" : "false"}>
                      <input id={`goal-${i}`} type="checkbox" checked={g.done} onChange={() => toggle(i)} />
                      <label htmlFor={`goal-${i}`}>{g.text}</label>
                    </li>
                  ))}
                </ul>
              )}
              {message && (
                <p role="status" className="bd-cheer bd-serif">
                  {message}
                </p>
              )}
            </section>

            <div className="bd-stack">
              <section className="bd-card" aria-labelledby="bd-notes-title">
                <h2 id="bd-notes-title" className="bd-card-title bd-serif">Gratitude notes</h2>
                <form
                  className="bd-add"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addGratitude();
                  }}
                >
                  <label htmlFor="gratitude-input" className="bd-small bd-label">
                    {GRATITUDE_PROMPT}
                  </label>
                  <input id="gratitude-input" value={gratitudeText} onChange={(e) => setGratitudeText(e.target.value)} />
                  <button type="submit" className="bd-btn">
                    Add note
                  </button>
                </form>
                {error?.where === "note" && (
                  <p role="alert" className="bd-error">
                    {error.text}
                  </p>
                )}
                {gratitude.length > 0 && (
                  <ul className="bd-notes">
                    {gratitude.map((g, i) => (
                      <li key={`${g}-${i}`} className="bd-serif">
                        {g}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="bd-card" aria-labelledby="bd-hobby-title">
                <h2 id="bd-hobby-title" className="bd-card-title bd-serif">Hobby ideas (optional)</h2>
                <ul className="bd-list">
                  {HOBBY_IDEAS.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </section>
            </div>
          </div>

          <footer className="bd-foot">
            <p role="note">{REVIEW_NOTICE} Your entries stay on this page only and are not saved yet.</p>
            <p>{SUPPORT_TEXT}</p>
            <p>Press Escape at any time to leave.</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default BrightDaysRoom;
