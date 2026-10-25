import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ThemeFrameProps, ThemeHomeProps, ThemeTile, ThemeToolsHomeProps } from "../kitTypes";
import { DINO_CARD_CLIPS, DINO_FOREST, DINO_FRIENDS, DINO_SUNSET, DINO_VALLEY, type DinoClip } from "./media";

// Dino World, for people with the ADHD or autism module. Home and
// dashboard: a sunny valley with a waterfall and a little bridge where Arlo,
// a gentle long-necked dinosaur, and the babies play; the day on a cream
// panel, the dino friends, every page as a speckled egg; then the evening
// turns golden and they all fall asleep in their nest at sunset. The tools
// page: a quiet fern forest with a footprint path, one baby dinosaur per
// tool. Other pages: warm cream with the valley's light and a footprint
// trail. Plant-eaters only: no roars, no volcanoes, nothing sudden.
// Every change of colour fades into the next, so there are no lines.
// It always opens still. Only on Play do the clips play (slowly, no sound)
// and the friends bob; the same button keeps it still again. Low-sensory
// mode never reaches here (it keeps the pages' own plain look).

export const DINO_PLAYBACK_RATE = 0.6;

const usePlaying = () => {
  const [playing, setPlaying] = useState(false);
  return [playing, () => setPlaying((p) => !p)] as const;
};

