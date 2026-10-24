import React, { useEffect, useMemo } from "react";
import { useGames } from "../GamesContext";
import type { GameId } from "../lib/content";
import { nextDifficulty, starsFor } from "../lib/scoring";
import { Buddy } from "./GameShell";

interface Props {
  gameId: GameId;
  score: number | null;
  message: string;
  onAgain: () => void;
  onExit: () => void;
  /** Where the "how are you feeling?" nudge goes (only the feelings game offers it). */
  onCheckMood?: () => void;
}

/** End-of-round card: stars, a kind message, save status and an optional level suggestion. */
export const RoundSummary: React.FC<Props> = ({ gameId, score, message, onAgain, onExit, onCheckMood }) => {
  const { t, audio, saveStatus, prefs, setPrefs, suggestionFor, calm } = useGames();
  const stars = starsFor(score);
  const suggestion = suggestionFor(gameId);

  useEffect(() => {
    audio.play("win");
  }, [audio]);

  const note = useMemo(
    () => (saveStatus === "account" ? t("ui.savedPrivate") : saveStatus === "later" ? t("ui.savedLater") : t("ui.savedHere")),
    [saveStatus, t],
  );

  return (
    <section aria-labelledby="round-done" className="space-y-4 rounded-3xl bg-white p-6 text-center shadow-card">
      <h2 id="round-done" className="font-display text-2xl text-textHeading">{t("ui.finishedTitle")}</h2>
      <div className={`text-4xl ${calm ? "" : "motion-safe:animate-pulse"}`} role="img" aria-label={`${stars} stars`}>
        {"⭐".repeat(stars)}
        <span className="opacity-25">{"⭐".repeat(3 - stars)}</span>
      </div>
      <Buddy message={message} />
      {suggestion !== "same" && (
        <div className="rounded-2xl bg-paleLime/60 px-4 py-3 text-sm text-textBody">
          <p>{suggestion === "up" ? t("ui.suggestUp") : t("ui.suggestDown")}</p>
          <div className="mt-2 flex justify-center gap-2">
            <button
              type="button"
              className="rounded-full bg-deepGreen px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-olive-500"
              onClick={() => {
                setPrefs({ difficulty: nextDifficulty(prefs.difficulty, suggestion) });
                onAgain();
              }}
            >
              {t("ui.accept")}
            </button>
            <button
              type="button"
              className="rounded-full border border-olive-200 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-olive-500"
              onClick={onAgain}
            >
              {t("ui.notNow")}
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          autoFocus
          onClick={onAgain}
          className="rounded-full bg-darkBtn px-6 py-3 font-medium text-white focus:outline-none focus:ring-2 focus:ring-olive-500 focus:ring-offset-2"
        >
          {t("ui.another")}
        </button>
        {onCheckMood && (
          <button
            type="button"
            onClick={onCheckMood}
            className="rounded-full border border-olive-200 bg-white px-6 py-3 font-medium text-textHeading focus:outline-none focus:ring-2 focus:ring-olive-500"
          >
            {t("ui.checkMood")}
          </button>
        )}
        <button
          type="button"
          onClick={onExit}
          className="rounded-full border border-olive-200 bg-white px-6 py-3 font-medium text-textHeading focus:outline-none focus:ring-2 focus:ring-olive-500"
        >
          {t("ui.back")}
        </button>
      </div>
      <p className="text-xs text-textMuted" role="status">{note}</p>
    </section>
  );
};
