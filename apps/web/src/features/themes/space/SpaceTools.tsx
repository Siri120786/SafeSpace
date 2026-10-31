import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ThemeFrameProps, ThemeHomeProps, ThemeTile, ThemeToolItem, ThemeToolsHomeProps } from "../kitTypes";
import { NOVA_HEAD_CLIP, SPACE_CARD_CLIPS, SPACE_ASTRONAUT, SPACE_HELMET, SPACE_PLATE, SPACE_TOGETHER, type SpaceClip } from "./media";
import { IDLE_MS, SPACE_PLAYBACK_RATE, driftTarget, easeToward, headTarget } from "./spaceMotion";
import { T } from "../../../i18n/T";
import i18n from "../../../i18n";

// The Space theme for people with the ADHD or autism module. Home and
// dashboard: Nova the space cadet in front of a glowing planet says hello,
// the day's things sit on a light panel, glass tiles for everything else.
// The tools page: a little astronaut bouncing through a coral world, the
// tools as glass cards. Both end with a few quiet words. Other pages: the
// sky and bar around a light panel.
// It always opens still. Only when the person presses Play do the clips play
// (slowly, with no sound) and Nova's head follow the pointer; the same button
// keeps it still again. The helmet button works either way. Low-sensory mode
// never reaches here (it always shows the calm look).

export type SpaceToolItem = ThemeToolItem;
export type SpaceTile = ThemeTile;

interface BarProps {
  playing: boolean;
  onTogglePlay: () => void;
  backTo?: string;
  backLabel?: string;
  // More buttons for the bar (e.g. Sign out on the dashboard).
  extra?: React.ReactNode;
}

const SpaceBar: React.FC<BarProps> = ({ playing, onTogglePlay, backTo, backLabel, extra }) => (
  <header className="sp-bar">
    <span className="sp-mark">SafeSpace</span>
    <div className="sp-bar-actions">
      <button type="button" className="sp-pill sp-glass" aria-pressed={playing} onClick={onTogglePlay}>
        <span aria-hidden="true" className="sp-pill-icon">{playing ? "❚❚" : "▶"}</span>
        {playing ? <T k="home.keepStill" /> : <T k="home.playSpace" />}
      </button>
      {backTo && (
        <Link to={backTo} className="sp-pill sp-glass">
          {backLabel}
        </Link>
      )}
      {extra}
    </div>
  </header>
);

// Always opens still; never remembered between visits.
const usePlaying = () => {
  const [playing, setPlaying] = useState(false);
  return [playing, () => setPlaying((p) => !p)] as const;
};

// A still picture, with its clip laid over it (slowly, silently) while playing.
const SpaceMedia: React.FC<{ clip: SpaceClip; playing: boolean; className?: string }> = ({ clip, playing, className = "" }) => {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!playing || !v) return;
    v.playbackRate = SPACE_PLAYBACK_RATE;
    v.play().catch(() => undefined);
  }, [playing]);
  return (
    <div className={`sp-media ${className}`.trim()} aria-hidden="true">
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
            e.currentTarget.playbackRate = SPACE_PLAYBACK_RATE;
          }}
        />
      )}
    </div>
  );
};