// A little three-toed footprint.
export const Footprint: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg className={`dn-print ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true">
    <ellipse cx="12" cy="15.5" rx="5" ry="5.5" fill="currentColor" />
    <ellipse cx="6" cy="7.5" rx="2.2" ry="3" transform="rotate(-20 6 7.5)" fill="currentColor" />
    <ellipse cx="12" cy="5" rx="2.2" ry="3.1" fill="currentColor" />
    <ellipse cx="18" cy="7.5" rx="2.2" ry="3" transform="rotate(20 18 7.5)" fill="currentColor" />
  </svg>
);

// A winding line of footprints between parts of a page.
const Trail: React.FC<{ count?: number }> = ({ count = 7 }) => (
  <div className="dn-trail" aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <Footprint key={i} className={i % 2 ? "dn-print--r" : "dn-print--l"} />
    ))}
  </div>
);

const Leaf: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M4 20c0-9 6-15 16-16 0 10-6 16-16 16Z" fill="currentColor" />
    <path d="M5 19 15 9" stroke="#fff8e9" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

interface BarProps {
  playing: boolean;
  onTogglePlay: () => void;
  backTo?: string;
  backLabel?: string;
  extra?: React.ReactNode;
}

const DinoBar: React.FC<BarProps> = ({ playing, onTogglePlay, backTo, backLabel, extra }) => (
  <header className="dn-bar">
    <span className="dn-brand">
      <span className="dn-brand-mark">
        <Leaf />
      </span>
      <span className="dn-brand-word">
        SafeSpace
        <small>Dino World</small>
      </span>
    </span>
    <span className="dn-bar-actions">
      <button type="button" className="dn-btn" aria-pressed={playing} onClick={onTogglePlay}>
        <span aria-hidden="true" className="dn-btn-icon">{playing ? "❚❚" : "▶"}</span>
        {playing ? "Keep it still" : "Play"}
      </button>
      {backTo && (
        <Link to={backTo} className="dn-btn dn-btn--cream">
          {backLabel}
        </Link>
      )}
      {extra}
    </span>
  </header>
);

// A still picture, with its clip laid over it (slowly, silently) while playing.
const DinoMedia: React.FC<{ clip: DinoClip; playing: boolean; className?: string }> = ({ clip, playing, className = "" }) => {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!playing || !v) return;
    v.playbackRate = DINO_PLAYBACK_RATE;
    v.play().catch(() => undefined);
  }, [playing]);
  return (
    <div className={`dn-media ${className}`.trim()} aria-hidden="true">
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
            e.currentTarget.playbackRate = DINO_PLAYBACK_RATE;
          }}
        />
      )}
    </div>
  );
};

// All asleep in the nest at sunset, after the evening turns golden.
const Closing: React.FC<{ playing: boolean }> = ({ playing }) => (
  <section className="dn-closing" aria-label="A few kind words">
    <DinoMedia clip={DINO_SUNSET} playing={playing} className="dn-closing-media" />
    <div className="dn-closing-text">
      <p className="dn-eyebrow">Goodnight from the nest</p>
      <p className="dn-closing-lines">
        <span className="dn-closing-first">You're not alone.</span>
        <span>Start small.</span>
        <span>Rest when you need to.</span>
        <span>Come back any time.</span>
      </p>
    </div>
  </section>
);

// Every page as a speckled egg.
const Eggs: React.FC<{ tiles: ThemeTile[]; label: string }> = ({ tiles, label }) => (
  <nav aria-label={label} className="dn-eggs">
    {tiles.map((t, i) => (
      <Link key={t.to} to={t.to} className={`dn-egg dn-egg--${i % 4}`}>
        <span className="dn-egg-shell">
          <span aria-hidden="true" className="dn-egg-emoji">
            {t.emoji}
          </span>
        </span>
        <span className="dn-egg-label">{t.label}</span>
      </Link>
    ))}
  </nav>
);

const Friends: React.FC = () => (
  <section className="dn-friends" aria-label="Your dino friends">
    <p className="dn-eyebrow dn-eyebrow--light">Your dino friends</p>
    <ul>
      {DINO_FRIENDS.map((f, i) => (
        <li key={f.name} style={{ "--ring": f.colour, animationDelay: `${i * -1.4}s` } as React.CSSProperties}>
          <img src={f.picture} alt="" loading="lazy" />
          <span>{f.name}</span>
        </li>
      ))}
    </ul>
  </section>
);

// A child's home or an Individual's dashboard in Dino World.
export const DinoHome: React.FC<ThemeHomeProps> = ({ eyebrow, greeting, line, status, barExtra, picker, tiles, tilesLabel, children }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="dn dn-home" data-playing={playing ? "true" : "false"}>
      <section className="dn-hero dn-hero--valley" aria-labelledby="dn-hello">
        <DinoMedia clip={DINO_VALLEY} playing={playing} className="dn-valley" />
        <div className="dn-hero-shade" aria-hidden="true" />
        <DinoBar playing={playing} onTogglePlay={togglePlaying} extra={barExtra} />
        <div className="dn-hero-copy">
          <p className="dn-eyebrow">
            <span className="dn-dot" aria-hidden="true" />
            {eyebrow}
          </p>
          <h1 id="dn-hello" className="dn-title">
            {greeting}
            <span>Arlo is happy you're here.</span>
          </h1>
          <p className="dn-lead">{line}</p>
          {status && (
            <p className="dn-status">
              <Footprint />
              {status}
            </p>
          )}
        </div>
      </section>

      <section className="dn-day" aria-labelledby="dn-day-title">
        <div className="dn-wrap">
          <div className="dn-head">
            <h2 id="dn-day-title" className="dn-h2">
              Your day
            </h2>
            {picker}
          </div>
          <div className="dn-panel dn-stack">{children}</div>
          <Friends />
          <Trail />
          <Eggs tiles={tiles} label={tilesLabel} />
        </div>
      </section>

      <Closing playing={playing} />
    </div>
  );
};

// The tools page in Dino World.
export const DinoToolsHome: React.FC<ThemeToolsHomeProps> = ({ items, pathFor, eyebrow, backTo, backLabel, picker }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="dn dn-tools" data-playing={playing ? "true" : "false"}>
      <section className="dn-hero dn-hero--forest" aria-labelledby="dn-tools-title">
        <DinoMedia clip={DINO_FOREST} playing={playing} className="dn-forest" />
        <div className="dn-hero-shade" aria-hidden="true" />
        <DinoBar playing={playing} onTogglePlay={togglePlaying} backTo={backTo} backLabel={backLabel} />
        <div className="dn-hero-copy dn-hero-copy--forest">
          <p className="dn-eyebrow">
            <span className="dn-dot" aria-hidden="true" />
            {eyebrow}
          </p>
          <h1 id="dn-tools-title" className="dn-title">
            Follow the footprints
            <span>to your dino tools.</span>
          </h1>
          <p className="dn-lead">Each little friend has a tool to help. Pick one when you're ready.</p>
          <a className="dn-btn dn-btn--big" href="#dn-tools-list">
            <Footprint />
            See my tools
          </a>
        </div>
      </section>

      <section id="dn-tools-list" className="dn-cards" aria-labelledby="dn-cards-title">
        <div className="dn-wrap">
          <div className="dn-head">
            <h2 id="dn-cards-title" className="dn-h2">
              Your tools
            </h2>
            {picker}
          </div>
          <Trail />
          <ul className="dn-grid">
            {items.map(({ tool, mine }, i) => (
              <li key={tool.key}>
                <Link to={pathFor(tool.key)} className={`dn-card dn-card--${i % 4}`}>
                  <div className="dn-card-media">
                    <DinoMedia clip={DINO_CARD_CLIPS[tool.key]} playing={playing} />
                  </div>
                  <span className="dn-card-tag">{mine ? "Your tool" : "More tools"}</span>
                  <span className="dn-card-title">{tool.label}</span>
                  <span className="dn-card-blurb">{tool.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Closing playing={playing} />
    </div>
  );
};

// A page in Dino World (one tool, routines, journal, music...): warm cream
// with the valley's light at the top and a footprint trail, the page on a
// cream panel.
export const DinoFrame: React.FC<ThemeFrameProps> = ({ eyebrow, title, subtitle, backTo, backLabel, actions, children }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="dn dn-page" data-playing={playing ? "true" : "false"}>
      <div className="dn-page-light" aria-hidden="true">
        <DinoMedia clip={DINO_VALLEY} playing={playing} />
      </div>
      <DinoBar playing={playing} onTogglePlay={togglePlaying} backTo={backTo} backLabel={backLabel} />
      <main className="dn-wrap dn-page-main">
        <div className="dn-page-head">
          <div>
            <p className="dn-eyebrow">
              <span className="dn-dot" aria-hidden="true" />
              {eyebrow}
            </p>
            <h1 className="dn-h1">{title}</h1>
            {subtitle && <p className="dn-sub">{subtitle}</p>}
          </div>
          {actions && <div className="dn-page-actions">{actions}</div>}
        </div>
        <div className="dn-panel dn-stack">{children}</div>
      </main>
    </div>
  );
};
