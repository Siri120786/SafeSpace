import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ThemeFrameProps, ThemeHomeProps, ThemeTile, ThemeToolsHomeProps } from "../kitTypes";
import { ANIMALS_CARD_CLIPS, ANIMALS_DANCE, ANIMALS_FLOWERS, ANIMALS_FOREST, type AnimalClip } from "./media";
import { startBee, startRusty, type CritterScene } from "./critters";

// The Animals theme for people with the ADHD or autism module. Home and
// dashboard: Rusty the fox in an autumn forest says hello, with a little
// word about today in a bubble; the day sits on a light panel, every page
// as a tile. The tools page: soft lavender light and dewy flowers, a bee
// that rests by the greeting, and the tools as cards with a frog, a hippo, a
// cat and a polar bear cub. Both end with the cub dancing behind a few kind
// words. Other pages: warm cream around a light panel.
// It always opens still. Only when the person presses Play do the clips
// play (slowly, with no sound), Rusty float and the bee fly from part to
// part of the page as it scrolls; the same button keeps it still again.
// Low-sensory mode never reaches here (it always shows the calm look).

export const ANIMALS_PLAYBACK_RATE = 0.6;

// Letters a second for Rusty's bubble, typed only while playing.
export const BUBBLE_LETTERS_PER_SECOND = 14;

const usePlaying = () => {
  const [playing, setPlaying] = useState(false);
  return [playing, () => setPlaying((p) => !p)] as const;
};

const Paw: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <ellipse cx="12" cy="16" rx="5" ry="4.2" />
    <circle cx="6" cy="10" r="2.2" />
    <circle cx="10" cy="6.6" r="2.2" />
    <circle cx="14" cy="6.6" r="2.2" />
    <circle cx="18" cy="10" r="2.2" />
  </svg>
);

interface BarProps {
  playing: boolean;
  onTogglePlay: () => void;
  backTo?: string;
  backLabel?: string;
  extra?: React.ReactNode;
}

const AnimalsBar: React.FC<BarProps> = ({ playing, onTogglePlay, backTo, backLabel, extra }) => (
  <header className="an-bar">
    <span className="an-brand">
      <span className="an-brand-logo">
        <Paw />
      </span>
      <span className="an-brand-name">SafeSpace</span>
    </span>
    <div className="an-bar-actions">
      <button type="button" className="an-pill" aria-pressed={playing} onClick={onTogglePlay}>
        <span aria-hidden="true" className="an-pill-icon">{playing ? "❚❚" : "▶"}</span>
        {playing ? "Keep it still" : "Play"}
      </button>
      {backTo && (
        <Link to={backTo} className="an-pill">
          {backLabel}
        </Link>
      )}
      {extra}
    </div>
  </header>
);

// A still picture, with its clip laid over it (slowly, silently) while
// playing. Without a clip the picture bobs gently instead.
const AnimalMedia: React.FC<{ clip: AnimalClip; playing: boolean; className?: string }> = ({ clip, playing, className = "" }) => {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!playing || !v) return;
    v.playbackRate = ANIMALS_PLAYBACK_RATE;
    v.play().catch(() => undefined);
  }, [playing]);
  return (
    <div className={`an-media ${className}`.trim()} data-bob={!clip.loop && playing ? "true" : "false"} aria-hidden="true">
      <img src={clip.still} alt="" loading="lazy" />
      {playing && clip.loop && (
        <video
          ref={video}
          src={clip.loop}
          muted
          loop
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => {
            e.currentTarget.playbackRate = ANIMALS_PLAYBACK_RATE;
          }}
        />
      )}
    </div>
  );
};

// Starts a 3D friend once the page is on screen, and tells it when to move.
function useCritter(
  start: (canvas: HTMLCanvasElement) => Promise<CritterScene | null>,
  canvas: React.RefObject<HTMLCanvasElement>,
  playing: boolean,
) {
  const scene = useRef<CritterScene | null>(null);
  const [ready, setReady] = useState(false);
  const playingNow = useRef(playing);
  playingNow.current = playing;
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    let live = true;
    start(c).then((s) => {
      if (!live) {
        s?.dispose();
        return;
      }
      scene.current = s;
      if (s) {
        s.setPlaying(playingNow.current);
        setReady(true);
      }
    });
    return () => {
      live = false;
      scene.current?.dispose();
      scene.current = null;
    };
    // Started once per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    scene.current?.setPlaying(playing);
  }, [playing]);
  return ready;
}

