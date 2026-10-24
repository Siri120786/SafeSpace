import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGames } from "../GamesContext";
import { memoryContent, symbolName } from "../lib/content";
import { flipCard, hintPair, newMemoryGame, pairsLeft, resolveMismatch, type MemoryState } from "../lib/memory";
import { randomRng } from "../lib/rng";
import { memoryScore } from "../lib/scoring";
import { Buddy, GameShell } from "./GameShell";
import { RoundSummary } from "./RoundSummary";

interface Props {
  onExit: () => void;
  onAgain: () => void;
}

export const MemoryMatchGame: React.FC<Props> = ({ onExit, onAgain }) => {
  const { prefs, calm, audio, finishRound, t, lang } = useGames();
  const difficulty = prefs.difficulty;
  const [game, setGame] = useState<MemoryState>(() => newMemoryGame(difficulty, randomRng()));
  const [pointer, setPointer] = useState<number[]>([]);
  const [message, setMessage] = useState(t("mm.prompt"));
  const [feedbackCount, setFeedbackCount] = useState(0);
  const timers = useRef<number[]>([]);
  const finished = useRef(false);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const say = useCallback(
    (keys: string[]) => {
      setFeedbackCount((n) => n + 1);
      setMessage(t(keys[feedbackCount % keys.length]));
    },
    [feedbackCount, t],
  );

  function onCard(index: number) {
    audio.unlock();
    const next = flipCard(game, index);
    if (next === game) return;
    setGame(next);
    setPointer([]);
    const card = next.cards[index];
    audio.speak(symbolName(card.face, lang));
    if (next.lastEvent === "miss") {
      audio.play("flip");
      later(() => audio.play("miss"), 180);
      say(memoryContent.feedbackKeys.miss);
      later(() => setGame((g) => resolveMismatch(g)), calm ? memoryContent.timing.flipBackCalmMs : memoryContent.timing.flipBackMs);
    } else if (next.lastEvent === "match") {
      audio.play("match");
      say(memoryContent.feedbackKeys.match);
    } else if (next.lastEvent === "won") {
      say(memoryContent.feedbackKeys.done);
      if (!finished.current) {
        finished.current = true;
        finishRound({
          gameId: "memory-match",
          difficulty,
          score: memoryScore(next.totalPairs, next.mistakes, next.hints),
          mistakes: next.mistakes,
          hints: next.hints,
        });
      }
    } else {
      audio.play("flip");
    }
  }

  function onHint() {
    audio.unlock();
    const h = hintPair(game);
    if (!h.pair) return;
    setGame(h.state);
    setPointer(h.pair);
    setMessage(t("mm.hint.text"));
    audio.play("hint");
    later(() => setPointer([]), 2200);
  }

  const label = (i: number) => {
    const c = game.cards[i];
    if (c.state === "down") return `Card ${i + 1}, face down`;
    return `${symbolName(c.face, lang)}${c.state === "matched" ? ", matched" : ""}`;
  };

  const won = game.status === "won";
  return (
    <GameShell gameId="memory-match" onExit={onExit} readText={t("mm.prompt")}>
      {() =>
        won ? (
          <RoundSummary
            gameId="memory-match"
            score={memoryScore(game.totalPairs, game.mistakes, game.hints)}
            message={message}
            onAgain={onAgain}
            onExit={onExit}
          />
        ) : (
          <div className="space-y-4">
            <Buddy message={message} speak={false} />
            <div className="flex items-center justify-between text-sm text-textBody">
              <span>
                {pairsLeft(game)} {t("mm.pairsLeft")}
              </span>
              <button
                type="button"
                onClick={onHint}
                disabled={game.locked}
                className="rounded-full border border-olive-200 bg-white px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-olive-500 disabled:opacity-50"
              >
                <span aria-hidden="true">💡 </span>
                {t("ui.hint")}
              </button>
            </div>
            <div
              role="group"
              aria-label={t("mm.prompt")}
              className="mx-auto grid gap-2 sm:gap-3"
              style={{ gridTemplateColumns: `repeat(${game.columns}, minmax(0, 1fr))`, maxWidth: `${game.columns * 112}px` }}
            >
              {game.cards.map((c) => (
                <button
                  key={c.index}
                  type="button"
                  onClick={() => onCard(c.index)}
                  aria-label={label(c.index)}
                  aria-pressed={c.state !== "down"}
                  className={`aspect-square rounded-2xl border-2 text-4xl sm:text-5xl transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-olive-500 ${
                    c.state === "matched"
                      ? "border-deepGreen bg-deepGreen-50 opacity-80"
                      : c.state === "up"
                        ? "border-olive-500 bg-white"
                        : "border-olive-200 bg-olive-100 hover:bg-olive-200"
                  } ${pointer.includes(c.index) ? "ring-4 ring-mascotPink" : ""} ${c.state === "down" || calm ? "" : "scale-105"}`}
                >
                  <span aria-hidden="true">{c.state === "down" ? "❔" : c.face}</span>
                </button>
              ))}
            </div>
          </div>
        )
      }
    </GameShell>
  );
};
