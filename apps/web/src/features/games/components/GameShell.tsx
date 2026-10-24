import React, { useCallback, useEffect, useState } from "react";
import { useGames } from "../GamesContext";
import type { GameId } from "../lib/content";
import { catalog } from "../lib/content";

interface BuddyProps {
  message: string;
  /** Read aloud when read-aloud is on. */
  speak?: boolean;
}

/** Pip the owl: a small friendly voice that cheers and explains. Never scolds. */
export const Buddy: React.FC<BuddyProps> = ({ message, speak = true }) => {
  const { audio, calm, t } = useGames();
  useEffect(() => {
    if (speak && message) audio.speak(message);
  }, [message, speak, audio]);
  return (
    <div className="flex items-start gap-3" data-testid="buddy">
      <span
        aria-hidden="true"
        className={`text-4xl select-none ${calm ? "" : "motion-safe:animate-bounce"}`}
        style={calm ? undefined : { animationDuration: "2.4s" }}
      >
        🦉
      </span>
      <p
        role="status"
        aria-live="polite"
        aria-label={`${t("ui.buddy")}: ${message}`}
        className="rounded-2xl rounded-tl-sm bg-white border border-olive-200 px-4 py-3 text-sm sm:text-base text-textBody shadow-sm"
      >
        {message}
      </p>
    </div>
  );
};

interface ToggleProps {
  on: boolean;
  onLabel: string;
  offLabel: string;
  onIcon: string;
  offIcon: string;
  onChange: (on: boolean) => void;
}

const Toggle: React.FC<ToggleProps> = ({ on, onLabel, offLabel, onIcon, offIcon, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-olive-500 ${
      on ? "bg-deepGreen text-white border-deepGreen" : "bg-white text-textBody border-olive-200"
    }`}
  >
    <span aria-hidden="true">{on ? onIcon : offIcon}</span>
    {on ? onLabel : offLabel}
  </button>
);

interface ShellProps {
  gameId: GameId;
  onExit: () => void;
  /** What "Read to me" speaks (the current prompt). */
  readText?: string;
  children: (ctx: { paused: boolean }) => React.ReactNode;
}

/**
 * Frame for every game: title, pause and exit that are always reachable,
 * sound / read-aloud switches, calm mode and "how to play". Escape pauses.
 */
export const GameShell: React.FC<ShellProps> = ({ gameId, onExit, readText, children }) => {
  const { prefs, setPrefs, audio, calm, t } = useGames();
  const [paused, setPaused] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const info = catalog.games.find((g) => g.id === gameId)!;
  const howKey = { "memory-match": "mm.how", "pattern-quest": "pq.how", "feelings-detective": "fd.how", "imagine-create": "ic.how", "maze-explorer": "mz.how" }[gameId];

  const togglePause = useCallback(() => {
    setPaused((p) => {
      audio.stopSpeaking();
      return !p;
    });
  }, [audio]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") togglePause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause]);

  const pill =
    "inline-flex items-center gap-1.5 rounded-full border border-olive-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-textBody focus:outline-none focus:ring-2 focus:ring-olive-500";

  return (
    <div
      data-low-sensory={calm ? "on" : "off"}
      className={`min-h-screen px-4 py-5 sm:px-6 ${calm ? "bg-[#F4F1EA] [&_*]:!transition-none [&_*]:!animate-none" : "bg-gradient-to-b from-cream to-paleLime"}`}
    >
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl sm:text-3xl text-textHeading">
            <span aria-hidden="true">{info.emoji} </span>
            {t(info.titleKey)}
          </h1>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={pill} onClick={togglePause} aria-label={t("ui.pause")}>
              <span aria-hidden="true">⏸️</span> {t("ui.pause")}
            </button>
            <button type="button" className={pill} onClick={onExit} aria-label={`${t("ui.exit")} ${t(info.titleKey)}`}>
              {t("ui.exit")}
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sound, voice and help">
          <Toggle
            on={prefs.soundEnabled}
            onLabel={t("ui.sound.on")}
            offLabel={t("ui.sound.off")}
            onIcon="🔊"
            offIcon="🔇"
            onChange={(v) => {
              audio.soundEnabled = v;
              setPrefs({ soundEnabled: v });
              audio.unlock();
              if (v) audio.play("tap");
            }}
          />
          <Toggle
            on={prefs.voiceEnabled}
            onLabel={t("ui.voice.on")}
            offLabel={t("ui.voice.off")}
            onIcon="🗣️"
            offIcon="🤐"
            onChange={(v) => {
              audio.voiceEnabled = v;
              setPrefs({ voiceEnabled: v });
              if (v) audio.speak(t("ui.voice.on"), true);
              else audio.stopSpeaking();
            }}
          />
          <Toggle
            on={prefs.reducedMotion}
            onLabel={t("ui.motion")}
            offLabel={t("ui.motion")}
            onIcon="🌿"
            offIcon="🌿"
            onChange={(v) => setPrefs({ reducedMotion: v })}
          />
          {readText && (
            <button type="button" className={pill} onClick={() => audio.speak(readText, true)}>
              <span aria-hidden="true">📣</span> {t("ui.readAloud")}
            </button>
          )}
          <button type="button" className={pill} aria-expanded={showHow} onClick={() => setShowHow((s) => !s)}>
            <span aria-hidden="true">❔</span> {t("ui.howToPlay")}
          </button>
        </div>

        {showHow && (
          <p className="rounded-2xl bg-white border border-olive-200 px-4 py-3 text-sm text-textBody">{t(howKey)}</p>
        )}

        <main aria-hidden={paused} className={paused ? "pointer-events-none opacity-30 select-none" : ""}>
          {children({ paused })}
        </main>

        {paused && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("ui.paused")}
            className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-4"
          >
            <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 text-center shadow-card">
              <div className="text-5xl" aria-hidden="true">🦉</div>
              <p className="text-textBody">{t("ui.paused")}</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={togglePause}
                  className="rounded-full bg-deepGreen px-6 py-3 font-medium text-white focus:outline-none focus:ring-2 focus:ring-olive-500 focus:ring-offset-2"
                >
                  {t("ui.resume")}
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="rounded-full border border-olive-200 bg-white px-6 py-3 font-medium text-textHeading focus:outline-none focus:ring-2 focus:ring-olive-500"
                >
                  {t("ui.exit")}
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-textMuted">{t("ui.noScoreNote")}</p>
      </div>
    </div>
  );
};
