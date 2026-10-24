import React, { useMemo, useState } from "react";
import { useGames } from "../GamesContext";
import { patternContent, symbolName } from "../lib/content";
import {
  GAP,
  buildPatternGame,
  displayItems,
  gapIndex,
  isCorrect,
  noteIndexes,
  patternScore,
  solvedItems,
} from "../lib/pattern";
import { randomRng } from "../lib/rng";
import { patternScript } from "../lib/soundScript";
import { Buddy, GameShell } from "./GameShell";
import { RoundSummary } from "./RoundSummary";

interface Props {
  onExit: () => void;
  onAgain: () => void;
}

const name = (s: string, lang: string) => (s === GAP ? "missing" : /^\d+$/.test(s) ? s : symbolName(s, lang));

export const PatternQuestGame: React.FC<Props> = ({ onExit, onAgain }) => {
  const { prefs, calm, audio, finishRound, t, lang } = useGames();
  const difficulty = prefs.difficulty;
  const rounds = useMemo(() => buildPatternGame(difficulty, randomRng()), [difficulty]);

  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<number[]>([]);
  const [hinted, setHinted] = useState<boolean[]>([]);
  const [tries, setTries] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [wrong, setWrong] = useState<string[]>([]);
  const [solved, setSolved] = useState(false);
  const [message, setMessage] = useState(t("pq.prompt"));
  const [done, setDone] = useState(false);
  const [fb, setFb] = useState(0);

  const round = rounds[index];
  const hasGap = gapIndex(round) >= 0;
  const prompt = hasGap ? t("pq.promptGap") : t("pq.prompt");
  const shown = solved ? solvedItems(round) : displayItems(round);

  function hear() {
    audio.unlock();
    audio.playNotes(patternScript(noteIndexes(solved ? solvedItems(round) : round.items)));
  }

  function choose(option: string) {
    if (solved) return;
    audio.unlock();
    const nextTries = tries + 1;
    setTries(nextTries);
    audio.speak(name(option, lang));
    if (isCorrect(round, option)) {
      setSolved(true);
      setFb((n) => n + 1);
      setMessage(t(patternContent.feedbackKeys.correct[fb % patternContent.feedbackKeys.correct.length]));
      audio.play("match");
    } else {
      setWrong((w) => [...w, option]);
      setFb((n) => n + 1);
      setMessage(t(patternContent.feedbackKeys.retry[fb % patternContent.feedbackKeys.retry.length]));
      audio.play("miss");
    }
  }

  function hint() {
    audio.unlock();
    setUsedHint(true);
    setMessage(t(round.hintKey));
    audio.play("hint");
    audio.speak(t(round.hintKey));
  }

  function next() {
    const a = [...attempts, tries];
    const h = [...hinted, usedHint];
    if (index + 1 < rounds.length) {
      setAttempts(a);
      setHinted(h);
      setIndex(index + 1);
      setTries(0);
      setUsedHint(false);
      setWrong([]);
      setSolved(false);
      setMessage(t("pq.prompt"));
      return;
    }
    setAttempts(a);
    setHinted(h);
    const mistakes = a.reduce((n, x) => n + Math.max(0, x - 1), 0);
    finishRound({
      gameId: "pattern-quest",
      difficulty,
      score: patternScore({ attempts: a, hinted: h }),
      mistakes,
      hints: h.filter(Boolean).length,
    });
    setDone(true);
  }

  return (
    <GameShell gameId="pattern-quest" onExit={onExit} readText={prompt}>
      {() =>
        done ? (
          <RoundSummary
            gameId="pattern-quest"
            score={patternScore({ attempts, hinted })}
            message={t("pq.fb.correct1")}
            onAgain={onAgain}
            onExit={onExit}
          />
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-textMuted">
              {index + 1} / {rounds.length}
            </p>
            <Buddy message={message} speak={false} />
            <h2 className="font-display text-xl text-textHeading">{prompt}</h2>

            <div
              role="img"
              aria-label={`${prompt} ${shown.map((s) => name(s, lang)).join(", ")}`}
              className="flex flex-wrap items-center justify-center gap-2 rounded-3xl bg-white p-4 shadow-card sm:gap-3"
            >
              {shown.map((s, i) => (
                <span
                  key={`${i}-${s}`}
                  aria-hidden="true"
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 text-3xl sm:h-16 sm:w-16 sm:text-4xl ${
                    s === GAP
                      ? `border-dashed border-mascotPink bg-mascotPink-soft text-mascotPink-dark ${calm ? "" : "motion-safe:animate-pulse"}`
                      : "border-olive-200 bg-olive-50"
                  }`}
                >
                  {s === GAP ? "?" : s}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={hear}
                className="rounded-full border border-olive-200 bg-white px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-olive-500"
              >
                <span aria-hidden="true">🎵 </span>
                {t("pq.hear")}
              </button>
              <button
                type="button"
                onClick={hint}
                disabled={solved}
                className="rounded-full border border-olive-200 bg-white px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-olive-500 disabled:opacity-50"
              >
                <span aria-hidden="true">💡 </span>
                {t("ui.hint")}
              </button>
            </div>

            <div role="group" aria-label="Choices" className="flex flex-wrap justify-center gap-3">
              {round.options.map((o) => (
                <button
                  key={o}
                  type="button"
                  disabled={solved || wrong.includes(o)}
                  onClick={() => choose(o)}
                  aria-label={name(o, lang)}
                  className={`h-20 w-20 rounded-3xl border-2 text-4xl focus:outline-none focus:ring-4 focus:ring-olive-500 ${
                    solved && o === round.answer
                      ? "border-deepGreen bg-deepGreen-50"
                      : wrong.includes(o)
                        ? "border-olive-200 bg-olive-50 opacity-40"
                        : "border-olive-200 bg-white hover:bg-olive-50"
                  }`}
                >
                  <span aria-hidden="true">{o}</span>
                </button>
              ))}
            </div>

            {solved && (
              <div className="flex justify-center">
                <button
                  type="button"
                  autoFocus
                  onClick={next}
                  className="rounded-full bg-darkBtn px-8 py-3 font-medium text-white focus:outline-none focus:ring-2 focus:ring-olive-500 focus:ring-offset-2"
                >
                  {index + 1 < rounds.length ? t("ui.next") : t("ui.done")}
                </button>
              </div>
            )}
          </div>
        )
      }
    </GameShell>
  );
};
