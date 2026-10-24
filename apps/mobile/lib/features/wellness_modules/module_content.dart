/// Placeholder module content. ALL of this is unreviewed and must not be treated
/// as clinical guidance (see docs/content-needing-review.md).
/// Mirror of apps/web wellness-modules/lib/content.ts.
library;

import 'condition.dart';

const String reviewNotice = 'Draft wording that is still waiting for a professional review.';

const String supportText =
    'If things feel too much, please talk to a trusted adult or your local support services. This app cannot call anyone for you.';

const List<String> anxietyTips = <String>[
  'Put both feet on the floor and notice how the ground feels.',
  'Name one thing in the room that feels calm to you.',
  'Let your shoulders drop as you breathe out.',
];

const List<String> goalIdeas = <String>[
  'Drink a glass of water',
  'Step outside for a few minutes',
  'Send a short message to someone I like',
  'Tidy one small spot',
];

const List<String> hobbyIdeas = <String>[
  'Listen to a favorite song',
  'Draw or doodle for five minutes',
  'Water a plant or look at one',
  'Read a few pages of something light',
];

const String gratitudePrompt = 'What is one small thing that was okay or good today?';

const List<String> encouragements = <String>[
  'That counts. Well done for doing it.',
  'A small step is still a step.',
  'Thank you for looking after yourself today.',
];

const List<String> relaxationSteps = <String>[
  'Sit or lie in a way that feels safe and comfortable. You can open your eyes at any time.',
  'Notice the parts of your body that touch the chair or bed.',
  'Slowly relax your hands. Let your fingers soften.',
  'Slowly relax your shoulders and jaw.',
  'Take one slow breath in and a longer breath out. You can stop whenever you like.',
];

const String careBridgingText =
    'Support from a real person can help a lot. Consider telling a trusted person or a health professional how you have been feeling. You do not have to do this alone.';

const List<List<String>> pcosChecklist = <List<String>>[
  <String>['water', 'Drink water through the day'],
  <String>['medication', 'Take my medication as my doctor told me (if I have any)'],
  <String>['movement', 'Do some gentle movement'],
  <String>['sleep', 'Wind down for sleep'],
];

const List<String> movementIdeas = <String>[
  'A short, easy walk',
  'Gentle stretching for a few minutes',
  'Dancing to one song at your own pace',
];

const List<String> sleepStressIdeas = <String>[
  'Dim the lights and put screens away a little earlier',
  'Try the breathing exercise before bed',
  'Write down tomorrow\'s worries so they stay on paper',
];

/// PCOS myths and facts (shared ones plus PCOS-only). The PCOD list lives in condition.dart.
final List<List<String>> pcosMyths = <List<String>>[
  for (final Myth m in mythsFor(Condition.pcos)) <String>[m.myth, m.fact],
];

const String mythsNote =
    'This is general information, not medical advice. Please talk to a doctor about your own health.';

/// Adult-only module: only adult 'user' accounts may open Cycle Care
/// (pending the adult-access decision).
bool canOpenCycleCare(String? role) => role == 'user';
