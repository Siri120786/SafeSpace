// PCOS / PCOD hub: which condition the person follows, and the wording that differs between them.
// Mirrors apps/web/src/features/wellness-modules/lib/condition.ts.
//
// Honest framing (see docs/pcos-pcod-research-notes.md): international guidelines and the
// Rotterdam criteria define PCOS only. "PCOD" is a popular label, common in India, that clinics
// often describe as the milder, more lifestyle-responsive picture, while many doctors treat the
// two as the same. So the app never diagnoses or decides which one a person has. The person picks
// the label their doctor uses, and only the emphasis of the tips changes. All wording is
// unreviewed (docs/content-needing-review.md) and needs clinician review before real users.

enum Condition { pcos, pcod, unsure }

const Map<Condition, String> conditionLabels = <Condition, String>{
  Condition.pcos: 'PCOS',
  Condition.pcod: 'PCOD',
  Condition.unsure: 'Not sure yet',
};

Condition? conditionFromName(Object? raw) {
  for (final Condition c in Condition.values) {
    if (c.name == raw) return c;
  }
  return null;
}

const String termsNote =
    'Doctors often use PCOS as the main medical term, and PCOD is a popular label. Some doctors use them to mean the same thing, and some use PCOD for a milder picture. Please ask your doctor which one applies to you. This app does not decide that.';

class AboutBlock {
  final String title;
  final List<String> points;
  const AboutBlock(this.title, this.points);
}

const AboutBlock aboutPcos = AboutBlock('About PCOS (polycystic ovary syndrome)', <String>[
  'PCOS is a hormonal (endocrine) condition. It is called a syndrome because it can show up in several ways.',
  'Doctors usually look for two of these three: irregular or missed ovulation and periods, signs of higher male-type hormones (such as acne, extra hair growth or hair thinning), and ovaries that look polycystic on a scan.',
  'It can also come with insulin resistance, which affects how the body uses sugar, so regular check-ups matter over the years.',
  'Care is usually a mix of everyday habits and, for some people, medicine chosen by their doctor.',
]);

const AboutBlock aboutPcod = AboutBlock('About PCOD (polycystic ovarian disease)', <String>[
  'PCOD is a popular label for when the ovaries release many immature eggs that can look like small cysts on a scan, often with irregular periods.',
  'It is often described as a milder, very common picture that responds well to everyday habits like regular meals, movement, sleep and calming stress.',
  'Some people still need medical care, for example for painful or very irregular periods, so it is worth talking to a doctor.',
  'Many people with PCOD have regular check-ups and manage well. It is not caused by anything you did.',
]);

class Difference {
  final String aspect;
  final String pcos;
  final String pcod;
  const Difference(this.aspect, this.pcos, this.pcod);
}

const List<Difference> differences = <Difference>[
  Difference('In everyday use', 'The standard medical term for a hormonal syndrome.', 'A popular label, often for a milder, ovary-focused picture.'),
  Difference('Periods', 'Often irregular or infrequent.', 'Often irregular.'),
  Difference('Other signs', 'Can include acne, extra hair growth, hair thinning and insulin resistance.', 'Other signs are often milder or fewer.'),
  Difference('Long-term check-ups', 'Doctors often suggest regular checks of blood sugar, cholesterol and blood pressure.', 'Doctors often focus on period regularity and lifestyle, and add checks if needed.'),
  Difference('Everyday care', 'Habits matter, and some people also need medicine.', 'Habits matter most, and many people manage with lifestyle support.'),
];

const String differencesNote = 'This is a general picture. Real life varies a lot, and the two overlap. Only your doctor can tell you what applies to you.';

const List<String> checkupQuestionsPcos = <String>[
  'Should I have my blood sugar, cholesterol and blood pressure checked, and how often?',
  'Could insulin resistance be part of my picture?',
  'Do I need hormone blood tests or a scan?',
  'What are my options for irregular periods, acne or hair changes?',
  'If I plan a pregnancy one day, what should I know?',
];

const List<String> checkupQuestionsPcod = <String>[
  'How can I tell if my periods are becoming more regular?',
  'Do I need any tests, or is a lifestyle plan enough for now?',
  'How often should I check back with you?',
  'What should I do about painful or very heavy periods?',
  'If I plan a pregnancy one day, what should I know?',
];

const List<String> sharedQuestions = <String>[
  'What support is there for my mood, stress or sleep?',
  'Is it okay to take my supplements together with my medicine?',
];

List<String> visitQuestionsFor(Condition? c) {
  if (c == Condition.pcos) return <String>[...checkupQuestionsPcos, ...sharedQuestions];
  if (c == Condition.pcod) return <String>[...checkupQuestionsPcod, ...sharedQuestions];
  return <String>[checkupQuestionsPcos[0], checkupQuestionsPcod[0], 'Which one applies to me, PCOS or PCOD?', ...sharedQuestions];
}

const List<String> foodFocusPcos = <String>[
  'Because insulin can play a part, steady meals with fibre and protein help many people avoid big sugar swings.',
  'Choosing slower-digesting carbohydrates, like millets, oats and pulses, is a common suggestion.',
];

