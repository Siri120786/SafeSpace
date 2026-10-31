import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isExitKey } from "../../../calm-tools/lib/lowSensory";
import { CARE_BRIDGING_TEXT, RELAXATION_STEPS, REVIEW_NOTICE, SUPPORT_TEXT } from "../../../wellness-modules/lib/content";
import { CalmPlanCard, HarborTopics, Toolkit } from "./HarborParts";
import { useOptionalMusicPlayer } from "../../../music";
import { SOFT_SYMPHONY, findTrack } from "../../../music/catalog";

// Safe Harbor (the PTSD module): a quiet room at blue hour, rain on the
// window and the city blurred beyond it (the "murmur" plate and loop from the
// design brief). It always opens still: nothing moves and there is no sound.
// Only if the person asks does the rain start to fall (a muted loop and a
// soft glow over the city lights); low-sensory mode never offers it. The
// brief's passing light sweep is left out on purpose: a sudden moving light
// can startle.

export const HARBOR_PLATE =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/7a7598ba-a6f8-42b4-ac39-98279dac4192.jpg";
export const HARBOR_LOOP =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/d41b8c1d-f175-43b3-af22-7081133aa8de.mp4";

interface HarborPageProps {
  lowSensory: boolean;
  onExit: () => void;
  notice?: string | null;
  // Where the grounding exercise lives (Calm Space, for adults or children).
  groundingPath: string;
  // A child's Safe Harbor: the tools and the calm plan, without the adult
  // learning topics.
  forChild?: boolean;
}

// A quiet line of bars that fills as the steps go by (the brief's waveform,
// standing still): a gentle swell, coloured blue to violet.
const BARS = Array.from({ length: 62 }, (_, i) => {
  const t = i / 61;
  const swell = 0.28 + 0.5 * Math.exp(-((t - 0.25) ** 2) / 0.004) + 0.22 * Math.exp(-((t - 0.33) ** 2) / 0.002) + 0.2 * Math.exp(-((t - 0.68) ** 2) / 0.003);
  const quiet = 0.18 + 0.1 * Math.abs(Math.sin(i * 1.7));
  return Math.min(1, Math.max(quiet, swell));
});

