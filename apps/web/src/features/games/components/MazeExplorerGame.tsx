import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGames } from "../GamesContext";
import { dirTo, hint, move, newMazeGame, optimalSteps, pickMaze, undo, type Dir, type MazeState, type Pos } from "../lib/maze";
import { randomRng } from "../lib/rng";
import { mazeScore } from "../lib/scoring";
import { Buddy, GameShell } from "./GameShell";
import { RoundSummary } from "./RoundSummary";

interface Props {
  onExit: () => void;
  onAgain: () => void;
}

const ARROWS: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
const GLYPH: Record<Dir, string> = { up: "⬆️", down: "⬇️", left: "⬅️", right: "➡️" };

export const MazeExplorerGame: React.FC<Props> = ({ onExit, onAgain }) => {
  const { prefs, audio, finishRound, t, calm } = useGames();
  const difficulty = prefs.difficulty;
  const maze = useMemo(() => pickMaze(difficulty, randomRng()), [difficulty]);
  const best = useMemo(() => optimalSteps(maze), [maze]);
  const [game, setGame] = useState<MazeState>(() => newMazeGame(maze));
  const [pointer, setPointer] = useState<Pos | null>(null);
  const [message, setMessage] = useState(t("mz.prompt"));
  const finished = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  // Always act on the latest state, so quick repeated taps and key repeats never use a stale board.
  const gameRef = useRef(game);
  gameRef.current = game;

  const go = useCallback(
    (dir: Dir) => {
      const g = gameRef.current;
      const n = move(g, dir);
      if (n === g) return;
      gameRef.current = n;
      setGame(n);
      setPointer(null);
      if (n.lastEvent === "bump") {
        audio.play("bump");
        setMessage(t("mz.stuck"));
      } else {
        audio.play(n.lastEvent === "won" ? "match" : "step");
        setMessage(n.lastEvent === "won" ? t("mz.done2") : t("mz.prompt"));
      }
    },
    [audio, t],
  );

  // Arrow keys and WASD move the explorer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = ARROWS[e.key];
      if (!dir || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      e.preventDefault();
      audio.unlock();
      go(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, audio]);

  useEffect(() => {
    if (game.status === "won" && !finished.current) {
      finished.current = true;
      finishRound({
        gameId: "maze-explorer",
        difficulty,
        score: mazeScore(best, game.steps, game.hints),
        mistakes: game.bumps,
        hints: game.hints,
      });
    }
  }, [game, best, difficulty, finishRound]);

  function onHint() {
    audio.unlock();
    const h = hint(game);
    if (!h.next) return;
    setGame(h.state);
    setPointer(h.next);
    setMessage(`${t("mz.hint.text")} ${h.dir ? t(`mz.${h.dir}`) : ""}`.trim());
    audio.play("hint");
    audio.speak(h.dir ? t(`mz.${h.dir}`) : "");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPointer(null), 2500);
  }

  function onUndo() {
    audio.unlock();
    const n = undo(gameRef.current);
    if (n === gameRef.current) return;
    gameRef.current = n;
    setGame(n);
    setPointer(null);
    audio.play("undo");
  }

  function onCell(x: number, y: number) {
    audio.unlock();
    const d = dirTo(game.pos, [x, y]);
    if (d) go(d);
  }

  const size = maze.columns;
  const won = game.status === "won";

  return (
    <GameShell gameId="maze-explorer" onExit={onExit} readText={t("mz.prompt")}>
      {() =>
        won ? (
          <RoundSummary gameId="maze-explorer" score={mazeScore(best, game.steps, game.hints)} message={t("mz.done1")} onAgain={onAgain} onExit={onExit} />
        ) : (
          <div className="space-y-4">
            <Buddy message={message} speak={false} />
            <p className="text-sm text-textBody" aria-live="polite">
              {game.steps} {t("mz.moves")}
            </p>
            <div
              role="grid"
              aria-label={t("mz.prompt")}
              className="mx-auto grid max-w-sm gap-0 rounded-2xl border-4 border-white bg-olive-100 p-1 shadow-card"
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            >
              {maze.rows.flatMap((row, y) =>
                row.split("").map((ch, x) => {
                  const wall = ch === "#";
                  const here = game.pos[0] === x && game.pos[1] === y;
                  const goal = maze.goal[0] === x && maze.goal[1] === y;
                  const trail = game.history.some((p) => p[0] === x && p[1] === y);
                  const hinted = pointer && pointer[0] === x && pointer[1] === y;
                  const adjacent = !wall && dirTo(game.pos, [x, y]) !== null;
                  return (
                    <div
                      key={`${x}-${y}`}
                      role="gridcell"
                      aria-label={here ? "explorer" : goal ? "finish flag" : wall ? "wall" : "path"}
                      onClick={adjacent ? () => onCell(x, y) : undefined}
                      className={`flex aspect-square items-center justify-center text-[clamp(14px,4.4vw,26px)] ${
                        wall ? "bg-deepGreen-700" : adjacent ? "cursor-pointer bg-white ring-1 ring-olive-200" : trail ? "bg-paleLime" : "bg-white"
                      } ${hinted ? `bg-mascotPink-soft ring-2 ring-mascotPink ${calm ? "" : "motion-safe:animate-pulse"}` : ""}`}
                    >
                      <span aria-hidden="true">{here ? "🚶" : goal ? "🏁" : hinted ? "✨" : ""}</span>
                    </div>
                  );
                }),
              )}
            </div>

            <div className="mx-auto grid w-48 grid-cols-3 gap-2" role="group" aria-label="Move">
              <span />
              <DirButton dir="up" onGo={go} label={t("mz.up")} />
              <span />
              <DirButton dir="left" onGo={go} label={t("mz.left")} />
              <DirButton dir="down" onGo={go} label={t("mz.down")} />
              <DirButton dir="right" onGo={go} label={t("mz.right")} />
            </div>

            <div className="flex justify-center gap-2">
              <button type="button" onClick={onUndo} disabled={game.history.length === 0}
                className="rounded-full border border-olive-200 bg-white px-5 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-olive-500 disabled:opacity-40">
                <span aria-hidden="true">↩️ </span>{t("ui.undo")}
              </button>
              <button type="button" onClick={onHint}
                className="rounded-full border border-olive-200 bg-white px-5 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-olive-500">
                <span aria-hidden="true">💡 </span>{t("ui.hint")}
              </button>
            </div>
          </div>
        )
      }
    </GameShell>
  );
};

const DirButton: React.FC<{ dir: Dir; label: string; onGo: (d: Dir) => void }> = ({ dir, label, onGo }) => (
  <button
    type="button"
    aria-label={label}
    onClick={() => onGo(dir)}
    className="flex h-14 items-center justify-center rounded-2xl border-2 border-olive-200 bg-white text-2xl focus:outline-none focus:ring-4 focus:ring-olive-500 active:scale-95"
  >
    <span aria-hidden="true">{GLYPH[dir]}</span>
  </button>
);