// Nova turns to follow the pointer by scrubbing the head-turn clip (never
// played). When the pointer rests, the gaze drifts slowly side to side.
function useHeadFollow(playing: boolean, stage: React.RefObject<HTMLElement>, head: React.RefObject<HTMLVideoElement>) {
  useEffect(() => {
    const el = stage.current;
    const v = head.current;
    if (!playing || !el || !v) return;
    let shown = 0.5;
    let target = 0.5;
    let lastMove = performance.now();
    let lastTick = lastMove;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      target = headTarget((e.clientX - box.left) / box.width);
      lastMove = performance.now();
    };
    const tick = (now: number) => {
      const idle = now - lastMove;
      const goal = idle > IDLE_MS ? driftTarget(idle - IDLE_MS) : target;
      shown = easeToward(shown, goal, now - lastTick);
      lastTick = now;
      if (v.duration && !v.seeking) {
        const t = shown * (v.duration - 0.05);
        if (Math.abs(v.currentTime - t) > 0.01) v.currentTime = t;
      }
      frame = requestAnimationFrame(tick);
    };
    el.addEventListener("pointermove", onMove);
    frame = requestAnimationFrame(tick);
    return () => {
      el.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [playing, stage, head]);
}

interface HeroProps {
  eyebrow: string;
  title: string;
  line: string;
  playing: boolean;
  bar: React.ReactNode;
}

// Nova greets the person: "Hi Leo! I'm Nova".
const NovaHero: React.FC<HeroProps> = ({ eyebrow, title, line, playing, bar }) => {
  const stage = useRef<HTMLElement>(null);
  const head = useRef<HTMLVideoElement>(null);
  const [helmet, setHelmet] = useState(false);
  const [headReady, setHeadReady] = useState(false);
  useHeadFollow(playing, stage, head);
  useEffect(() => {
    if (!playing) setHeadReady(false);
  }, [playing]);
  return (
    <section ref={stage} className="sp-hero" aria-labelledby="sp-hello">
      <div className="sp-frame">
        <img className="sp-plate" src={SPACE_PLATE} alt="" />
        {playing && (
          <video
            ref={head}
            className="sp-head"
            data-ready={headReady ? "true" : "false"}
            src={NOVA_HEAD_CLIP}
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            onLoadedData={(e) => {
              e.currentTarget.currentTime = e.currentTarget.duration / 2;
            }}
            onSeeked={() => setHeadReady(true)}
          />
        )}
        <img className="sp-helmet" data-on={helmet ? "true" : "false"} src={SPACE_HELMET} alt="" aria-hidden="true" />
        <button
          type="button"
          className="sp-push"
          aria-pressed={helmet}
          aria-label={helmet ? "Take Nova's helmet off" : "Put Nova's helmet on"}
          onClick={() => setHelmet((h) => !h)}
        >
          <span aria-hidden="true">
            PUSH
            <br />
            ME
          </span>
        </button>
      </div>
      {bar}
      <div className="sp-hero-copy">
        <p className="sp-eyebrow">{eyebrow}</p>
        <h1 id="sp-hello" className="sp-hello">
          <span>{title}</span> <span>I'm Nova</span>
          <span className="sp-script sp-hello-accent" aria-hidden="true">
            Nova
          </span>
        </h1>
        <p className="sp-sub">{line}</p>
      </div>
    </section>
  );
};

// The little astronaut bouncing through a coral world.
const AstronautHero: React.FC<HeroProps> = ({ eyebrow, title, line, playing, bar }) => (
  <section className="sp-home-hero" aria-labelledby="sp-astro-title">
    <SpaceMedia clip={SPACE_ASTRONAUT} playing={playing} className="sp-home-media" />
    <div className="sp-home-veil" aria-hidden="true" />
    {bar}
    <div className="sp-wrap sp-home-copy">
      <p className="sp-eyebrow">{eyebrow}</p>
      <h1 id="sp-astro-title" className="sp-home-title">
        {title}
      </h1>
      <span className="sp-script sp-home-accent" aria-hidden="true">
        little steps
      </span>
      <p className="sp-sub sp-home-line">{line}</p>
    </div>
  </section>
);

const Chevron = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

// The tools page in the Space theme.
export const SpaceToolsHome: React.FC<ThemeToolsHomeProps> = ({ items, pathFor, eyebrow, backTo, backLabel, picker }) => {
  const [playing, togglePlaying] = usePlaying();
  const bar = <SpaceBar playing={playing} onTogglePlay={togglePlaying} backTo={backTo} backLabel={backLabel} />;
  return (
    <div className="sp" data-playing={playing ? "true" : "false"}>
      <AstronautHero
        eyebrow={eyebrow}
        title="Pick a tool"
        line="One small step at a time. Pick one when you're ready."
        playing={playing}
        bar={bar}
      />

      <section className="sp-tools" aria-labelledby="sp-tools-title">
        <div className="sp-sky" aria-hidden="true" />
        <div className="sp-wrap">
          <div className="sp-tools-head">
            <h2 id="sp-tools-title" className="sp-h2">
              <span className="sp-line">Your</span>
              <span className="sp-line sp-indent">
                <span className="sp-script sp-h2-accent">space</span> tools
              </span>
            </h2>
            {picker}
          </div>
          <ul className="sp-grid">
            {items.map(({ tool, mine }) => (
              <li key={tool.key}>
                <Link to={pathFor(tool.key)} className="sp-card sp-glass">
                  <div className="sp-card-media">
                    <SpaceMedia clip={SPACE_CARD_CLIPS[tool.key]} playing={playing} />
                    <div className="sp-card-bar sp-glass">
                      <span>
                        <span className="sp-card-tag">{mine ? "Your tool" : "More tools"}</span>
                        <span className="sp-card-title">{tool.label}</span>
                      </span>
                      <span className="sp-arrow">
                        <Chevron />
                      </span>
                    </div>
                  </div>
                  <span className="sp-card-blurb">{tool.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <SpaceClosing playing={playing} />
    </div>
  );
};

// A few quiet words over the astronauts gathered together.
export const SpaceClosing: React.FC<{ playing: boolean }> = ({ playing }) => (
  <section className="sp-closing" aria-label={i18n.t("home.kindWords")}>
    <SpaceMedia clip={SPACE_TOGETHER} playing={playing} className="sp-closing-media" />
    <div className="sp-closing-veil" aria-hidden="true" />
    <div className="sp-closing-text">
      <span className="sp-script sp-closing-accent" aria-hidden="true">
        One step at a time
      </span>
      <p className="sp-closing-lines">
        <span className="sp-closing-first"><T k="home.closing1" /></span>
        <span><T k="home.closing2" /></span>
        <span><T k="home.closing3" /></span>
        <span><T k="home.closing4" /></span>
      </p>
    </div>
  </section>
);

// Everything else, as little rockets with the emoji in a porthole.
export const SpaceTiles: React.FC<{ tiles: SpaceTile[]; label: string }> = ({ tiles, label }) => (
  <nav aria-label={label} className="sp-tiles">
    {tiles.map((t, i) => (
      <Link key={t.to} to={t.to} className={`sp-tile sp-tile--${i % 4}`}>
        <span className="sp-rocket">
          <span className="sp-rocket-fin sp-rocket-fin--l" aria-hidden="true" />
          <span className="sp-rocket-fin sp-rocket-fin--r" aria-hidden="true" />
          <span className="sp-rocket-body">
            <span className="sp-rocket-window">
              <span aria-hidden="true" className="sp-tile-emoji">
                {t.emoji}
              </span>
            </span>
          </span>
          <span className="sp-rocket-flame" aria-hidden="true" />
        </span>
        <span className="sp-tile-label">{t.label}</span>
      </Link>
    ))}
  </nav>
);

// The bar's extra buttons, plus Sign out (in this theme's style) when asked.
const withSignOut = (extra: React.ReactNode, onSignOut: (() => void) | undefined, className: string) => (
  <>
    {extra}
    {onSignOut && (
      <button type="button" className={className} onClick={onSignOut}>
        <T k="home.signOut" />
      </button>
    )}
  </>
);

// A child's home or an Individual's dashboard in the Space theme.
export const SpaceHome: React.FC<ThemeHomeProps> = ({ onSignOut, eyebrow, greeting, line, barExtra, picker, tiles, tilesLabel, children }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="sp" data-playing={playing ? "true" : "false"}>
      <NovaHero
        eyebrow={eyebrow}
        title={greeting}
        line={line}
        playing={playing}
        bar={<SpaceBar playing={playing} onTogglePlay={togglePlaying} extra={withSignOut(barExtra, onSignOut, "sp-pill sp-glass")} />}
      />

      <section className="sp-home-body">
        <div className="sp-sky" aria-hidden="true" />
        <div className="sp-wrap">
          <div className="sp-tools-head">
            <h2 className="sp-h2">
              <span className="sp-line">Your</span>
              <span className="sp-line sp-indent">
                <span className="sp-script sp-h2-accent">space</span> today
              </span>
            </h2>
            {picker}
          </div>
          <div className="sp-panel sp-stack">{children}</div>
          <SpaceTiles tiles={tiles} label={tilesLabel} />
        </div>
      </section>

      <SpaceClosing playing={playing} />
    </div>
  );
};

// A page in the Space theme (one tool, routines, journal, music...): the sky
// and glass around it, the page itself on a light panel so it reads as
// clearly as everywhere else.
export const SpaceToolFrame: React.FC<ThemeFrameProps> = ({ eyebrow, title, subtitle, backTo, backLabel, actions, children }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="sp sp-page" data-playing={playing ? "true" : "false"}>
      <div className="sp-page-sky" aria-hidden="true">
        <img src={SPACE_PLATE} alt="" />
        <div className="sp-sky" />
      </div>
      <SpaceBar playing={playing} onTogglePlay={togglePlaying} backTo={backTo} backLabel={backLabel} />
      <main className="sp-wrap sp-tool-main">
        <div className="sp-page-head">
          <div>
            <p className="sp-eyebrow">{eyebrow}</p>
            <h1 className="sp-h1">{title}</h1>
            {subtitle && <p className="sp-sub">{subtitle}</p>}
          </div>
          {actions && <div className="sp-page-actions">{actions}</div>}
        </div>
        <div className="sp-panel sp-stack">{children}</div>
      </main>
    </div>
  );
};