export const HarborPage: React.FC<HarborPageProps> = ({ lowSensory, onExit, notice, groundingPath, forChild = false }) => {
  const [step, setStep] = useState(0);
  // Always starts still; never remembered between visits.
  const [rain, setRain] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const raining = rain && !lowSensory;
  const last = step === RELAXATION_STEPS.length - 1;
  // The round button plays the soft symphony, only when tapped (the same
  // player as the Music page, so it keeps going with the mini player). Not
  // offered when a caregiver has turned a child's music off.
  const player = useOptionalMusicPlayer();
  const symphony = findTrack(SOFT_SYMPHONY.id);
  const canPlay = !!player && !!symphony && player.supported && !player.musicOff;
  const isSymphony = player?.nowPlaying?.track.id === SOFT_SYMPHONY.id;
  const musicOn = !!(isSymphony && player?.nowPlaying?.playing);
  const toggleMusic = () => {
    if (!player || !symphony) return;
    if (isSymphony) player.togglePlay();
    else player.playPlaylist(symphony.playlist, symphony.playlist.tracks.indexOf(symphony.track));
  };
  const filled = Math.round(((step + 1) / RELAXATION_STEPS.length) * BARS.length);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isExitKey(e.key)) onExit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExit]);

  useEffect(() => {
    // A play interrupted by the video still loading is harmless (it plays
    // once ready); only a refusal from the browser turns the rain off.
    if (raining)
      video.current?.play().catch((e: unknown) => {
        if ((e as { name?: string })?.name === "NotAllowedError") setRain(false);
      });
  }, [raining]);

  return (
    <div className="hb" data-still={raining ? "false" : "true"} data-music={musicOn && !lowSensory ? "on" : "off"}>
      <div className="hb-scene" aria-hidden="true">
        <div className="hb-plate">
          <img src={HARBOR_PLATE} alt="" />
          {raining && <video ref={video} src={HARBOR_LOOP} muted loop playsInline preload="auto" onCanPlay={(e) => void e.currentTarget.play().catch(() => undefined)} />}
          <div className="hb-bloom" />
        </div>
        <div className="hb-veil" />
      </div>

      <header className="hb-bar">
        <span className="hb-mark hb-serif">SafeSpace</span>
        <div className="hb-bar-actions">
          {!lowSensory && (
            <button type="button" className="hb-pill" aria-pressed={raining} onClick={() => setRain((r) => !r)}>
              {raining ? "Keep it still" : "Let the rain fall"}
            </button>
          )}
          <button type="button" className="hb-pill" onClick={onExit} aria-label="Exit Safe Harbor and return home">
            Exit
          </button>
        </div>
      </header>

      <main className="hb-main">
        <h1 className="hb-title hb-serif">Safe Harbor</h1>
        <p className="hb-sub">A quiet place to rest</p>
        <p className="hb-label hb-mono">{raining ? "THE RAIN STAYS OUTSIDE" : "NOTHING MOVES UNLESS YOU ASK"}</p>

        {notice && (
          <p role="status" className="hb-notice">
            {notice}
          </p>
        )}

        <div className="hb-split">
        <div className="hb-left">
        <section className="hb-card" aria-labelledby="hb-step-title">
          <div className="hb-cover">
            <img src={HARBOR_PLATE} alt="" />
            <span className="hb-cover-num hb-serif" aria-hidden="true">
              {step + 1}
            </span>
          </div>
          <div className="hb-card-body">
            <p className="hb-date hb-mono">
              Relaxation, step {step + 1} of {RELAXATION_STEPS.length}
            </p>
            <p id="hb-step-title" role="status" aria-live="polite" className="hb-step">
              {RELAXATION_STEPS[step]}
            </p>
            <div className="hb-wave" aria-hidden="true">
              {BARS.map((h, i) => (
                <i key={i} data-on={i < filled ? "true" : "false"} style={{ height: `${Math.round(h * 100)}%`, ["--d" as string]: `${(i % 9) * 0.18}s` }} />
              ))}
            </div>
            <div className="hb-controls">
              <div className="hb-steps-nav">
                <button type="button" className="hb-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
                  Back
                </button>
                {last ? (
                  <button type="button" className="hb-ghost" onClick={() => setStep(0)}>
                    Start again
                  </button>
                ) : (
                  <button type="button" className="hb-ghost" onClick={() => setStep(step + 1)}>
                    Next
                  </button>
                )}
              </div>
              {canPlay && (
                <div className="hb-music">
                  <span className="hb-music-label hb-mono">{musicOn ? "SOFT SYMPHONY" : "PLAY SOFT MUSIC"}</span>
                  <button
                    type="button"
                    className="hb-play"
                    aria-pressed={musicOn}
                    aria-label={musicOn ? "Pause the soft symphony" : "Play the soft symphony"}
                    onClick={toggleMusic}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {musicOn ? <path d="M8 6h3v12H8zM13 6h3v12h-3z" /> : <path d="M9 6l7 6-7 6z" />}
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="hb-about" aria-labelledby="hb-about-title">
          <h2 id="hb-about-title" className="hb-kicker hb-mono">
            ABOUT THIS SPACE
          </h2>
          <p className="hb-mono">
            This is a quiet space. Nothing moves and there is no sound unless you choose: the round button plays a soft symphony if you'd like music. Go at your own pace, skip any step, and leave whenever you like.
          </p>
        </section>
        </div>
        <Toolkit lowSensory={lowSensory} forChild={forChild} />
        </div>

        <CalmPlanCard forChild={forChild} />

        <HarborTopics forChild={forChild} />

        <div className="hb-split hb-split-even">

        <section className="hb-about" aria-labelledby="hb-next-title">
          <h2 id="hb-next-title" className="hb-kicker hb-mono">
            WHEN YOU'RE READY
          </h2>
          <Link to={groundingPath} className="hb-link">
            More calm exercises in Calm Space
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </section>

        <section className="hb-about" aria-labelledby="hb-people-title">
          <h2 id="hb-people-title" className="hb-kicker hb-mono">
            SUPPORT FROM PEOPLE
          </h2>
          <p className="hb-mono">{CARE_BRIDGING_TEXT}</p>
        </section>
        </div>

        <footer className="hb-foot hb-mono">
          <p role="note">{REVIEW_NOTICE} Your entries stay on this page only and are not saved yet. This is not treatment.</p>
          <p>{SUPPORT_TEXT}</p>
          <p>PRESS ESCAPE AT ANY TIME TO LEAVE</p>
        </footer>
      </main>
    </div>
  );
};

export default HarborPage;
