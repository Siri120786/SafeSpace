import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ThemeFrameProps, ThemeHomeProps, ThemeTile, ThemeToolsHomeProps } from "../kitTypes";
import { OCEAN_CARD_CLIPS, OCEAN_CAVE, OCEAN_SUNFLOOR, type OceanClip } from "./media";
import type { OceanScene } from "../../conditions/anxiety/ocean/oceanScene";

// The Ocean theme for people with the ADHD or autism module. Home and
// dashboard: calm deep water; on Play, Aurelia's glowing jellyfish (the same
// as Calm Space) drift in. The tools page: a quiet sea cave where a shaft of
// light falls through a square opening and orange fish swim in it, the tools
// as glass cards cut from the same cave. Both end over the sunlit floor.
// Other pages: deep water around a light panel.
// Every change of colour fades into the next (each part starts on the
// colour the one before it ends on), so there are no lines between parts.
// It always opens still. Only on Play do the clips play (slowly, no sound)
// and the jellyfish come; the same button keeps it still again. Low-sensory
// mode never reaches here (it always shows the calm look).

export const OCEAN_PLAYBACK_RATE = 0.6;

const usePlaying = () => {
  const [playing, setPlaying] = useState(false);
  return [playing, () => setPlaying((p) => !p)] as const;
};

interface BarProps {
  playing: boolean;
  onTogglePlay: () => void;
  backTo?: string;
  backLabel?: string;
  extra?: React.ReactNode;
}

const OceanBar: React.FC<BarProps> = ({ playing, onTogglePlay, backTo, backLabel, extra }) => (
  <header className="ow-bar">
    <span className="ow-mark">SafeSpace</span>
    <div className="ow-bar-actions">
      <button type="button" className="ow-btn ow-btn--glass" aria-pressed={playing} onClick={onTogglePlay}>
        <span aria-hidden="true" className="ow-btn-icon">{playing ? "❚❚" : "▶"}</span>
        {playing ? "Keep it still" : "Play"}
      </button>
      {backTo && (
        <Link to={backTo} className="ow-btn ow-btn--glass">
          {backLabel}
        </Link>
      )}
      {extra}
    </div>
  </header>
);

// A still picture, with its clip laid over it (slowly, silently) while playing.
const OceanMedia: React.FC<{ clip: OceanClip; playing: boolean; className?: string }> = ({ clip, playing, className = "" }) => {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!playing || !v) return;
    v.playbackRate = OCEAN_PLAYBACK_RATE;
    v.play().catch(() => undefined);
  }, [playing]);
  return (
    <div className={`ow-media ${className}`.trim()} aria-hidden="true">
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
            e.currentTarget.playbackRate = OCEAN_PLAYBACK_RATE;
          }}
        />
      )}
    </div>
  );
};

