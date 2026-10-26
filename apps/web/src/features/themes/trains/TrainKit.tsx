import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ThemeFrameProps, ThemeHomeProps, ThemeTile, ThemeToolsHomeProps } from "../kitTypes";
import { TRAIN_CARD_CLIPS, TRAIN_CARRIAGE, TRAIN_FRIEND_NAMES, TRAIN_PLATFORM, TRAIN_STATION, type TrainClip } from "./media";

// The Trains theme for people with the ADHD or autism module, with the
// bright, friendly feel of a toy railway (and its own original engines).
// Home and dashboard: Peter, Poppy, Sunny and Bramble at a little island
// station; today on a departure board; the day on a cream panel and every
// page as a carriage coupled into a long train; then evening falls into a
// quiet seat by a carriage window at sunset. The tools page: Peter at the
// platform, each tool a station with its engine friend. Other pages: a cream
// platform under the station's light.
// Every change of colour fades into the next, so there are no lines.
// It always opens still. Only on Play do the clips play (slowly, no sound,
// no whistles); the same button keeps it still again. Low-sensory mode never
// reaches here (it keeps the pages' own plain look).

export const TRAIN_PLAYBACK_RATE = 0.6;

const usePlaying = () => {
  const [playing, setPlaying] = useState(false);
  return [playing, () => setPlaying((p) => !p)] as const;
};

const Engine: React.FC = () => (
  <svg viewBox="0 0 32 24" width="26" height="20" aria-hidden="true">
    <rect x="2" y="9" width="18" height="9" rx="3" fill="currentColor" />
    <rect x="15" y="4" width="11" height="14" rx="2.5" fill="currentColor" />
    <rect x="5" y="4" width="4" height="6" rx="1.2" fill="currentColor" />
    <rect x="18" y="7" width="5" height="4" rx="1" fill="#fbf4e4" />
    <circle cx="8" cy="20" r="3" fill="currentColor" stroke="#fbf4e4" strokeWidth="1.5" />
    <circle cx="21" cy="20" r="3" fill="currentColor" stroke="#fbf4e4" strokeWidth="1.5" />
  </svg>
);

interface BarProps {
  playing: boolean;
  onTogglePlay: () => void;
  backTo?: string;
  backLabel?: string;
  extra?: React.ReactNode;
}

const TrainBar: React.FC<BarProps> = ({ playing, onTogglePlay, backTo, backLabel, extra }) => (
  <header className="tr-bar">
    <span className="tr-brand">
      <span className="tr-brand-mark">
        <Engine />
      </span>
      SafeSpace
    </span>
    <span className="tr-bar-actions">
      <button type="button" className="tr-btn" aria-pressed={playing} onClick={onTogglePlay}>
        <span aria-hidden="true" className="tr-btn-icon">{playing ? "❚❚" : "▶"}</span>
        {playing ? "Keep it still" : "Play"}
      </button>
      {backTo && (
        <Link to={backTo} className="tr-btn tr-btn--cream">
          {backLabel}
        </Link>
      )}
      {extra}
    </span>
  </header>
);

// A still picture, with its clip laid over it (slowly, silently) while playing.
const TrainMedia: React.FC<{ clip: TrainClip; playing: boolean; className?: string }> = ({ clip, playing, className = "" }) => {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!playing || !v) return;
    v.playbackRate = TRAIN_PLAYBACK_RATE;
    v.play().catch(() => undefined);
  }, [playing]);
  return (
    <div className={`tr-media ${className}`.trim()} aria-hidden="true">
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
            e.currentTarget.playbackRate = TRAIN_PLAYBACK_RATE;
          }}
        />
      )}
    </div>
  );
};

// Today's word, shown like a station departure board.
const Departures: React.FC<{ status: string }> = ({ status }) => (
  <div className="tr-board">
    <span className="tr-board-head">
      <span>Next stop</span>
      <span aria-hidden="true">Platform 1</span>
    </span>
    <span className="tr-board-line">{status}</span>
  </div>
);

// A quiet seat by the window as the mountains pass at sunset.
const Closing: React.FC<{ playing: boolean }> = ({ playing }) => (
  <section className="tr-closing" aria-label="A few kind words">
    <TrainMedia clip={TRAIN_CARRIAGE} playing={playing} className="tr-closing-media" />
    <div className="tr-closing-text">
      <p className="tr-eyebrow tr-eyebrow--warm">The quiet carriage</p>
      <p className="tr-closing-lines">
        <span className="tr-closing-first">You're not alone.</span>
        <span>Start small.</span>
        <span>Rest when you need to.</span>
        <span>Come back any time.</span>
      </p>
    </div>
  </section>
);

