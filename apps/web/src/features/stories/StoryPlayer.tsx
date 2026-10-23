import React, { useCallback, useEffect, useRef, useState } from "react";
import { hasVoiceFor, langTag, speakWarm, stopReading } from "../speech";
import { StoryBackdrop, FLOOR_Y, STAGE_H, STAGE_W } from "./art/Backgrounds";
import { CHARACTER_SCALE, StoryCharacter, faceHeight, type MouthMode } from "./art/Characters";
import {
  SHOT_SCALE,
  SLOT_X,
  SPEAKER_LEAN,
  facesLeft,
  frameAround,
  lineDurationMs,
  lookTowards,
  speakerLabel,
  type Story,
  type StoryLang,
  type StoryScene,
} from "./storyScript";
import "./stories.css";

const SCENE_INTRO_MS = 1100;   // let characters arrive before the first line
const LINE_GAP_MS = 450;
const WORD_MOUTH_MS = 170;     // how long the mouth stays open per spoken word

interface Props {
  story: Story;
  lowSensory: boolean;
  onExit?: () => void;
}

type Phase = "ready" | "playing" | "paused" | "scene-end" | "finished";

// Plays a story scene by scene: the picture animates (camera, walking,
// looking at whoever speaks, mouths in time with the words), each line is
// shown as a subtitle and read in the warm voice when the device has one for
// the language, and the child decides when to go on. Nothing is generated or
// downloaded while it plays.
export const StoryPlayer: React.FC<Props> = ({ story, lowSensory, onExit }) => {
  const [lang, setLang] = useState<StoryLang>("en");
  const [voiceOn, setVoiceOn] = useState(true);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [lineIdx, setLineIdx] = useState(-1); // -1: the scene's intro, before the first line
  const [phase, setPhase] = useState<Phase>("ready");
  const [sceneRun, setSceneRun] = useState(0); // bumps to restart a scene's animations
  const [wordOpen, setWordOpen] = useState<boolean | null>(null); // null: no word timing from the browser
  const token = useRef(0);
  const wordTimer = useRef<ReturnType<typeof setTimeout>>();

  const scene: StoryScene = story.scenes[sceneIdx];
  const line = lineIdx >= 0 ? scene.lines[lineIdx] : null;
  const last = sceneIdx === story.scenes.length - 1;
  const voiceAvailable = hasVoiceFor(langTag(lang));
  const speaking = voiceOn && voiceAvailable;

  const stopAll = useCallback(() => {
    token.current++;
    stopReading();
    if (wordTimer.current) clearTimeout(wordTimer.current);
    setWordOpen(null);
  }, []);

  useEffect(() => stopAll, [stopAll]);

  // Advance through the scene's lines while playing.
  useEffect(() => {
    if (phase !== "playing") return;
    const my = ++token.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const next = () => {
      if (token.current !== my) return;
      setWordOpen(null);
      setLineIdx((i) => i + 1);
    };
    if (lineIdx === -1) {
      timer = setTimeout(next, SCENE_INTRO_MS);
    } else if (lineIdx >= scene.lines.length) {
      setPhase(last ? "finished" : "scene-end");
    } else {
      const text = scene.lines[lineIdx][lang];
      let moved = false;
      const moveOn = (delay: number) => {
        if (moved || token.current !== my) return;
        moved = true;
        if (timer) clearTimeout(timer);
        timer = setTimeout(next, delay);
      };
      // Each spoken word opens the mouth briefly.
      const onWord = () => {
        if (token.current !== my) return;
        setWordOpen(true);
        if (wordTimer.current) clearTimeout(wordTimer.current);
        wordTimer.current = setTimeout(() => token.current === my && setWordOpen(false), WORD_MOUTH_MS);
      };
      const spoke = speaking && speakWarm(text, langTag(lang), () => moveOn(LINE_GAP_MS), onWord);
      // Without a voice the words stay up for a reading time. With one, a
      // safety timer still moves on if the browser never says speech ended.
      timer = setTimeout(() => moveOn(0), spoke ? lineDurationMs(text) * 2 + 3000 : lineDurationMs(text) + LINE_GAP_MS);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [phase, lineIdx, sceneIdx, lang, speaking, scene, last]);

  const goTo = (i: number) => {
    stopAll();
    setSceneIdx(i);
    setLineIdx(-1);
    setSceneRun((r) => r + 1);
    setPhase("playing");
  };

  const play = () => {
    if (phase === "finished") return goTo(0);
    if (phase === "scene-end") return goTo(sceneIdx + 1);
    if (phase === "ready") return goTo(0);
    setPhase("playing"); // resume: the current line starts again
  };
  const pause = () => {
    stopAll();
    setPhase("paused");
  };

  const playing = phase === "playing";
  const sceneDone = phase === "scene-end" || phase === "finished";
  const speakerId = playing && line && line.speaker !== "narrator" ? line.speaker : null;
  const speakerSlot = speakerId ? scene.cast.find((c) => c.id === speakerId)?.slot ?? null : null;
  const mouth: MouthMode = wordOpen === null ? "anim" : wordOpen ? "open" : "closed";
  const subtitleLine = line ?? (sceneDone ? scene.lines[scene.lines.length - 1] : null);

  // The camera: the scene's shot, or in a wide shot a gentle lean towards the speaker.
  const shot = scene.camera?.shot ?? "wide";
  const focusMember = scene.camera?.focus ? scene.cast.find((c) => c.id === scene.camera?.focus) : undefined;
  const leanMember = shot === "wide" && !lowSensory && speakerId ? scene.cast.find((c) => c.id === speakerId) : undefined;
  const target = shot !== "wide" ? focusMember : leanMember;
  const view = target
    ? frameAround(
        SLOT_X[target.slot],
        FLOOR_Y - faceHeight(target.id, target.pose ?? "stand") + (shot === "close" ? 40 : 160),
        shot === "wide" ? SPEAKER_LEAN : SHOT_SCALE[shot],
        STAGE_W,
        STAGE_H,
      )
    : { scale: 1, x: 0, y: 0 };

  const btn = "rounded-full px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-botanical-700 disabled:opacity-40";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Language" className="inline-flex rounded-full border border-black/10 bg-white p-1">
          {(["en", "te"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => {
                stopAll();
                setLang(l);
              }}
              className={`rounded-full px-3 py-1 text-sm font-semibold ${lang === l ? "bg-botanical-700 text-white" : "text-charcoal"}`}
            >
              {l === "en" ? "English" : "తెలుగు"}
            </button>
          ))}
        </div>
        <label className="mt-0 flex items-center gap-2 text-sm font-semibold text-charcoal">
          <input type="checkbox" checked={voiceOn} onChange={(e) => { stopAll(); setVoiceOn(e.target.checked); }} className="h-5 w-5 accent-botanical-700" />
          Read aloud
        </label>
      </div>

      <div className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-card">
        <svg
          key={`${sceneIdx}-${sceneRun}`}
          viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
          className={`block w-full h-auto ${lowSensory ? "st-still" : ""}`}
          role="img"
          aria-label={`${story.title[lang]}, part ${sceneIdx + 1} of ${story.scenes.length}`}
        >
          <g className="st-scene-in">
            <g
              style={{
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                transformOrigin: "0 0",
                transition: lowSensory ? undefined : "transform 1.4s ease-in-out",
              }}
            >
              <StoryBackdrop id={scene.background} />
              {scene.cast.map((c) => {
                const x = SLOT_X[c.slot];
                const left = facesLeft(c.slot);
                const talking = speakerId === c.id;
                // Listeners look at the speaker; the speaker looks ahead.
                const screenLook = talking ? 0 : lookTowards(c.slot, speakerSlot);
                const look = (left ? -screenLook : screenLook) as -1 | 0 | 1;
                const walkingIn = c.action === "walk_in" && lineIdx === -1 && playing;
                const walkingOut = c.action === "walk_out" && sceneDone;
                const action = c.action === "walk_in" || c.action === "walk_out" ? "idle" : c.action ?? "idle";
                const s = CHARACTER_SCALE[c.id];
                return (
                  <g key={c.id} transform={`translate(${x} ${FLOOR_Y})`}>
                    <g className={lowSensory ? undefined : c.action === "walk_in" ? "st-walk-in" : walkingOut ? "st-walk-out" : undefined}>
                      <ellipse cx={0} cy={6} rx={c.id === "pip" ? 50 : 80} ry={16} fill={talking ? "#F6C945" : "#000"} opacity={talking ? 0.55 : 0.12} />
                      <g transform={`scale(${left ? -s : s} ${s})`}>
                        <StoryCharacter
                          id={c.id}
                          scale={s}
                          expression={c.expression ?? "calm"}
                          action={action}
                          pose={c.pose ?? "stand"}
                          holding={c.holding}
                          talking={talking}
                          mouth={mouth}
                          look={look}
                          walking={!lowSensory && (walkingIn || walkingOut)}
                        />
                      </g>
                    </g>
                  </g>
                );
              })}
            </g>
            <SceneEffect effect={scene.effect ?? "none"} lang={lang} />
          </g>
        </svg>

        <div aria-live="polite" className="min-h-[5.5rem] border-t border-black/5 px-5 py-3 text-center">
          {subtitleLine ? (
            <>
              {speakerLabel(subtitleLine, lang) && (
                <p className="text-xs font-bold uppercase tracking-wider text-botanical-800">{speakerLabel(subtitleLine, lang)}</p>
              )}
              <p className="font-display text-xl sm:text-2xl font-bold text-charcoal">{subtitleLine[lang]}</p>
            </>
          ) : (
            <p className="font-display text-xl font-bold text-charcoal">{story.title[lang]}</p>
          )}
        </div>
      </div>

      {voiceOn && !voiceAvailable && (
        <p className="text-xs text-charcoal/70">
          This device has no {lang === "te" ? "Telugu" : "English"} voice, so the story shows the words without reading them.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-charcoal/70">
          {phase === "finished" ? "The end" : `Part ${sceneIdx + 1} of ${story.scenes.length}`}
        </span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${btn} bg-white border border-black/10 text-charcoal`} disabled={sceneIdx === 0} onClick={() => goTo(sceneIdx - 1)}>
            ⏮ Back
          </button>
          <button type="button" className={`${btn} bg-white border border-black/10 text-charcoal`} disabled={phase === "ready"} onClick={() => goTo(sceneIdx)}>
            🔁 Again
          </button>
          {playing ? (
            <button type="button" className={`${btn} bg-charcoal text-white`} onClick={pause}>⏸ Pause</button>
          ) : (
            <button type="button" className={`${btn} bg-botanical-700 text-white`} onClick={play}>
              {phase === "ready" ? "▶ Start" : phase === "scene-end" ? "Next ⏭" : phase === "finished" ? "▶ Watch again" : "▶ Play"}
            </button>
          )}
        </div>
      </div>

      {phase === "finished" && onExit && (
        <button type="button" onClick={onExit} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-charcoal">
          Back to stories
        </button>
      )}
    </div>
  );
};

// Calm overlays drawn above the scene (they don't move with the camera).
const SceneEffect: React.FC<{ effect: "none" | "sparkles" | "breathing"; lang: StoryLang }> = ({ effect, lang }) => {
  if (effect === "sparkles") {
    const spots = [[220, 160], [480, 90], [760, 140], [1040, 80], [1320, 170], [1450, 330], [140, 380], [1180, 300]];
    return (
      <g aria-hidden="true">
        {spots.map(([x, y], i) => (
          <path
            key={i}
            className="st-sparkle"
            style={{ animationDelay: `${(i % 4) * 0.5}s` }}
            transform={`translate(${x} ${y}) scale(${1.4 + (i % 3) * 0.4})`}
            d="M0 -16 L4 -4 L16 0 L4 4 L0 16 L-4 4 L-16 0 L-4 -4 Z"
            fill="#F6C945"
          />
        ))}
      </g>
    );
  }
  if (effect === "breathing") {
    const words = lang === "te"
      ? { in: "శ్వాస లోపలికి…", out: "బయటికి…", still: "నెమ్మదిగా శ్వాస" }
      : { in: "Breathe in…", out: "Breathe out…", still: "Breathe slowly" };
    return (
      <g aria-hidden="true" transform="translate(1340 190)">
        <circle className="st-breath-circle" r={120} fill="#9CC7F0" opacity={0.45} />
        <circle r={36} fill="#FFFFFF" opacity={0.8} />
        <g fontSize={34} fontWeight={700} fill="#2B1D17" textAnchor="middle">
          <text className="st-breath-in" y={170}>{words.in}</text>
          <text className="st-breath-out" y={170}>{words.out}</text>
          <text className="st-breath-still" y={170}>{words.still}</text>
        </g>
      </g>
    );
  }
  return null;
};
