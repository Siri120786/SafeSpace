import React from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { PHASE_INSTRUCTIONS, PHASE_LABELS } from "../lib/breathing";
import { useBreathingTimer } from "../hooks/useBreathingTimer";
import { CalmToolShell } from "./CalmToolShell";

interface BreathingExerciseProps {
  lowSensory: boolean;
  onExit: () => void;
  notice?: string | null;
}

export const BreathingExercise: React.FC<BreathingExerciseProps> = ({ lowSensory, onExit, notice }) => {
  const { pattern, state, running, notStarted, paused, start, pause, reset } = useBreathingTimer();

  let headline: string;
  let detail: string;
  if (state.finished) {
    headline = "Well done";
    detail = "You finished your breathing session. Notice how your body feels now.";
  } else if (notStarted) {
    headline = "Ready when you are";
    detail = `Press Start. You will breathe in for ${pattern.inhaleSeconds}, hold for ${pattern.holdSeconds}, and breathe out for ${pattern.exhaleSeconds}, ${pattern.cycles} times.`;
  } else if (paused) {
    headline = "Paused";
    detail = "Press Resume when you are ready to carry on, or Reset to start again.";
  } else {
    headline = PHASE_LABELS[state.phase];
    detail = PHASE_INSTRUCTIONS[state.phase];
  }

  // The circle follows the breath, but only when motion is allowed.
  const active = running || paused;
  const growing = state.phase === "inhale" || state.phase === "hold";
  const scale = lowSensory || !active ? 1 : growing ? 1.25 : 0.85;
  const phaseSeconds =
    state.phase === "inhale" ? pattern.inhaleSeconds : state.phase === "hold" ? pattern.holdSeconds : pattern.exhaleSeconds;

  return (
    <CalmToolShell title="Breathing exercise" onExit={onExit} lowSensory={lowSensory} notice={notice}>
      <Card className="text-center space-y-6">
        <div className="flex justify-center py-4" aria-hidden="true">
          <div
            data-testid="breathing-circle"
            className="w-40 h-40 rounded-full bg-olive-100 border-4 border-olive-300 flex items-center justify-center"
            style={{
              transform: `scale(${scale})`,
              transition: lowSensory ? "none" : `transform ${phaseSeconds}s ease-in-out`,
            }}
          >
            <span className="font-display text-4xl text-deepGreen">{active && !state.finished ? state.secondsLeft : ""}</span>
          </div>
        </div>

        <div role="status" aria-live="polite" className="space-y-1">
          <p className="font-display text-2xl text-textHeading">{headline}</p>
          <p className="text-sm text-textBody">{detail}</p>
        </div>

        {!notStarted && (
          <p className="text-sm text-textMuted">
            Breath {Math.min(state.cycle, pattern.cycles)} of {pattern.cycles}
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          {running ? (
            <Button variant="primary" onClick={pause}>
              Pause
            </Button>
          ) : (
            <Button variant="primary" onClick={start}>
              {state.finished ? "Start again" : paused ? "Resume" : "Start"}
            </Button>
          )}
          <Button variant="outline" onClick={reset} disabled={notStarted}>
            Reset
          </Button>
        </div>
      </Card>
    </CalmToolShell>
  );
};
