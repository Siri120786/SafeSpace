import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ThemeFrameProps, ThemeHomeProps, ThemeTile, ThemeToolsHomeProps } from "../kitTypes";
import { NATURE_CARD_CLIPS, NATURE_CLOUDS, NATURE_NIGHT, NATURE_REALM, NATURE_TREE, NATURE_VALLEY, type NatureClip } from "./media";

// The Nature theme for people with the ADHD or autism module. Home and
// dashboard: a cherry-blossom valley under a white sky with soft clouds and
// frosted glass squares; the day on a light panel, every page as a cherry
// blossom, a blossom tree, three kind steps (pick one small thing, do a
// little, rest and check in), and a few words over the valley by moonlight.
// The tools page: a glass dome of moss, wildflowers and butterflies on old
// roots in the dark, the tools as glass cards from the same dome.
// Every change of colour fades into the next, so there are no lines.
// It always opens still. Only on Play do the clips play (slowly, no sound),
// the clouds drift and petals fall; the same button keeps it still again.
// Low-sensory mode never reaches here (it always shows the calm look).

export const NATURE_PLAYBACK_RATE = 0.6;

// The steps on the home page.
export const NATURE_STEPS = [
  { title: "Pick one small thing", text: "Choose just one thing from today. It doesn't have to be the biggest one." },
  { title: "Do a little", text: "Start with a few minutes. A small start still counts." },
  { title: "Rest and check in", text: "Take a break, notice how you feel, and come back when you're ready." },
] as const;

// Frosted squares over the valley, as [left %, top %] (from the design).
const GLASS: [number, number][] = [
  [3, 64], [3, 71], [6.5, 71], [10, 71], [3, 78],
  [45.5, 76], [49, 80], [49, 76], [52.5, 76],
  [86, 58], [86, 67], [82, 76], [89.5, 76], [86, 84],
];

const usePlaying = () => {
  const [playing, setPlaying] = useState(false);
  return [playing, () => setPlaying((p) => !p)] as const;
};

const Mark: React.FC = () => (
  <svg viewBox="0 0 30 22" width="26" height="19" aria-hidden="true">
    <circle cx="4" cy="17" r="3.6" fill="currentColor" />
    <path d="M10.5 18.5 16.8 5.2 25.5 18.5" fill="none" stroke="currentColor" strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface BarProps {
  playing: boolean;
  onTogglePlay: () => void;
  backTo?: string;
  backLabel?: string;
  extra?: React.ReactNode;
}

const NatureBar: React.FC<BarProps> = ({ playing, onTogglePlay, backTo, backLabel, extra }) => (
  <header className="nt-nav">
    <span className="nt-brand">
      <Mark />
      safespace
    </span>
    <span className="nt-nav-actions">
      <button type="button" className="nt-btn" aria-pressed={playing} onClick={onTogglePlay}>
        <span aria-hidden="true" className="nt-btn-icon">{playing ? "❚❚" : "▶"}</span>
        {playing ? "Keep it still" : "Play"}
      </button>
      {backTo && (
        <Link to={backTo} className="nt-btn nt-btn--soft">
          {backLabel}
        </Link>
      )}
      {extra}
    </span>
  </header>
);

// A still picture, with its clip laid over it (slowly, silently) while playing.
const NatureMedia: React.FC<{ clip: NatureClip; playing: boolean; className?: string }> = ({ clip, playing, className = "" }) => {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!playing || !v) return;
    v.playbackRate = NATURE_PLAYBACK_RATE;
    v.play().catch(() => undefined);
  }, [playing]);
  return (
    <div className={`nt-media ${className}`.trim()} aria-hidden="true">
      <img src={clip.still} alt="" loading="lazy" />
      {playing && (
        <video
          ref={video}
          src={clip.loop}
          muted
          loop
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => {
            e.currentTarget.playbackRate = NATURE_PLAYBACK_RATE;
          }}
        />
      )}
    </div>
  );
};

