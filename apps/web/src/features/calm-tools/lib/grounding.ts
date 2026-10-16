/** Pure data and navigation helpers for the 5-4-3-2-1 grounding activity. */

export interface GroundingStep {
  count: number;
  sense: string;
  title: string;
  instruction: string;
}

export const GROUNDING_STEPS: readonly GroundingStep[] = [
  {
    count: 5,
    sense: "see",
    title: "5 things you can see",
    instruction: "Look around you. Slowly name five things you can see. Take your time with each one.",
  },
  {
    count: 4,
    sense: "feel",
    title: "4 things you can feel",
    instruction: "Notice four things you can feel. Maybe your feet on the floor, your clothes, or the chair holding you.",
  },
  {
    count: 3,
    sense: "hear",
    title: "3 things you can hear",
    instruction: "Listen quietly. Name three sounds, near or far.",
  },
  {
    count: 2,
    sense: "smell",
    title: "2 things you can smell",
    instruction: "Notice two things you can smell. If you cannot smell anything, imagine a smell you like.",
  },
  {
    count: 1,
    sense: "taste",
    title: "1 thing you can taste",
    instruction: "Notice one thing you can taste, or imagine a taste you enjoy.",
  },
];

export function nextStepIndex(index: number, total: number = GROUNDING_STEPS.length): number {
  return Math.min(total - 1, index + 1);
}

export function prevStepIndex(index: number): number {
  return Math.max(0, index - 1);
}

export function isLastStep(index: number, total: number = GROUNDING_STEPS.length): boolean {
  return index >= total - 1;
}
