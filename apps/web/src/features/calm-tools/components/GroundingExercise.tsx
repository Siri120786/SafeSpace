import React, { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { GROUNDING_STEPS, isLastStep, nextStepIndex, prevStepIndex } from "../lib/grounding";
import { CalmToolShell } from "./CalmToolShell";

interface GroundingExerciseProps {
  lowSensory: boolean;
  onExit: () => void;
  notice?: string | null;
}

export const GroundingExercise: React.FC<GroundingExerciseProps> = ({ lowSensory, onExit, notice }) => {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const step = GROUNDING_STEPS[index];
  const last = isLastStep(index);

  return (
    <CalmToolShell title="5-4-3-2-1 grounding" onExit={onExit} lowSensory={lowSensory} notice={notice}>
      <Card className="space-y-6">
        {done ? (
          <div className="text-center space-y-4" role="status" aria-live="polite">
            <p className="font-display text-2xl text-textHeading">Well done</p>
            <p className="text-sm text-textBody">
              You noticed your surroundings with all five senses. Take one slow breath before you go on.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIndex(0);
                  setDone(false);
                }}
              >
                Do it again
              </Button>
              <Button variant="primary" onClick={onExit}>
                Finish
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-textMuted">
              Step {index + 1} of {GROUNDING_STEPS.length}
            </p>
            <div role="status" aria-live="polite" className="space-y-2">
              <h2 className="font-display text-2xl text-textHeading">{step.title}</h2>
              <p className="text-base text-textBody leading-relaxed">{step.instruction}</p>
            </div>
            <div className="flex flex-wrap justify-between gap-3">
              <Button variant="outline" onClick={() => setIndex(prevStepIndex(index))} disabled={index === 0}>
                Back
              </Button>
              {last ? (
                <Button variant="primary" onClick={() => setDone(true)}>
                  Done
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setIndex(nextStepIndex(index))}>
                  Next
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </CalmToolShell>
  );
};
