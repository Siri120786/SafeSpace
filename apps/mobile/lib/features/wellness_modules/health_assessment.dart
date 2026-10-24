// Cycle Care: personal health profile ("assessment") and its private summary. Pure logic.
// Mirrors apps/web/src/features/wellness-modules/lib/healthAssessment.ts.
//
// Every field is optional and skippable. The summary is for the person to bring to a doctor or
// dietitian. The app does NOT calculate BMI, set a target weight, score answers or give medical
// advice. Food preferences only filter the meal ideas in the diet plan. Physical activity and
// sleep/stress are covered elsewhere in Cycle Care, so they are not asked here.
// Wording is unreviewed (docs/content-needing-review.md).
import 'diet_plan.dart';

class Choice {
  final String id;
  final String label;
  const Choice(this.id, this.label);
}

const List<Choice> cycleOptions = <Choice>[
  Choice('regular', 'Mostly regular'),
  Choice('irregular', 'Irregular'),
  Choice('rare', 'Very infrequent'),
  Choice('absent', 'No periods lately'),
  Choice('unsure', 'Not sure'),
];

const List<Choice> historyOptions = <Choice>[
  Choice('pcos', 'PCOS/PCOD diagnosed by a doctor'),
  Choice('thyroid', 'Thyroid condition'),
  Choice('sugar', 'High blood sugar or diabetes'),
  Choice('bp', 'High blood pressure'),
  Choice('cholesterol', 'High cholesterol'),
  Choice('family', 'Family history of diabetes'),
];

const List<Choice> eatingOptions = <Choice>[
  Choice('regular', 'I eat at fairly regular times'),
  Choice('skip', 'I often skip meals'),
  Choice('late', 'I eat late at night'),
  Choice('snack', 'I snack a lot between meals'),
  Choice('outside', 'I eat outside food often'),
  Choice('sweet', 'I crave sweet things'),
];

const List<Choice> needsOptions = <Choice>[
  Choice('lowsugar', 'Lower sugar, as advised by my doctor'),
  Choice('highprotein', 'Extra protein, as advised'),
  Choice('lactose', 'Lactose intolerance'),
  Choice('gluten', 'Gluten sensitivity'),
  Choice('iron', 'Iron or vitamin supplements, as advised'),
];

const Map<FoodPreference, String> preferenceLabels = <FoodPreference, String>{
  FoodPreference.vegetarian: 'Vegetarian',
  FoodPreference.eggetarian: 'Eggetarian',
  FoodPreference.nonVegetarian: 'Non-vegetarian',
  FoodPreference.vegan: 'Vegan',
};

const List<Choice> goalOptions = <Choice>[
  Choice('understand', 'Understand my condition better'),
  Choice('periods', 'More regular periods'),
  Choice('energy', 'More energy'),
  Choice('mood', 'A steadier mood'),
  Choice('sleep', 'Better sleep'),
  Choice('sugar', 'Steadier blood sugar, with my doctor'),
  Choice('skin', 'Skin and hair concerns'),
  Choice('pregnancy', 'Planning a pregnancy, with my doctor'),
  Choice('feelgood', 'Eating in a way that feels good'),
];

const int maxText = 200;

class Assessment {
  final String? cycle;
  final List<String> history;
  final String weightKg;
  final String waistCm;
  final String fastingGlucose;
  final String hba1c;
  final List<String> eating;
  final List<String> needs;
  final String allergies;
  final FoodPreference? preference;
  final String likes;
  final List<String> goals;
  final String goalNote;

  const Assessment({
    this.cycle,
    this.history = const <String>[],
    this.weightKg = '',
    this.waistCm = '',
    this.fastingGlucose = '',
    this.hba1c = '',
    this.eating = const <String>[],
    this.needs = const <String>[],
    this.allergies = '',
    this.preference,
    this.likes = '',
    this.goals = const <String>[],
    this.goalNote = '',
  });

  Assessment copyWith({
    Object? cycle = _keep,
    List<String>? history,
    String? weightKg,
    String? waistCm,
    String? fastingGlucose,
    String? hba1c,
    List<String>? eating,
    List<String>? needs,
    String? allergies,
    Object? preference = _keep,
    String? likes,
    List<String>? goals,
    String? goalNote,
  }) =>
      Assessment(
        cycle: identical(cycle, _keep) ? this.cycle : cycle as String?,
        history: history ?? this.history,
        weightKg: weightKg ?? this.weightKg,
        waistCm: waistCm ?? this.waistCm,
        fastingGlucose: fastingGlucose ?? this.fastingGlucose,
        hba1c: hba1c ?? this.hba1c,
        eating: eating ?? this.eating,
        needs: needs ?? this.needs,
        allergies: allergies ?? this.allergies,
        preference: identical(preference, _keep) ? this.preference : preference as FoodPreference?,
        likes: likes ?? this.likes,
        goals: goals ?? this.goals,
        goalNote: goalNote ?? this.goalNote,
      );
}

const Object _keep = Object();

class _Rule {
  final String label;
  final String unit;
  final double min;
  final double max;
  const _Rule(this.label, this.unit, this.min, this.max);
}

