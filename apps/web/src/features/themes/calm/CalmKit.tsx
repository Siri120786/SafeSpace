import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ThemeFrameProps, ThemeHomeProps, ThemeTile, ThemeToolsHomeProps } from "../kitTypes";
import { CALM_CAMP, CALM_CARD_PICTURES, CALM_MEADOW, type CalmClip } from "./media";

// The Calm theme, the default for people with the ADHD or autism module.
// Home and dashboard: the landing page's sunny meadow, a boy and his puppy
// on the grass under big clouds; the day on a light panel and every page as
// a tile; then evening falls (the grass darkens into night) and a few kind
// words sit over a moonlit winter camp where a husky watches a campfire.
// The tools page: that same camp, the tools on night-blue cards, and night
// lifts into the meadow's morning sky at the end. Other pages: the meadow's
// light fading into soft cream around a panel.
// Every change of colour fades into the next, so there are no lines.
// It always opens still. Only on Play do the clips play (slowly, no sound);
// the same button keeps it still again. Low-sensory mode never reaches here
// (it keeps the pages' own plain look).

export const CALM_PLAYBACK_RATE = 0.6;

// The landing page's sprout mark.
const Sprout: React.FC = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" fill="#fff" width="22" height="22">
    <path d="M15 30c0-7 0-11 1-15" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    <path d="M16 16c-1-6-6-10-13-10 0 7 5 11 13 10Z" />
    <path d="M16.5 13c1.5-5 6-8.5 12.5-8 .2 6.5-4.5 10-12.5 8Z" opacity=".92" />
  </svg>
);

const usePlaying = () => {
  const [playing, setPlaying] = useState(false);
  return [playing, () => setPlaying((p) => !p)] as const;
};

interface BarProps {
  tone: "meadow" | "camp";
  playing: boolean;
  onTogglePlay: () => void;
  backTo?: string;
  backLabel?: string;
  extra?: React.ReactNode;
}

const CalmBar: React.FC<BarProps> = ({ tone, playing, onTogglePlay, backTo, backLabel, extra }) => (
  <header className={`cm-bar cm-bar--${tone}`}>
    <span className="cm-logo">
      {tone === "meadow" && <Sprout />}
      SafeSpace
    </span>
    <span className="cm-bar-actions">
      <button type="button" className="cm-btn" aria-pressed={playing} onClick={onTogglePlay}>
        <span aria-hidden="true" className="cm-btn-icon">{playing ? "❚❚" : "▶"}</span>
        {playing ? "Keep it still" : "Play"}
      </button>
      {backTo && (
        <Link to={backTo} className="cm-btn">
          {backLabel}
        </Link>
      )}
      {extra}
    </span>
  </header>
);

// A still picture, with its clip laid over it (slowly, silently) while
// playing. `meadow` places the landing page's square loop over its 9:8 plate.
const CalmMedia: React.FC<{ clip: CalmClip; playing: boolean; className?: string; meadow?: boolean }> = ({
  clip,
  playing,
  className = "",
  meadow = false,
}) => {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!playing || !v) return;
    v.playbackRate = CALM_PLAYBACK_RATE;
    v.play().catch(() => undefined);
  }, [playing]);
  return (
    <div className={`cm-media ${className}`.trim()} aria-hidden="true">
      <div className={meadow ? "cm-meadow-box" : "cm-fill"}>
        <img className="cm-plate" src={clip.still} alt="" />
        {playing && clip.loop && (
          <video
            ref={video}
            className={meadow ? "cm-meadow-video" : "cm-plate"}
            src={clip.loop}
            muted
            loop
            playsInline
            preload="auto"
            onLoadedMetadata={(e) => {
              e.currentTarget.playbackRate = CALM_PLAYBACK_RATE;
            }}
          />
        )}
      </div>
    </div>
  );
};

const CLOSING_LINES = ["You're not alone.", "Start small.", "Rest when you need to.", "Come back any time."];

// Home: evening falls into the moonlit camp. Tools: night lifts into the
// meadow's morning.
const Closing: React.FC<{ playing: boolean; scene: "camp" | "meadow" }> = ({ playing, scene }) => (
  <section className={`cm-closing cm-closing--${scene}`} aria-label="A few kind words">
    <CalmMedia clip={scene === "camp" ? CALM_CAMP : CALM_MEADOW} playing={playing} meadow={scene === "meadow"} className="cm-closing-media" />
    <div className="cm-closing-text">
      <p className="cm-kicker">{scene === "camp" ? "Goodnight, little steps" : "Good morning"}</p>
      <p className="cm-closing-lines">
        {CLOSING_LINES.map((l, i) => (
          <span key={l} className={i === 0 ? "cm-closing-first" : undefined}>
            {l}
          </span>
        ))}
      </p>
    </div>
  </section>
);

