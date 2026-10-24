import React, { useMemo, useState } from "react";
import { useGames } from "../GamesContext";
import { feelingLabel, feelingsContent, symbolName } from "../lib/content";
import { buildFeelingsGame, judgeFeeling, judgeStep } from "../lib/feelings";
import { randomRng } from "../lib/rng";
import { feelingScript } from "../lib/soundScript";
import { averageScore, questionCredit } from "../lib/scoring";
import { Buddy, GameShell } from "./GameShell";
import { RoundSummary } from "./RoundSummary";

interface Props {
  onExit: () => void;
  onAgain: () => void;
  onCheckMood?: () => void;
}

type Phase = "feeling" | "step" | "recap";

export const FeelingsDetectiveGame: React.FC<Props> = ({ onExit, onAgain, onCheckMood }) => {
  const { prefs, audio, finishRound, t, lang } = useGames();
  const difficulty = prefs.difficulty;
  const scenarios = useMemo(() => buildFeelingsGame(difficulty, randomRng()), [difficulty]);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("feeling");
  const [feelingTries, setFeelingTries] = useState(0);
  const [stepTries, setStepTries] = useState(0);
  const [clues, setClues] = useState(0);
  const [tried, setTried] = useState<string[]>([]);
  const [chosenFeeling, setChosenFeeling] = useState<string | null>(null);
  const [chosenStep, setChosenStep] = useState<string | null>(null);
  const [credits, setCredits] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  const s = scenarios[index];
  const scene = t(s.sceneKey);
  const question = phase === "feeling" ? t("fd.prompt.feeling", { name: s.name }) : t("fd.prompt.step", { name: s.name });
  const readText = `${scene} ${question}`;

  function pickFeeling(id: string) {
    audio.unlock();
    audio.playNotes(feelingScript(id));
    audio.speak(feelingLabel(id, lang));
    const j = judgeFeeling(s, id);
    setFeelingTries((n) => n + 1);
    setMessage(t(j.feedbackKey));
    if (j.accepted) {
      setChosenFeeling(id);
      setTried([]);
      setPhase("step");
    } else {
      setTried((x) => [...x, id]);
      setMistakes((n) => n + 1);
      audio.play("miss");
    }
  }

  function pickStep(id: string) {
    audio.unlock();
    const j = judgeStep(s, id);
    setStepTries((n) => n + 1);
    setMessage(t(j.feedbackKey));
    if (j.accepted) {
      setChosenStep(id);
      setPhase("recap");
      audio.play("cheer");
    } else {
      setTried((x) => [...x, id]);
      setMistakes((n) => n + 1);
      audio.play("miss");
    }
  }

  function showClue() {
    audio.play("hint");
    const next = Math.min(clues + 1, s.clueKeys.length);
    setClues(next);
    setHints((n) => (next > clues ? n + 1 : n));
    audio.speak(t(s.clueKeys[next - 1]));
  }

  function next() {
    const credit = (questionCredit(feelingTries, clues > 0) + questionCredit(stepTries, false)) / 2;
    const all = [...credits, credit];
    if (index + 1 < scenarios.length) {
      setCredits(all);
      setIndex(index + 1);
      setPhase("feeling");
      setFeelingTries(0);
      setStepTries(0);
      setClues(0);
      setTried([]);
      setChosenFeeling(null);
      setChosenStep(null);
      setMessage("");
      return;
    }
    setCredits(all);
    finishRound({ gameId: "feelings-detective", difficulty, score: averageScore(all), mistakes, hints });
    setDone(true);
  }

  return (
    <GameShell gameId="feelings-detective" onExit={onExit} readText={readText}>
      {() =>
        done ? (
          <RoundSummary
            gameId="feelings-detective"
            score={averageScore(credits)}
            message={t("fd.summary.note")}
            onAgain={onAgain}
            onExit={onExit}
            onCheckMood={onCheckMood}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-textMuted">
              {index + 1} / {scenarios.length}
            </p>

            <section aria-label={scene} className="space-y-2 rounded-3xl bg-white p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="text-5xl" role="img" aria-label={`${s.name}, ${symbolName(s.character, lang)}`}>
                  {s.character}
                </span>
                <p className="text-base text-textHeading sm:text-lg">{scene}</p>
              </div>
              {clues > 0 && (
                <ul aria-label={t("fd.clues")} className="list-inside list-disc rounded-2xl bg-paleLime/50 px-4 py-3 text-sm text-textBody">
                  {s.clueKeys.slice(0, clues).map((k) => (
                    <li key={k}>{t(k)}</li>
                  ))}
                </ul>
              )}
              {clues < s.clueKeys.length && phase !== "recap" && (
                <button
                  type="button"
                  onClick={showClue}
                  className="rounded-full border border-olive-200 bg-white px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-olive-500"
                >
                  <span aria-hidden="true">🔎 </span>
                  {t("fd.clue.show")}
                </button>
              )}
            </section>

            {message && <Buddy message={message} />}

            {phase === "feeling" && (
              <section aria-labelledby="fd-q" className="space-y-3">
                <h2 id="fd-q" className="font-display text-xl text-textHeading">{question}</h2>
                <div role="group" aria-labelledby="fd-q" className="grid grid-cols-2 gap-3">
                  {s.feelings.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => pickFeeling(f.id)}
                      aria-pressed={tried.includes(f.id)}
                      className={`flex flex-col items-center gap-1 rounded-3xl border-2 bg-white px-3 py-4 focus:outline-none focus:ring-4 focus:ring-olive-500 ${
                        tried.includes(f.id) ? "border-olive-200 opacity-50" : "border-olive-200 hover:bg-olive-50"
                      }`}
                    >
                      <span className="text-4xl" aria-hidden="true">{feelingsContent.feelings[f.id]}</span>
                      <span className="text-base font-medium text-textHeading">{feelingLabel(f.id, lang)}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {phase === "step" && (
              <section aria-labelledby="fd-q2" className="space-y-3">
                <p className="text-sm text-textBody">
                  {chosenFeeling && (
                    <>
                      <span aria-hidden="true">{feelingsContent.feelings[chosenFeeling]} </span>
                      {feelingLabel(chosenFeeling, lang)}
                    </>
                  )}
                </p>
                <h2 id="fd-q2" className="font-display text-xl text-textHeading">{question}</h2>
                <div role="group" aria-labelledby="fd-q2" className="space-y-2">
                  {s.steps.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      disabled={tried.includes(st.id)}
                      onClick={() => pickStep(st.id)}
                      className="block w-full rounded-2xl border-2 border-olive-200 bg-white px-4 py-3 text-left text-base text-textHeading hover:bg-olive-50 focus:outline-none focus:ring-4 focus:ring-olive-500 disabled:opacity-40"
                    >
                      {t(st.textKey)}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {phase === "recap" && (
              <section className="space-y-3 rounded-3xl bg-white p-5 text-center shadow-card">
                <p className="text-base text-textHeading">{t("fd.summary", { name: s.name })}</p>
                <p className="text-sm text-textBody">
                  <span aria-hidden="true">{chosenFeeling && feelingsContent.feelings[chosenFeeling]} </span>
                  {chosenFeeling && feelingLabel(chosenFeeling, lang)} →{" "}
                  {s.steps.find((x) => x.id === chosenStep) && t(s.steps.find((x) => x.id === chosenStep)!.textKey)}
                </p>
                <button
                  type="button"
                  autoFocus
                  onClick={next}
                  className="rounded-full bg-darkBtn px-8 py-3 font-medium text-white focus:outline-none focus:ring-2 focus:ring-olive-500 focus:ring-offset-2"
                >
                  {index + 1 < scenarios.length ? t("ui.next") : t("ui.done")}
                </button>
              </section>
            )}
          </div>
        )
      }
    </GameShell>
  );
};