const List<String> foodFocusPcod = <String>[
  'Regular, balanced meals and enough fibre are a good base. Try not to skip meals.',
  'Cutting back gently on refined sugar and fried packaged snacks is a common suggestion.',
];

const String foodSharedNote = 'Crash diets and skipping meals are not recommended for either. Slow and steady habits work better.';

List<String> foodFocusFor(Condition? c) {
  if (c == Condition.pcos) return foodFocusPcos;
  if (c == Condition.pcod) return foodFocusPcod;
  return <String>[...foodFocusPcos, ...foodFocusPcod];
}

const List<String> moveFocusPcos = <String>[
  'A common general guideline for adults is about 150 minutes of moderate activity a week, plus two days of muscle-strengthening. You can start with much less.',
  'Many people find a mix of walking, some strength work and calming movement useful. No single type is proven best.',
];

const List<String> moveFocusPcod = <String>[
  'A common general guideline for adults is about 150 minutes of moderate activity a week. You can start with much less.',
  'Regular walking, light strength work and yoga are popular choices. Gentle, regular movement matters more than hard sessions.',
];

const String moveSharedNote =
    'More is not always better. Rest days are part of a healthy week. Stop and check with a doctor if you feel pain, dizziness or unwell.';

const String yogaNote =
    'Yoga can help many people feel calmer and move gently. Research on yoga for PCOS is still small, so think of it as one helpful habit, not a treatment.';

List<String> moveFocusFor(Condition? c) => c == Condition.pcod ? moveFocusPcod : moveFocusPcos;

// ---------------------------------------------------------------- myths and facts

enum AppliesTo { pcos, pcod, both }

class Myth {
  final AppliesTo appliesTo;
  final String myth;
  final String fact;
  const Myth(this.appliesTo, this.myth, this.fact);
}

/// General education only. Unreviewed: needs clinician review before release.
const List<Myth> myths = <Myth>[
  Myth(AppliesTo.both, 'PCOS or PCOD means you have cysts on your ovaries that must be removed.',
      'The name can be misleading. The small follicles seen on scans are not usually harmful cysts, and surgery is not the usual treatment. A doctor can explain what is right for you.'),
  Myth(AppliesTo.both, 'Only people who are overweight get PCOS or PCOD.', 'It can affect people of many body sizes, including people who are slim.'),
  Myth(AppliesTo.pcos, 'Everyone with PCOS has the same symptoms.', 'Symptoms differ a lot from person to person. Some people have irregular periods, some do not.'),
  Myth(AppliesTo.both, 'PCOS or PCOD means you can never have a baby.',
      'Ovulation can be irregular, and some people need medical support, but many people with PCOS or PCOD do become pregnant.'),
  Myth(AppliesTo.both, 'Birth control pills cure it.', 'There is no cure. Treatments help manage symptoms, and the right choice is something to talk through with a doctor.'),
  Myth(AppliesTo.both, 'It is your fault.', 'The exact cause is not fully known. Genes and hormones play a part. It is not caused by anything you did wrong.'),
  Myth(AppliesTo.pcod, 'PCOD is a serious disease that cannot be managed.', 'Many people manage PCOD well with regular habits and check-ups. A doctor can guide you.'),
  Myth(AppliesTo.pcod, 'Skipping meals or crash dieting will fix PCOD.',
      'Crash diets can upset your body and mood. Regular, balanced meals and steady habits are gentler and work better.'),
  Myth(AppliesTo.pcod, 'Irregular periods are normal, so there is no need to see a doctor.',
      'Irregular periods are common with PCOD, but it is still worth checking with a doctor, especially if periods are very painful, very heavy or missing.'),
  Myth(AppliesTo.pcos, 'PCOS only affects periods and fertility.',
      'PCOS can also affect skin, hair, mood, sleep and how the body uses sugar, which is why regular check-ups help.'),
  Myth(AppliesTo.pcos, 'If your periods become regular, PCOS is gone.', 'PCOS is long-term. Symptoms can improve, but it still needs a check-up from time to time.'),
  Myth(AppliesTo.both, 'PCOS and PCOD are two totally different diseases, or exactly the same thing.',
      'The terms overlap, and doctors use them differently. Ask your own doctor what they mean for you.'),
];

List<Myth> mythsFor(Condition? c) {
  if (c == Condition.pcos) return myths.where((m) => m.appliesTo != AppliesTo.pcod).toList();
  if (c == Condition.pcod) return myths.where((m) => m.appliesTo != AppliesTo.pcos).toList();
  return myths.toList();
}

/// Every line a person reads here, so tests can check the tone.
List<String> allConditionTexts() => <String>[
      termsNote,
      aboutPcos.title,
      ...aboutPcos.points,
      aboutPcod.title,
      ...aboutPcod.points,
      for (final Difference d in differences) ...<String>[d.aspect, d.pcos, d.pcod],
      differencesNote,
      ...checkupQuestionsPcos,
      ...checkupQuestionsPcod,
      ...sharedQuestions,
      ...foodFocusPcos,
      ...foodFocusPcod,
      foodSharedNote,
      ...moveFocusPcos,
      ...moveFocusPcod,
      moveSharedNote,
      yogaNote,
      for (final Myth m in myths) ...<String>[m.myth, m.fact],
    ];