// Aurelia's jellyfish, loaded only once the person first presses Play; Keep
// it still freezes them where they are. Where WebGPU isn't available the
// still water stays.
function useJellyfish(host: React.RefObject<HTMLDivElement>, pointer: React.RefObject<HTMLElement>, playing: boolean) {
  const scene = useRef<OceanScene | null>(null);
  const started = useRef(false);
  const [ready, setReady] = useState(false);
  const playingNow = useRef(playing);
  playingNow.current = playing;
  useEffect(() => {
    if (!playing || started.current || !host.current) return;
    started.current = true;
    let live = true;
    import("../../conditions/anxiety/ocean/oceanScene")
      .then(({ startOcean }) => startOcean(host.current!, { pointerTarget: pointer.current ?? window }))
      .then((s) => {
        if (!live) {
          s?.dispose();
          return;
        }
        scene.current = s;
        if (s) {
          s.setPaused(!playingNow.current);
          setReady(true);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [playing, host, pointer]);
  useEffect(() => {
    scene.current?.setPaused(!playing);
  }, [playing]);
  useEffect(
    () => () => {
      scene.current?.dispose();
      scene.current = null;
    },
    [],
  );
  return ready;
}

const Closing: React.FC<{ playing: boolean }> = ({ playing }) => (
  <section className="ow-closing" aria-label="A few kind words">
    <OceanMedia clip={OCEAN_SUNFLOOR} playing={playing} className="ow-closing-media" />
    <div className="ow-closing-text">
      <p className="ow-badge">Breathe out slowly</p>
      <p className="ow-closing-lines">
        <span className="ow-closing-first">You're not alone.</span>
        <span>Start small.</span>
        <span>Rest when you need to.</span>
        <span>Come back any time.</span>
      </p>
    </div>
  </section>
);

const OceanTiles: React.FC<{ tiles: ThemeTile[]; label: string }> = ({ tiles, label }) => (
  <nav aria-label={label} className="ow-tiles">
    {tiles.map((t) => (
      <Link key={t.to} to={t.to} className="ow-tile">
        <span aria-hidden="true" className="ow-tile-emoji">
          {t.emoji}
        </span>
        <span className="ow-tile-label">{t.label}</span>
      </Link>
    ))}
  </nav>
);

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

// A child's home or an Individual's dashboard in the Ocean theme.
export const OceanHome: React.FC<ThemeHomeProps> = ({ eyebrow, greeting, line, status, barExtra, picker, tiles, tilesLabel, children }) => {
  const [playing, togglePlaying] = usePlaying();
  const hero = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const ready = useJellyfish(host, hero, playing);
  return (
    <div className="ow ow-home" data-playing={playing ? "true" : "false"}>
      <section ref={hero} className="ow-hero ow-hero--water" aria-labelledby="ow-hello">
        <div className="ow-water" aria-hidden="true">
          <div className="oc-still" />
          <div ref={host} className="ow-jelly" data-ready={ready ? "true" : "false"} />
        </div>
        <div className="ow-hero-shade" aria-hidden="true" />
        <OceanBar playing={playing} onTogglePlay={togglePlaying} extra={barExtra} />
        <div className="ow-hero-copy">
          <div>
            <p className="ow-badge">{eyebrow}</p>
            <h1 id="ow-hello" className="ow-title">
              {greeting}
              <br />
              Welcome to calm water.
            </h1>
          </div>
          <div>
            <p className="ow-lead">{line}</p>
            {status && <p className="ow-status">{status}</p>}
          </div>
        </div>
      </section>

      <section className="ow-body">
        <div className="ow-wrap">
          <div className="ow-head">
            <h2 className="ow-h2">Your day</h2>
            {picker}
          </div>
          <div className="ow-panel ow-stack">{children}</div>
          <OceanTiles tiles={tiles} label={tilesLabel} />
        </div>
      </section>

      <Closing playing={playing} />
    </div>
  );
};

// The tools page in the Ocean theme.
export const OceanToolsHome: React.FC<ThemeToolsHomeProps> = ({ items, pathFor, eyebrow, backTo, backLabel, picker }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="ow ow-tools" data-playing={playing ? "true" : "false"}>
      <section className="ow-hero ow-hero--cave" aria-labelledby="ow-tools-title">
        <OceanMedia clip={OCEAN_CAVE} playing={playing} className="ow-cave" />
        <div className="ow-hero-shade" aria-hidden="true" />
        <OceanBar playing={playing} onTogglePlay={togglePlaying} backTo={backTo} backLabel={backLabel} />
        <div className="ow-hero-copy">
          <div>
            <p className="ow-badge">{eyebrow}</p>
            <h1 id="ow-tools-title" className="ow-title">
              Small steps,
              <br />
              in calm water,
              <br />
              one at a time.
            </h1>
          </div>
          <div>
            <p className="ow-lead">Focus, plan, name a feeling or count down gently. Pick a tool when you're ready.</p>
            <a className="ow-btn ow-btn--solid" href="#ow-tools-list">
              See my tools <Arrow />
            </a>
          </div>
        </div>
      </section>

      <section id="ow-tools-list" className="ow-cards" aria-labelledby="ow-cards-title">
        <div className="ow-wrap">
          <div className="ow-head">
            <h2 id="ow-cards-title" className="ow-h2">
              Your tools
            </h2>
            {picker}
          </div>
          <ul className="ow-grid">
            {items.map(({ tool, mine }) => (
              <li key={tool.key}>
                <Link to={pathFor(tool.key)} className="ow-card">
                  <div className="ow-card-media">
                    <OceanMedia clip={OCEAN_CARD_CLIPS[tool.key]} playing={playing} />
                  </div>
                  <span className="ow-card-tag">{mine ? "Your tool" : "More tools"}</span>
                  <span className="ow-card-title">
                    {tool.label}
                    <Arrow />
                  </span>
                  <span className="ow-card-blurb">{tool.blurb}</span>
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

// A page in the Ocean theme (one tool, routines, journal, music...): deep
// water around it, the page itself on a light panel.
export const OceanFrame: React.FC<ThemeFrameProps> = ({ eyebrow, title, subtitle, backTo, backLabel, actions, children }) => {
  const [playing, togglePlaying] = usePlaying();
  return (
    <div className="ow ow-page" data-playing={playing ? "true" : "false"}>
      <div className="ow-page-light" aria-hidden="true">
        <div className="oc-still" />
      </div>
      <OceanBar playing={playing} onTogglePlay={togglePlaying} backTo={backTo} backLabel={backLabel} />
      <main className="ow-wrap ow-page-main">
        <div className="ow-page-head">
          <div>
            <p className="ow-badge">{eyebrow}</p>
            <h1 className="ow-h1">{title}</h1>
            {subtitle && <p className="ow-sub">{subtitle}</p>}
          </div>
          {actions && <div className="ow-page-actions">{actions}</div>}
        </div>
        <div className="ow-panel ow-stack">{children}</div>
      </main>
    </div>
  );
};
