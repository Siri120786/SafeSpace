import React from "react";
import { Link } from "react-router-dom";
import { useGames } from "../GamesContext";
import { DIFFICULTIES, catalog, type Difficulty } from "../lib/content";
import { roundsFor, totalRounds } from "../lib/progress";
import { Buddy } from "./GameShell";

interface Props {
  basePath: string;
  homePath: string;
}

const LEVEL_EMOJI: Record<Difficulty, string> = { easy: "🌱", medium: "🌿", hard: "🌳" };

export const GamesHome: React.FC<Props> = ({ basePath, homePath }) => {
  const { t, prefs, setPrefs, state, calm, saveStatus, languageFallback, audio, suggestionFor } = useGames();
  const stars = totalRounds(state.progress);
  const mvp = catalog.games.filter((g) => g.tier === "mvp");
  const more = catalog.games.filter((g) => g.tier !== "mvp");

  const card = (g: (typeof catalog.games)[number]) => {
    const rounds = roundsFor(state.progress, g.id);
    const sug = suggestionFor(g.id);
    return (
      <Link
        key={g.id}
        to={`${basePath}/${g.id}`}
        onClick={() => audio.unlock()}
        className="block rounded-3xl focus:outline-none focus:ring-4 focus:ring-olive-500 focus:ring-offset-2"
      >
        <div className={`flex h-full items-center gap-4 rounded-3xl border border-white/60 bg-white p-5 shadow-card ${calm ? "" : "transition-transform hover:-translate-y-1"}`}>
          <span className="text-5xl" aria-hidden="true">{g.emoji}</span>
          <span className="min-w-0 space-y-1">
            <span className="block font-display text-xl text-textHeading">{t(g.titleKey)}</span>
            <span className="block text-sm text-textBody">{t(g.blurbKey)}</span>
            <span className="block text-xs text-textMuted">
              {rounds > 0 ? `${"⭐".repeat(Math.min(rounds, 5))} ${rounds} ${t("ui.roundsDone")}` : g.skills.join(" · ")}
              {sug === "up" ? ` · ${t("ui.suggestUp")}` : ""}
            </span>
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div
      data-low-sensory={calm ? "on" : "off"}
      className={`min-h-screen px-4 py-6 sm:px-6 ${calm ? "bg-[#F4F1EA] [&_*]:!transition-none [&_*]:!animate-none" : "bg-gradient-to-b from-cream to-paleLime"}`}
    >
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-textHeading">
              <span aria-hidden="true">🎲 </span>
              {t("ui.title")}
            </h1>
            <p className="text-sm text-textBody">{t("ui.subtitle")}</p>
          </div>
          <Link
            to={homePath}
            className="rounded-full border border-olive-200 bg-white px-5 py-2 text-sm font-medium text-textHeading focus:outline-none focus:ring-2 focus:ring-olive-500"
          >
            &larr; {t("ui.exit")}
          </Link>
        </header>

        <Buddy message={t("buddy.welcome")} />

        <section aria-labelledby="level-h" className="space-y-2 rounded-3xl bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="level-h" className="font-display text-lg text-textHeading">{t("ui.difficulty")}</h2>
            <p className="text-sm text-textBody" aria-label={`${t("ui.stars")}: ${stars}`}>
              <span aria-hidden="true">⭐ </span>
              {stars} {t("ui.stars").toLowerCase()}
            </p>
          </div>
          <div role="radiogroup" aria-labelledby="level-h" className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={prefs.difficulty === d}
                onClick={() => {
                  audio.unlock();
                  audio.play("tap");
                  setPrefs({ difficulty: d });
                }}
                className={`rounded-full border-2 px-5 py-2 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-olive-500 ${
                  prefs.difficulty === d ? "border-deepGreen bg-deepGreen text-white" : "border-olive-200 bg-white text-textHeading hover:bg-olive-50"
                }`}
              >
                <span aria-hidden="true">{LEVEL_EMOJI[d]} </span>
                {t(`ui.${d}`)}
              </button>
            ))}
          </div>
        </section>

        <div className="space-y-3">{mvp.map(card)}</div>
        <div className="space-y-3">{more.map(card)}</div>

        {languageFallback && <p className="text-xs text-textMuted">{t("ui.language.fallback")}</p>}
        <p className="text-center text-xs text-textMuted" role="status">
          {saveStatus === "account" ? t("ui.savedPrivate") : saveStatus === "later" ? t("ui.savedLater") : t("ui.savedHere")}
        </p>
        <p className="text-center text-xs text-textMuted">{t("ui.noScoreNote")}</p>
      </div>
    </div>
  );
};