// Every page as a puffy cloud from the meadow's sky.
const CalmTiles: React.FC<{ tiles: ThemeTile[]; label: string }> = ({ tiles, label }) => (
  <nav aria-label={label} className="cm-tiles">
    {tiles.map((t, i) => (
      <Link key={t.to} to={t.to} className={`cm-tile cm-tile--${i % 4}`}>
        <span className="cm-cloud">
          <span aria-hidden="true" className="cm-tile-emoji">
            {t.emoji}
          </span>
        </span>
        <span className="cm-tile-label">{t.label}</span>
      </Link>
    ))}
  </nav>
);

// A child's home or an Individual's dashboard in the Calm theme.
export const CalmHome: React.FC<ThemeHomeProps> = ({ eyebrow, greeting, line, status, barExtra, picker, tiles, tilesLabel, children }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="cm cm-home" data-playing={playing ? "true" : "false"}>
      <section className="cm-hero cm-hero--meadow" aria-labelledby="cm-hello">
        <CalmMedia clip={CALM_MEADOW} playing={playing} meadow className="cm-hero-media" />
        <div className="cm-hero-shade" aria-hidden="true" />
        <CalmBar tone="meadow" playing={playing} onTogglePlay={togglePlaying} extra={barExtra} />
        <div className="cm-meadow-copy">
          <p className="cm-kicker cm-display">{eyebrow}</p>
          <h1 id="cm-hello" className="cm-display cm-meadow-title">
            <span>{greeting}</span>
            <span>A gentle day</span>
          </h1>
          <p className="cm-meadow-line">{line}</p>
          {status && <p className="cm-status">{status}</p>}
        </div>
      </section>

      <section className="cm-day" aria-labelledby="cm-day-title">
        <div className="cm-wrap">
          <div className="cm-head">
            <h2 id="cm-day-title" className="cm-display cm-h2">
              Your day
            </h2>
            {picker}
          </div>
          <div className="cm-panel cm-stack">{children}</div>
          <CalmTiles tiles={tiles} label={tilesLabel} />
        </div>
      </section>

      <Closing playing={playing} scene="camp" />
    </div>
  );
};

// The tools page in the Calm theme.
export const CalmToolsHome: React.FC<ThemeToolsHomeProps> = ({ items, pathFor, eyebrow, backTo, backLabel, picker }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="cm cm-tools" data-playing={playing ? "true" : "false"}>
      <section className="cm-hero cm-hero--camp" aria-labelledby="cm-tools-title">
        <CalmMedia clip={CALM_CAMP} playing={playing} className="cm-camp" />
        <div className="cm-hero-shade" aria-hidden="true" />
        <CalmBar tone="camp" playing={playing} onTogglePlay={togglePlaying} backTo={backTo} backLabel={backLabel} />
        <div className="cm-camp-copy">
          <p className="cm-camp-eyebrow">{eyebrow}</p>
          <h1 id="cm-tools-title" className="cm-serif cm-camp-title">
            <span>Your</span>
            <span>Tools</span>
          </h1>
          <p className="cm-camp-line">Sit by the fire for a while. When you're ready, pick one small tool to help with today.</p>
          <a className="cm-explore" href="#cm-tools-list">
            See my tools
          </a>
        </div>
      </section>

      <section id="cm-tools-list" className="cm-cards" aria-labelledby="cm-cards-title">
        <div className="cm-wrap">
          <div className="cm-head">
            <h2 id="cm-cards-title" className="cm-serif cm-cards-title">
              Pick one
            </h2>
            {picker}
          </div>
          <ul className="cm-grid">
            {items.map(({ tool, mine }) => (
              <li key={tool.key}>
                <Link to={pathFor(tool.key)} className="cm-card">
                  <div className="cm-card-media">
                    <img src={CALM_CARD_PICTURES[tool.key]} alt="" loading="lazy" />
                  </div>
                  <span className="cm-card-tag">{mine ? "Your tool" : "More tools"}</span>
                  <span className="cm-card-title">{tool.label}</span>
                  <span className="cm-card-blurb">{tool.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Closing playing={playing} scene="meadow" />
    </div>
  );
};

// A page in the Calm theme (one tool, routines, journal, music...): the
// meadow's light fading into soft cream, the page on a light panel.
export const CalmFrame: React.FC<ThemeFrameProps> = ({ eyebrow, title, subtitle, backTo, backLabel, actions, children }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="cm cm-page" data-playing={playing ? "true" : "false"}>
      <div className="cm-page-light" aria-hidden="true">
        <CalmMedia clip={CALM_MEADOW} playing={playing} meadow />
      </div>
      <CalmBar tone="meadow" playing={playing} onTogglePlay={togglePlaying} backTo={backTo} backLabel={backLabel} />
      <main className="cm-wrap cm-page-main">
        <div className="cm-page-head">
          <div>
            <p className="cm-kicker cm-display">{eyebrow}</p>
            <h1 className="cm-display cm-h1">{title}</h1>
            {subtitle && <p className="cm-sub">{subtitle}</p>}
          </div>
          {actions && <div className="cm-page-actions">{actions}</div>}
        </div>
        <div className="cm-panel cm-stack">{children}</div>
      </main>
    </div>
  );
};