/// Empty is fine (skipped). Otherwise it must be a number in a believable range.
List<String> validateAssessment(Assessment a) {
  final List<String> errors = <String>[];
  final Map<String, List<Object>> numbers = <String, List<Object>>{
    'weight': <Object>[a.weightKg, const _Rule('Body weight', 'kg', 20, 300)],
    'waist': <Object>[a.waistCm, const _Rule('Waist', 'cm', 40, 200)],
    'glucose': <Object>[a.fastingGlucose, const _Rule('Fasting blood glucose', 'mg/dL', 40, 400)],
    'hba1c': <Object>[a.hba1c, const _Rule('HbA1c', '%', 3, 15)],
  };
  for (final List<Object> n in numbers.values) {
    final String v = (n[0] as String).trim();
    if (v.isEmpty) continue;
    final _Rule r = n[1] as _Rule;
    final double? x = double.tryParse(v);
    if (x == null || x < r.min || x > r.max) {
      errors.add('${r.label} should be a number between ${r.min.toInt()} and ${r.max.toInt()} ${r.unit}, or left blank.');
    }
  }
  for (final MapEntry<String, String> t in <String, String>{'Allergies': a.allergies, 'Likes and dislikes': a.likes, 'Goal note': a.goalNote}.entries) {
    if (t.value.length > maxText) errors.add('${t.key} should be under $maxText characters.');
  }
  return errors;
}

List<String> _labels(List<Choice> opts, List<String> ids) =>
    <String>[for (final String id in ids) ...opts.where((o) => o.id == id).map((o) => o.label)];

/// A plain list of what was answered, to show a doctor or dietitian. Skipped fields are left out.
List<String> buildSummary(Assessment a) {
  final List<String> out = <String>[];
  if (a.cycle != null) out.add('Periods: ${cycleOptions.firstWhere((o) => o.id == a.cycle).label.toLowerCase()}.');
  final List<String> history = _labels(historyOptions, a.history);
  if (history.isNotEmpty) out.add('Health history: ${history.join('; ')}.');
  if (a.weightKg.trim().isNotEmpty) out.add('Body weight: ${a.weightKg.trim()} kg.');
  if (a.waistCm.trim().isNotEmpty) out.add('Waist: ${a.waistCm.trim()} cm.');
  if (a.fastingGlucose.trim().isNotEmpty) out.add('Fasting blood glucose: ${a.fastingGlucose.trim()} mg/dL.');
  if (a.hba1c.trim().isNotEmpty) out.add('HbA1c: ${a.hba1c.trim()} %.');
  final List<String> eating = _labels(eatingOptions, a.eating);
  if (eating.isNotEmpty) out.add('Eating habits: ${eating.join('; ')}.');
  final List<String> needs = _labels(needsOptions, a.needs);
  if (needs.isNotEmpty) out.add('Nutrition needs: ${needs.join('; ')}.');
  if (a.allergies.trim().isNotEmpty) out.add('Allergies: ${a.allergies.trim()}.');
  if (a.preference != null) out.add('Food preference: ${preferenceLabels[a.preference]!.toLowerCase()}.');
  if (a.likes.trim().isNotEmpty) out.add('Likes and dislikes: ${a.likes.trim()}.');
  final List<String> goals = _labels(goalOptions, a.goals);
  if (goals.isNotEmpty) out.add('My goals: ${goals.join('; ')}.');
  if (a.goalNote.trim().isNotEmpty) out.add('In my own words: ${a.goalNote.trim()}.');
  return out;
}

const String summaryNote =
    'This is only a list of what you chose to share. It is not a diagnosis, score or advice. Bring it to your doctor or dietitian.';

const String profileNote =
    'Everything here is optional, so skip anything you like. It is saved on this device only, and you can clear it at any time.';

List<String> toggleChoice(List<String> list, String id) => list.contains(id) ? list.where((x) => x != id).toList() : <String>[...list, id];

Map<String, dynamic> assessmentToJson(Assessment a) => <String, dynamic>{
      'cycle': a.cycle,
      'history': a.history,
      'weightKg': a.weightKg,
      'waistCm': a.waistCm,
      'fastingGlucose': a.fastingGlucose,
      'hba1c': a.hba1c,
      'eating': a.eating,
      'needs': a.needs,
      'allergies': a.allergies,
      'preference': a.preference?.name,
      'likes': a.likes,
      'goals': a.goals,
      'goalNote': a.goalNote,
    };

/// Accepts whatever was stored and returns a safe assessment.
Assessment assessmentFromJson(Object? raw) {
  if (raw is! Map) return const Assessment();
  String str(String k) => raw[k] is String ? (raw[k] as String).substring(0, (raw[k] as String).length.clamp(0, maxText)) : '';
  List<String> ids(String k, List<Choice> opts) =>
      raw[k] is List ? (raw[k] as List).whereType<String>().where((x) => opts.any((o) => o.id == x)).toList() : <String>[];
  final String? cycle = cycleOptions.any((o) => o.id == raw['cycle']) ? raw['cycle'] as String : null;
  final FoodPreference? pref = FoodPreference.values.where((p) => p.name == raw['preference']).cast<FoodPreference?>().firstOrNull;
  return Assessment(
    cycle: cycle,
    history: ids('history', historyOptions),
    weightKg: str('weightKg'),
    waistCm: str('waistCm'),
    fastingGlucose: str('fastingGlucose'),
    hba1c: str('hba1c'),
    eating: ids('eating', eatingOptions),
    needs: ids('needs', needsOptions),
    allergies: str('allergies'),
    preference: pref,
    likes: str('likes'),
    goals: ids('goals', goalOptions),
    goalNote: str('goalNote'),
  );
}
