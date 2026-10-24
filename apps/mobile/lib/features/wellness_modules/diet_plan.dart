// Cycle Care: diet plan, daily rewards and the character's reactions. Pure logic.
// Mirrors apps/web/src/features/wellness-modules/lib/dietPlan.ts.
//
// The plan is written by the person from what their doctor or dietitian told them. The app only
// offers general tips and meal ideas (unreviewed wording, see docs/content-needing-review.md).
// It never counts calories, sets a target weight or scores a body.
//
// Rewards: a star per ticked meal, a bonus for the whole plan, and a streak of complete days.
// Partial days still earn stars, and a day without a streak is never shown as a failure.

enum MealId { breakfast, lunch, snack, dinner }

const Map<MealId, String> mealLabels = <MealId, String>{
  MealId.breakfast: 'Breakfast',
  MealId.lunch: 'Lunch',
  MealId.snack: 'Snack',
  MealId.dinner: 'Dinner',
};

typedef DietPlan = Map<MealId, List<String>>;

DietPlan emptyPlan() => <MealId, List<String>>{for (final MealId m in MealId.values) m: <String>[]};

/// One day: how many meals were planned that day and how many were ticked.
class DayEntry {
  final int planned;
  final int done;
  const DayEntry(this.planned, this.done);
}

class DietState {
  final DietPlan plan;
  final Map<String, List<MealId>> ticks;
  final Map<String, DayEntry> days;
  final bool hideRewards;
  const DietState(this.plan, this.ticks, this.days, this.hideRewards);

  factory DietState.empty() => DietState(emptyPlan(), <String, List<MealId>>{}, <String, DayEntry>{}, false);

  DietState copyWith({DietPlan? plan, Map<String, List<MealId>>? ticks, Map<String, DayEntry>? days, bool? hideRewards}) =>
      DietState(plan ?? this.plan, ticks ?? this.ticks, days ?? this.days, hideRewards ?? this.hideRewards);
}

const List<String> generalGuidance = <String>[
  'Build meals around vegetables, dal or pulses, and whole grains such as millets, oats or brown rice.',
  'Pair carbohydrates with protein or healthy fats, for example roti with dal, or fruit with a handful of nuts.',
  'Choose fibre-rich foods like vegetables, fruit with skin, seeds and legumes.',
  'Try to eat at regular times instead of long gaps between meals.',
  'Sugary drinks and very processed snacks can be enjoyed less often.',
  'Healthy fats such as nuts, seeds, and curd or paneer in sensible amounts can fit in.',
];

const String guidanceNote = 'General information only, not medical advice. Please follow the plan your doctor or dietitian gives you.';

enum FoodPreference { vegetarian, eggetarian, nonVegetarian, vegan }

class MealIdea {
  final MealId meal;
  final String text;
  final Set<FoodPreference> suits;
  const MealIdea(this.meal, this.text, this.suits);
}

const Set<FoodPreference> _all = <FoodPreference>{FoodPreference.vegetarian, FoodPreference.eggetarian, FoodPreference.nonVegetarian, FoodPreference.vegan};
const Set<FoodPreference> _noMeat = <FoodPreference>{FoodPreference.vegetarian, FoodPreference.eggetarian, FoodPreference.nonVegetarian};
const Set<FoodPreference> _eggOk = <FoodPreference>{FoodPreference.eggetarian, FoodPreference.nonVegetarian};

const List<MealIdea> mealIdeas = <MealIdea>[
  MealIdea(MealId.breakfast, 'Vegetable oats upma', _all),
  MealIdea(MealId.breakfast, 'Besan chilla with mint chutney', _all),
  MealIdea(MealId.breakfast, 'Curd with fruit and seeds', _noMeat),
  MealIdea(MealId.breakfast, 'Vegetable omelette with a slice of whole grain toast', _eggOk),
  MealIdea(MealId.lunch, 'Roti, dal and a vegetable sabzi with salad', _all),
  MealIdea(MealId.lunch, 'Millet khichdi with vegetables', _all),
  MealIdea(MealId.lunch, 'Brown rice with sambar and a vegetable side', _all),
  MealIdea(MealId.lunch, 'Grilled fish or chicken with vegetables and roti', <FoodPreference>{FoodPreference.nonVegetarian}),
  MealIdea(MealId.snack, 'A handful of roasted chana', _all),
  MealIdea(MealId.snack, 'Fruit with a few almonds', _all),
  MealIdea(MealId.snack, 'Buttermilk with roasted seeds', _noMeat),
  MealIdea(MealId.dinner, 'Vegetable soup with paneer or tofu', _noMeat),
  MealIdea(MealId.dinner, 'Roti, mixed vegetable curry and dal', _all),
  MealIdea(MealId.dinner, 'Egg curry with vegetables and a small portion of rice', _eggOk),
];

