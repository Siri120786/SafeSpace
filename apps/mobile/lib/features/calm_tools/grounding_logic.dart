/// Data and navigation helpers for the 5-4-3-2-1 grounding activity
/// (mirror of apps/web calm-tools/lib/grounding.ts).
library;

class GroundingStep {
  final int count;
  final String title;
  final String instruction;

  const GroundingStep({
    required this.count,
    required this.title,
    required this.instruction,
  });
}

const List<GroundingStep> groundingSteps = <GroundingStep>[
  GroundingStep(
    count: 5,
    title: '5 things you can see',
    instruction:
        'Look around you. Slowly name five things you can see. Take your time with each one.',
  ),
  GroundingStep(
    count: 4,
    title: '4 things you can feel',
    instruction:
        'Notice four things you can feel. Maybe your feet on the floor, your clothes, or the chair holding you.',
  ),
  GroundingStep(
    count: 3,
    title: '3 things you can hear',
    instruction: 'Listen quietly. Name three sounds, near or far.',
  ),
  GroundingStep(
    count: 2,
    title: '2 things you can smell',
    instruction:
        'Notice two things you can smell. If you cannot smell anything, imagine a smell you like.',
  ),
  GroundingStep(
    count: 1,
    title: '1 thing you can taste',
    instruction: 'Notice one thing you can taste, or imagine a taste you enjoy.',
  ),
];

int nextStepIndex(int index, [int total = 5]) =>
    index + 1 > total - 1 ? total - 1 : index + 1;

int prevStepIndex(int index) => index - 1 < 0 ? 0 : index - 1;

bool isLastStep(int index, [int total = 5]) => index >= total - 1;
