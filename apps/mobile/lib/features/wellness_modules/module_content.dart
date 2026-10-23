/// Placeholder module content. ALL of this is unreviewed and must not be treated
/// as clinical guidance (see docs/content-needing-review.md).
/// Mirror of apps/web wellness-modules/lib/content.ts.
library;

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

/// General education only. Unreviewed: needs clinician review before release.
const List<List<String>> pcosMyths = <List<String>>[
  <String>[
    'PCOS means you have cysts on your ovaries that must be removed.',
    'The name can be misleading. The small follicles seen on scans are not usually harmful cysts, and surgery is not the usual treatment. A doctor can explain what is right for you.',
  ],
  <String>[
    'Only people who are overweight get PCOS.',
    'PCOS can affect people of many body sizes, including people who are slim.',
  ],
  <String>[
    'Everyone with PCOS has the same symptoms.',
    'Symptoms differ a lot from person to person. Some people have irregular periods, some do not.',
  ],
  <String>[
    'PCOS means you can never have a baby.',
    'PCOS can make ovulation irregular, and some people need medical support, but many people with PCOS do become pregnant.',
  ],
  <String>[
    'Birth control pills cure PCOS.',
    'There is no cure. Treatments help manage symptoms, and the right choice is something to talk through with a doctor.',
  ],
  <String>[
    'PCOS is your fault.',
    'The exact cause is not fully known. Genes and hormones play a part. It is not caused by anything you did wrong.',
  ],
];

const String mythsNote =
    'This is general information, not medical advice. Please talk to a doctor about your own health.';

/// Adult-only module: only adult 'user' accounts may open Cycle Care
/// (pending the adult-access decision).
bool canOpenCycleCare(String? role) => role == 'user';