List<MealIdea> mealIdeasFor(MealId meal, FoodPreference? preference) =>
    mealIdeas.where((i) => i.meal == meal && (preference == null || i.suits.contains(preference))).toList();

// ---------------------------------------------------------------- the plan

const int maxPlanItemsPerMeal = 8;
const int maxPlanItemLength = 100;

class PlanResult {
  final DietPlan? plan;
  final String? error;
  const PlanResult.ok(DietPlan this.plan) : error = null;
  const PlanResult.fail(String this.error) : plan = null;
}

PlanResult addPlanItem(DietPlan plan, MealId meal, String text) {
  final String t = text.trim();
  if (t.isEmpty) return const PlanResult.fail('Please type something first.');
  if (t.length > maxPlanItemLength) return const PlanResult.fail('Please keep it under $maxPlanItemLength characters.');
  final List<String> list = plan[meal]!;
  if (list.length >= maxPlanItemsPerMeal) return const PlanResult.fail('That meal is full. Remove one to add another.');
  if (list.any((x) => x.toLowerCase() == t.toLowerCase())) return const PlanResult.fail('That is already in this meal.');
  return PlanResult.ok(<MealId, List<String>>{...plan, meal: <String>[...list, t]});
}

DietPlan removePlanItem(DietPlan plan, MealId meal, int index) => <MealId, List<String>>{
      ...plan,
      meal: <String>[
        for (int i = 0; i < plan[meal]!.length; i++)
          if (i != index) plan[meal]![i],
      ],
    };

List<MealId> plannedMeals(DietPlan plan) => MealId.values.where((m) => plan[m]!.isNotEmpty).toList();

// ---------------------------------------------------------------- days, stars, streaks