// Pink petals drifting down; only drawn while playing.
const Petals: React.FC<{ playing: boolean }> = ({ playing }) => {
  const [petals] = useState(() =>
    Array.from({ length: 16 }, (_, i) => ({
      left: (i * 61) % 100,
      dx: ((i * 37) % 160) - 80,
      dur: 12 + ((i * 7) % 9),
      delay: -((i * 5) % 15),
      scale: 0.6 + ((i * 13) % 8) / 10,
    })),
  );
  if (!playing) return null;
  return (
    <div className="nt-petals" aria-hidden="true">
      {petals.map((p, i) => (
        <span
          key={i}
          className="nt-petal"
          style={
            {
              left: `${p.left}%`,
              "--dx": `${p.dx}px`,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              width: `${10 * p.scale}px`,
              height: `${8 * p.scale}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
};

const Closing: React.FC<{ playing: boolean; tone: "light" | "dark" }> = ({ playing, tone }) => (
  <section className={`nt-closing nt-closing--${tone}`} aria-label="A few kind words">
    <div className="nt-closing-img" aria-hidden="true">
      <img src={NATURE_NIGHT} alt="" loading="lazy" />
    </div>
    <Petals playing={playing} />
    <div className="nt-closing-card">
      <span className="nt-pill">One step at a time</span>
      <p className="nt-closing-lines">You're not alone. Start small, rest when you need to, and come back any time.</p>
    </div>
  </section>
);

// Every page as a little glass terrarium jar, like the hidden garden.
const Blossoms: React.FC<{ tiles: ThemeTile[]; label: string }> = ({ tiles, label }) => (
  <nav aria-label={label} className="nt-blossoms">
    {tiles.map((t, i) => (
      <Link key={t.to} to={t.to} className={`nt-blossom nt-blossom--${i % 4}`}>
        <span className="nt-jar">
          <span className="nt-jar-lid" aria-hidden="true" />
          <span className="nt-jar-glass">
            <span aria-hidden="true" className="nt-blossom-emoji">
              {t.emoji}
            </span>
            <span className="nt-jar-moss" aria-hidden="true" />
          </span>
        </span>
        <span className="nt-blossom-label">{t.label}</span>
      </Link>
    ))}
  </nav>
);

// Three kind steps: one panel open at a time (hover, focus or tap opens it);
// on phones, a simple list.
const Steps: React.FC<{ playing: boolean }> = ({ playing }) => {
  const [open, setOpen] = useState(0);
  return (
    <section className="nt-steps" aria-labelledby="nt-steps-title">
      <div className="nt-steps-cloud" aria-hidden="true">
        <img className={playing ? "nt-drift-a" : ""} src={NATURE_CLOUDS.a} alt="" />
      </div>
      <div className="nt-steps-head">
        <span className="nt-pill">One step at a time</span>
        <h2 id="nt-steps-title" className="nt-h2">
          Small steps,
          <br />
          kind breaks.
        </h2>
      </div>
      <div className="nt-track">
        {NATURE_STEPS.map((s, i) => (
          <div
            key={s.title}
            className={`nt-panel${open === i ? " is-active" : ""}`}
            tabIndex={0}
            aria-label={`Step ${i + 1}: ${s.title}`}
            onMouseEnter={() => setOpen(i)}
            onFocus={() => setOpen(i)}
            onClick={() => setOpen(i)}
          >
            <div className="nt-panel-in">
              <span className={`nt-num nt-num--${i + 1}`} aria-hidden="true">
                {i + 1}
              </span>
              <div className="nt-step">
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// A child's home or an Individual's dashboard in the Nature theme.
export const NatureHome: React.FC<ThemeHomeProps> = ({ eyebrow, greeting, line, status, barExtra, picker, tiles, tilesLabel, children }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="nt nt-home" data-playing={playing ? "true" : "false"}>
      <section className="nt-hero" aria-labelledby="nt-hello">
        <NatureBar playing={playing} onTogglePlay={togglePlaying} extra={barExtra} />
        <div className="nt-cloud nt-cloud--l" aria-hidden="true">
          <img className={playing ? "nt-drift-a" : ""} src={NATURE_CLOUDS.a} alt="" />
        </div>
        <div className="nt-cloud nt-cloud--r" aria-hidden="true">
          <img className={playing ? "nt-drift-b" : ""} src={NATURE_CLOUDS.b} alt="" />
        </div>
        <div className="nt-hero-copy">
          <span className="nt-pill">{eyebrow}</span>
          <h1 id="nt-hello" className="nt-title">
            {greeting}
            <br />
            Here's your <em>gentle day.</em>
          </h1>
          <p className="nt-lead">{line}</p>
          {status && <p className="nt-status">{status}</p>}
        </div>
        <NatureMedia clip={NATURE_VALLEY} playing={playing} className="nt-hero-media" />
        <div className="nt-glass-field" aria-hidden="true">
          {GLASS.map(([x, y], i) => (
            <span key={i} className={`nt-glass${x > 40 && x < 60 ? " nt-glass--sm" : ""}${i % 2 ? " nt-glass--wide" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} />
          ))}
        </div>
      </section>

      <section className="nt-day" aria-labelledby="nt-day-title">
        <div className="nt-wrap">
          <div className="nt-head">
            <div>
              <span className="nt-pill">Today</span>
              <h2 id="nt-day-title" className="nt-h2 nt-h2--left">
                Your day
              </h2>
            </div>
            {picker}
          </div>
          <div className="nt-panel-box nt-stack">{children}</div>
          <Blossoms tiles={tiles} label={tilesLabel} />
        </div>
        <div className="nt-tree" aria-hidden="true">
          <img src={NATURE_TREE} alt="" loading="lazy" />
        </div>
      </section>

      <Steps playing={playing} />
      <Closing playing={playing} tone="light" />
    </div>
  );
};

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

// The tools page in the Nature theme.
export const NatureToolsHome: React.FC<ThemeToolsHomeProps> = ({ items, pathFor, eyebrow, backTo, backLabel, picker }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="nt nt-tools" data-playing={playing ? "true" : "false"}>
      <section className="nt-realm" aria-labelledby="nt-realm-title">
        <NatureMedia clip={NATURE_REALM} playing={playing} className="nt-realm-media" />
        <NatureBar playing={playing} onTogglePlay={togglePlaying} backTo={backTo} backLabel={backLabel} />
        <div className="nt-realm-copy">
          <p className="nt-realm-eyebrow">{eyebrow}</p>
          <h1 id="nt-realm-title" className="nt-serif nt-realm-title">
            Your hidden
            <br />
            garden
          </h1>
          <p className="nt-realm-sub">Small living things grow slowly. So can you, one tool at a time.</p>
          <a className="nt-liquid" href="#nt-tools-list">
            See my tools
          </a>
        </div>
      </section>

      <section id="nt-tools-list" className="nt-cards" aria-labelledby="nt-cards-title">
        <div className="nt-wrap">
          <div className="nt-head">
            <h2 id="nt-cards-title" className="nt-serif nt-cards-title">
              Your tools
            </h2>
            {picker}
          </div>
          <ul className="nt-grid">
            {items.map(({ tool, mine }) => (
              <li key={tool.key}>
                <Link to={pathFor(tool.key)} className="nt-card">
                  <div className="nt-card-media">
                    <NatureMedia clip={NATURE_CARD_CLIPS[tool.key]} playing={playing} />
                  </div>
                  <span className="nt-card-tag">{mine ? "Your tool" : "More tools"}</span>
                  <span className="nt-card-title">
                    {tool.label}
                    <Arrow />
                  </span>
                  <span className="nt-card-blurb">{tool.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Closing playing={playing} tone="dark" />
    </div>
  );
};

// A page in the Nature theme (one tool, routines, journal, music...): the
// valley's soft light at the top fading into white, the page on a panel.
export const NatureFrame: React.FC<ThemeFrameProps> = ({ eyebrow, title, subtitle, backTo, backLabel, actions, children }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="nt nt-page" data-playing={playing ? "true" : "false"}>
      <div className="nt-page-light" aria-hidden="true">
        <NatureMedia clip={NATURE_VALLEY} playing={playing} />
      </div>
      <NatureBar playing={playing} onTogglePlay={togglePlaying} backTo={backTo} backLabel={backLabel} />
      <main className="nt-wrap nt-page-main">
        <div className="nt-page-head">
          <div>
            <span className="nt-pill">{eyebrow}</span>
            <h1 className="nt-h1">{title}</h1>
            {subtitle && <p className="nt-sub">{subtitle}</p>}
          </div>
          {actions && <div className="nt-page-actions">{actions}</div>}
        </div>
        <div className="nt-panel-box nt-stack">{children}</div>
      </main>
    </div>
  );
};