// The bubble's words, typed in while playing; all at once while still.
function useTyped(text: string, playing: boolean): string {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (!playing) {
      setShown(text);
      return;
    }
    let n = 0;
    setShown("");
    const timer = setInterval(() => {
      n += 1;
      setShown(text.slice(0, n));
      if (n >= text.length) clearInterval(timer);
    }, 1000 / BUBBLE_LETTERS_PER_SECOND);
    return () => clearInterval(timer);
  }, [text, playing]);
  return shown;
}

const Closing: React.FC<{ playing: boolean }> = ({ playing }) => (
  <section className="an-closing" aria-label="A few kind words">
    <AnimalMedia clip={ANIMALS_DANCE} playing={playing} className="an-closing-media" />
    <div className="an-closing-veil" aria-hidden="true" />
    <div className="an-closing-text">
      <p className="an-eyebrow">One paw at a time</p>
      <p className="an-closing-lines">
        <span className="an-closing-first">You're not alone.</span>
        <span>Start small.</span>
        <span>Rest when you need to.</span>
        <span>Come back any time.</span>
      </p>
    </div>
  </section>
);

// Every page as a soft paw print, the emoji on its big pad.
const AnimalsTiles: React.FC<{ tiles: ThemeTile[]; label: string }> = ({ tiles, label }) => (
  <nav aria-label={label} className="an-tiles">
    {tiles.map((t, i) => (
      <Link key={t.to} to={t.to} className={`an-tile an-tile--${i % 4}`}>
        <span className="an-paw">
          <span aria-hidden="true" className="an-tile-emoji">
            {t.emoji}
          </span>
        </span>
        <span className="an-tile-label">{t.label}</span>
      </Link>
    ))}
  </nav>
);

// A child's home or an Individual's dashboard in the Animals theme.
export const AnimalsHome: React.FC<ThemeHomeProps> = ({ eyebrow, greeting, line, status, barExtra, picker, tiles, tilesLabel, children }) => {
  const [playing, togglePlaying] = usePlaying();
  const hero = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ready = useCritter((c) => startRusty(c, { pointerTarget: hero.current ?? c }), canvas, playing);
  const said = useTyped(status ?? "", playing);
  return (
    <div className="an an-home" data-playing={playing ? "true" : "false"}>
      <section ref={hero} className="an-hero" aria-labelledby="an-hello">
        <AnimalMedia clip={ANIMALS_FOREST} playing={playing} className="an-hero-media" />
        <div className="an-shade" aria-hidden="true" />
        <canvas ref={canvas} className="an-rusty" data-ready={ready ? "true" : "false"} aria-hidden="true" />
        <AnimalsBar playing={playing} onTogglePlay={togglePlaying} extra={barExtra} />
        {status && ready && (
          <p className="an-bubble">
            <span className="an-bubble-name">Rusty</span>
            <span aria-hidden="true">{said}</span>
            <span className="an-sr">{status}</span>
          </p>
        )}
        <div className="an-hero-copy">
          <p className="an-eyebrow an-eyebrow--light">{eyebrow}</p>
          <h1 id="an-hello" className="an-hello">
            <span>{greeting}</span>
            <span className="an-u an-indent">I'm Rusty</span>
          </h1>
          <p className="an-hero-line">{line}</p>
        </div>
      </section>

      <section className="an-body">
        <div className="an-wrap">
          <div className="an-head">
            <h2 className="an-h2">
              Your day<span className="an-dot">.</span>
            </h2>
            {picker}
          </div>
          <div className="an-panel an-stack">{children}</div>
          <AnimalsTiles tiles={tiles} label={tilesLabel} />
        </div>
      </section>

      <Closing playing={playing} />
    </div>
  );
};