// Every page as a carriage, coupled into one long train.
const Carriages: React.FC<{ tiles: ThemeTile[]; label: string }> = ({ tiles, label }) => (
  <nav aria-label={label} className="tr-train">
    {tiles.map((t, i) => (
      <Link key={t.to} to={t.to} className={`tr-coach tr-coach--${i % 4}`}>
        <span className="tr-coach-body">
          <span className="tr-coach-window">
            <span aria-hidden="true" className="tr-coach-emoji">
              {t.emoji}
            </span>
          </span>
          <span className="tr-coach-wheels" aria-hidden="true">
            <i />
            <i />
          </span>
        </span>
        <span className="tr-coach-label">{t.label}</span>
      </Link>
    ))}
  </nav>
);

// A child's home or an Individual's dashboard in the Trains theme.
export const TrainHome: React.FC<ThemeHomeProps> = ({ eyebrow, greeting, line, status, barExtra, picker, tiles, tilesLabel, children }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="tr tr-home" data-playing={playing ? "true" : "false"}>
      <section className="tr-hero tr-hero--station" aria-labelledby="tr-hello">
        <TrainMedia clip={TRAIN_STATION} playing={playing} className="tr-station" />
        <div className="tr-hero-shade" aria-hidden="true" />
        <TrainBar playing={playing} onTogglePlay={togglePlaying} extra={barExtra} />
        <div className="tr-hero-copy">
          <p className="tr-eyebrow">{eyebrow}</p>
          <h1 id="tr-hello" className="tr-title">
            {greeting}
            <span>All aboard with Peter and friends!</span>
          </h1>
          <p className="tr-lead">{line}</p>
          {status && <Departures status={status} />}
        </div>
      </section>

      <section className="tr-day" aria-labelledby="tr-day-title">
        <div className="tr-wrap">
          <div className="tr-head">
            <h2 id="tr-day-title" className="tr-h2">
              Your day
            </h2>
            {picker}
          </div>
          <div className="tr-panel tr-stack">{children}</div>
          <div className="tr-rails" aria-hidden="true" />
          <Carriages tiles={tiles} label={tilesLabel} />
        </div>
      </section>

      <Closing playing={playing} />
    </div>
  );
};

// The tools page in the Trains theme.
export const TrainToolsHome: React.FC<ThemeToolsHomeProps> = ({ items, pathFor, eyebrow, backTo, backLabel, picker }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="tr tr-tools" data-playing={playing ? "true" : "false"}>
      <section className="tr-hero tr-hero--platform" aria-labelledby="tr-tools-title">
        <TrainMedia clip={TRAIN_PLATFORM} playing={playing} className="tr-platform" />
        <div className="tr-hero-shade" aria-hidden="true" />
        <TrainBar playing={playing} onTogglePlay={togglePlaying} backTo={backTo} backLabel={backLabel} />
        <div className="tr-hero-copy">
          <p className="tr-eyebrow">{eyebrow}</p>
          <h1 id="tr-tools-title" className="tr-title">
            Choose your
            <span>next stop.</span>
          </h1>
          <p className="tr-lead">Peter is waiting at the platform. Each friend knows a stop that can help today.</p>
          <a className="tr-btn tr-btn--big" href="#tr-tools-list">
            See my stops
          </a>
        </div>
      </section>

      <section id="tr-tools-list" className="tr-cards" aria-labelledby="tr-cards-title">
        <div className="tr-wrap">
          <div className="tr-head">
            <h2 id="tr-cards-title" className="tr-h2">
              Your stops
            </h2>
            {picker}
          </div>
          <ul className="tr-grid">
            {items.map(({ tool, mine }, i) => (
              <li key={tool.key}>
                <Link to={pathFor(tool.key)} className={`tr-stop tr-stop--${i % 4}`}>
                  <span className="tr-sign">
                    <span className="tr-sign-name">{tool.label}</span>
                    <span className="tr-sign-tag">{mine ? "Your stop" : "More stops"}</span>
                  </span>
                  <div className="tr-stop-media">
                    <TrainMedia clip={TRAIN_CARD_CLIPS[tool.key]} playing={playing} />
                  </div>
                  <span className="tr-stop-friend">with {TRAIN_FRIEND_NAMES[tool.key]}</span>
                  <span className="tr-stop-blurb">{tool.blurb}</span>
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

// A page in the Trains theme (one tool, routines, journal, music...): a cream
// platform under the station's light, the page on a ticket-like panel.
export const TrainFrame: React.FC<ThemeFrameProps> = ({ eyebrow, title, subtitle, backTo, backLabel, actions, children }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="tr tr-page" data-playing={playing ? "true" : "false"}>
      <div className="tr-page-light" aria-hidden="true">
        <TrainMedia clip={TRAIN_STATION} playing={playing} />
      </div>
      <TrainBar playing={playing} onTogglePlay={togglePlaying} backTo={backTo} backLabel={backLabel} />
      <main className="tr-wrap tr-page-main">
        <div className="tr-page-head">
          <div>
            <p className="tr-eyebrow">{eyebrow}</p>
            <h1 className="tr-h1">{title}</h1>
            {subtitle && <p className="tr-sub">{subtitle}</p>}
          </div>
          {actions && <div className="tr-page-actions">{actions}</div>}
        </div>
        <div className="tr-panel tr-stack">{children}</div>
      </main>
    </div>
  );
};
