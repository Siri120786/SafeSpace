// Feelings Detective rules. More than one feeling can fit a situation, so a
// choice is accepted unless it is marked "unlikely", and the feedback is
// always gentle: nobody is told they are wrong about a feeling.
import { feelingsContent, type Difficulty, type FeelingsScenario, type Fit, type StepFit } from "./content";
import { shuffle, type Rng } from "./rng";

export function buildFeelingsGame(difficulty: Difficulty, rng: Rng, count = feelingsContent.roundsPerGame): FeelingsScenario[] {
  const pool = feelingsContent.scenarios[difficulty];
  return shuffle(pool, rng)
    .slice(0, Math.min(count, pool.length))
    .map((s) => ({ ...s, feelings: shuffle(s.feelings, rng), steps: shuffle(s.steps, rng) }));
}

export interface Judgement<F> {
  accepted: boolean;
  fit: F;
  /** Key of the feedback sentence to show. */
  feedbackKey: string;
}

export function judgeFeeling(scenario: FeelingsScenario, feelingId: string): Judgement<Fit> {
  const f = scenario.feelings.find((x) => x.id === feelingId);
  const fit: Fit = f ? f.fit : "unlikely";
  return { accepted: fit !== "unlikely", fit, feedbackKey: `fd.fb.${fit}` };
}

export function judgeStep(scenario: FeelingsScenario, stepId: string): Judgement<StepFit> {
  const s = scenario.steps.find((x) => x.id === stepId);
  const fit: StepFit = s ? s.fit : "notHelpful";
  const accepted = fit !== "notHelpful";
  return { accepted, fit, feedbackKey: fit === "helpful" ? "fd.fb.helpful" : fit === "okay" ? "fd.fb.okay2" : "fd.fb.notHelpful" };
}