String dateKey(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String _addDays(String key, int delta) {
  final List<int> p = key.split('-').map(int.parse).toList();
  return dateKey(DateTime(p[0], p[1], p[2] + delta));
}

/// Re-counts a day from the current plan and ticks. Call after the plan changes too.
DietState refreshDay(DietState s, String today) {
  final List<MealId> planned = plannedMeals(s.plan);
  final int done = (s.ticks[today] ?? <MealId>[]).where(planned.contains).length;
  return s.copyWith(days: <String, DayEntry>{...s.days, today: DayEntry(planned.length, done)});
}

/// Ticks a meal on or off for a day. Meals with nothing planned are ignored.
DietState toggleMeal(DietState s, MealId meal, String today) {
  if (s.plan[meal]!.isEmpty) return s;
  final List<MealId> ticked = s.ticks[today] ?? <MealId>[];
  final List<MealId> next = ticked.contains(meal) ? ticked.where((m) => m != meal).toList() : <MealId>[...ticked, meal];
  return refreshDay(s.copyWith(ticks: <String, List<MealId>>{...s.ticks, today: next}), today);
}

bool isCompleteDay(DayEntry? e) => e != null && e.planned > 0 && e.done >= e.planned;

/// One star per ticked meal, plus one bonus for finishing the whole plan.
int starsForDay(DayEntry? e) => (e == null || e.planned == 0) ? 0 : e.done + (isCompleteDay(e) ? 1 : 0);

int totalStars(Map<String, DayEntry> days) => days.values.fold<int>(0, (sum, e) => sum + starsForDay(e));

/// Days in a row with the whole plan ticked. An unfinished today does not erase yesterday's run.
int currentStreak(Map<String, DayEntry> days, String today) {
  String day = isCompleteDay(days[today]) ? today : _addDays(today, -1);
  int n = 0;
  while (isCompleteDay(days[day])) {
    n++;
    day = _addDays(day, -1);
  }
  return n;
}

int bestStreak(Map<String, DayEntry> days) {
  final List<String> keys = days.keys.where((k) => isCompleteDay(days[k])).toList()..sort();
  int best = 0;
  int run = 0;
  String? prev;
  for (final String k in keys) {
    run = (prev != null && _addDays(prev, 1) == k) ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  }
  return best;
}

// ---------------------------------------------------------------- the character

enum Stance { happy, meditating, waving, celebrating }

class Reaction {
  final Stance stance;
  final String text;
  const Reaction(this.stance, this.text);
}

/// What the character says. Always kind: it cheers progress and, when nothing is ticked late in
/// the day, gives a small nudge. It never shames, counts missed days or mentions the body.
Reaction characterReaction(DayEntry? entry, int hour, int streak) {
  if (entry == null || entry.planned == 0) {
    return const Reaction(Stance.waving, 'Hi! Add a few meals to your plan and I will cheer you on.');
  }
  if (isCompleteDay(entry)) {
    final String extra = streak >= 2 ? ' That is $streak days in a row!' : '';
    return Reaction(Stance.celebrating, 'Yayyy! You finished today\'s plan. You did great!$extra');
  }
  if (entry.done > 0) {
    return Reaction(Stance.happy, 'Nice work! ${entry.done} of ${entry.planned} meals done. Keep going at your own pace.');
  }
  if (hour >= 18) {
    return const Reaction(Stance.meditating, 'Hey, let\'s try to follow your plan with the next meal. A small step is okay.');
  }
  return const Reaction(Stance.waving, 'Good to see you! Tick a meal when you have had it.');
}

/// Every line the character can say, so tests can check the tone.
List<String> allCharacterLines() => <String>[
      for (final DayEntry? c in <DayEntry?>[null, const DayEntry(3, 3), const DayEntry(3, 1), const DayEntry(3, 0)])
        for (final int hour in <int>[9, 20])
          for (final int streak in <int>[0, 4]) characterReaction(c, hour, streak).text,
    ];

// ---------------------------------------------------------------- storage shape

String _prefName(FoodPreference p) => p.name;

Map<String, dynamic> stateToJson(DietState s) => <String, dynamic>{
      'plan': <String, dynamic>{for (final MealId m in MealId.values) m.name: s.plan[m]},
      'ticks': <String, dynamic>{for (final MapEntry<String, List<MealId>> e in s.ticks.entries) e.key: e.value.map((m) => m.name).toList()},
      'days': <String, dynamic>{for (final MapEntry<String, DayEntry> e in s.days.entries) e.key: <String, int>{'planned': e.value.planned, 'done': e.value.done}},
      'hideRewards': s.hideRewards,
    };

final RegExp _dateRe = RegExp(r'^\d{4}-\d{2}-\d{2}$');

/// Accepts whatever was stored and returns a safe state; bad or old data falls back to empty.
DietState stateFromJson(Object? raw) {
  if (raw is! Map) return DietState.empty();
  final DietPlan plan = emptyPlan();
  final Object? rawPlan = raw['plan'];
  if (rawPlan is Map) {
    for (final MealId m in MealId.values) {
      final Object? list = rawPlan[m.name];
      if (list is List) {
        plan[m] = list.whereType<String>().where((x) => x.isNotEmpty && x.length <= maxPlanItemLength).take(maxPlanItemsPerMeal).toList();
      }
    }
  }
  final Map<String, List<MealId>> ticks = <String, List<MealId>>{};
  final Object? rawTicks = raw['ticks'];
  if (rawTicks is Map) {
    rawTicks.forEach((Object? k, Object? v) {
      if (k is String && _dateRe.hasMatch(k) && v is List) {
        ticks[k] = v.whereType<String>().map((n) => MealId.values.where((m) => m.name == n)).expand((x) => x).toList();
      }
    });
  }
  final Map<String, DayEntry> days = <String, DayEntry>{};
  final Object? rawDays = raw['days'];
  if (rawDays is Map) {
    rawDays.forEach((Object? k, Object? v) {
      if (k is String && _dateRe.hasMatch(k) && v is Map && v['planned'] is int && v['done'] is int) {
        final int p = v['planned'] as int;
        final int d = v['done'] as int;
        if (p >= 0 && p <= 4 && d >= 0 && d <= p) days[k] = DayEntry(p, d);
      }
    });
  }
  return DietState(plan, ticks, days, raw['hideRewards'] == true);
}

String preferenceId(FoodPreference? p) => p == null ? '' : _prefName(p);