const Chevron = () => (
  <svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M3 1l4 4-4 4" />
  </svg>
);

// The tools page in the Animals theme.
export const AnimalsToolsHome: React.FC<ThemeToolsHomeProps> = ({ items, pathFor, eyebrow, backTo, backLabel, picker }) => {
  const [playing, togglePlaying] = usePlaying();
  const page = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ready = useCritter(
    (c) =>
      startBee(c, {
        sections: () => Array.from(page.current?.querySelectorAll<HTMLElement>("[data-bee-stop]") ?? []),
        pointerTarget: page.current ?? c,
      }),
    canvas,
    playing,
  );
  return (
    <div ref={page} className="an an-tools" data-playing={playing ? "true" : "false"}>
      <canvas ref={canvas} className="an-bee" data-ready={ready ? "true" : "false"} aria-hidden="true" />

      <section className="an-meadow" data-bee-stop aria-labelledby="an-tools-title">
        <img className="an-flower an-flower--cosmos" src={ANIMALS_FLOWERS.cosmos} alt="" />
        <AnimalsBar playing={playing} onTogglePlay={togglePlaying} backTo={backTo} backLabel={backLabel} />
        <div className="an-meadow-copy">
          <p className="an-eyebrow">{eyebrow}</p>
          <h1 id="an-tools-title" className="an-big">
            <span>Pick a tool</span>
            <span>when you're ready</span>
          </h1>
        </div>
        <div className="an-meadow-side">
          <p>Small steps, kind breaks and a calm countdown. Your tools are waiting below.</p>
          <a className="an-join" href="#an-tools-list">
            <i>
              <Chevron />
            </i>
            See my tools
          </a>
        </div>
      </section>

      <section id="an-tools-list" className="an-cards" data-bee-stop aria-labelledby="an-cards-title">
        <img className="an-flower an-flower--hanging" src={ANIMALS_FLOWERS.hanging} alt="" />
        <img className="an-flower an-flower--iris" src={ANIMALS_FLOWERS.iris} alt="" />
        <div className="an-wrap">
          <div className="an-head">
            <div>
              <p className="an-num" aria-hidden="true">
                01
              </p>
              <h2 id="an-cards-title" className="an-h2 an-h2--light">
                Your tools
              </h2>
            </div>
            {picker}
          </div>
          <ul className="an-grid">
            {items.map(({ tool, mine }) => (
              <li key={tool.key}>
                <Link to={pathFor(tool.key)} className="an-card">
                  <div className="an-card-media">
                    <AnimalMedia clip={ANIMALS_CARD_CLIPS[tool.key]} playing={playing} />
                  </div>
                  <span className="an-card-tag">{mine ? "Your tool" : "More tools"}</span>
                  <span className="an-card-title">
                    {tool.label}
                    <i aria-hidden="true">
                      <Chevron />
                    </i>
                  </span>
                  <span className="an-card-blurb">{tool.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div data-bee-stop>
        <Closing playing={playing} />
      </div>
    </div>
  );
};

// A page in the Animals theme (one tool, routines, journal, music...): warm
// cream and the forest's light around it, the page itself on a light panel.
export const AnimalsFrame: React.FC<ThemeFrameProps> = ({ eyebrow, title, subtitle, backTo, backLabel, actions, children }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="an an-page" data-playing={playing ? "true" : "false"}>
      <div className="an-page-light" aria-hidden="true">
        <AnimalMedia clip={ANIMALS_FOREST} playing={playing} />
      </div>
      <AnimalsBar playing={playing} onTogglePlay={togglePlaying} backTo={backTo} backLabel={backLabel} />
      <main className="an-wrap an-page-main">
        <div className="an-page-head">
          <div>
            <p className="an-eyebrow">{eyebrow}</p>
            <h1 className="an-h1">{title}</h1>
            {subtitle && <p className="an-sub">{subtitle}</p>}
          </div>
          {actions && <div className="an-page-actions">{actions}</div>}
        </div>
        <div className="an-panel an-stack">{children}</div>
      </main>
    </div>
  );
};
