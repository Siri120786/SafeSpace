// Physical Exercise module: daily activity minutes, yoga minutes and a weekly workout plan.
// Pure logic. Mirrors apps/web/src/features/wellness-modules/lib/exercise.ts.
//
// Safeguards (over-exercising is also a risk when food and body are on someone's mind): the app
// never counts calories burned or links movement to weight, the weekly goal is optional and set by
// the person, rest days are part of the plan, the character never shames a quiet day, and a very
// long day gets a gentle "rest matters" note. Wording is unreviewed (docs/content-needing-review.md).
import 'diet_plan.dart' show Stance, dateKey;

enum ActivityType { walk, yoga, strength, cardio, other }

const Map<ActivityType, String> activityLabels = <ActivityType, String>{
  ActivityType.walk: 'Walking',
  ActivityType.yoga: 'Yoga',
  ActivityType.strength: 'Strength',
  ActivityType.cardio: 'Cardio',
  ActivityType.other: 'Other',
};

class LogEntry {
  /// Local date "YYYY-MM-DD".
  final String date;
  final ActivityType type;
  final int minutes;
  const LogEntry(this.date, this.type, this.minutes);
}

class PlannedDay {
  final ActivityType type;
  final int minutes;
  const PlannedDay(this.type, this.minutes);
}

/// Weekday index 0 = Monday ... 6 = Sunday. A missing day is a rest day.
typedef WeekPlan = Map<int, PlannedDay>;

class ExerciseState {
  final List<LogEntry> log;
  final WeekPlan plan;

  /// Optional weekly minutes goal chosen by the person, or null for none.
  final int? weeklyGoal;
  const ExerciseState(this.log, this.plan, this.weeklyGoal);

  factory ExerciseState.empty() => const ExerciseState(<LogEntry>[], <int, PlannedDay>{}, null);

  ExerciseState copyWith({List<LogEntry>? log, WeekPlan? plan, Object? weeklyGoal = _keep}) =>
      ExerciseState(log ?? this.log, plan ?? this.plan, identical(weeklyGoal, _keep) ? this.weeklyGoal : weeklyGoal as int?);
}

const Object _keep = Object();

const List<String> weekdays = <String>['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const int maxEntryMinutes = 300;
const int longDayMinutes = 180;
const int maxGoalMinutes = 1000;
const int maxLogEntries = 400;
const int _keepDays = 120;

const String restNote = 'Rest days are part of a healthy week. A day off is not a missed day.';
const String longDayNote = 'That is a lot of movement for one day. Rest matters too. Stop and check with a doctor if you feel pain, dizziness or unwell.';

class ExResult {
  final ExerciseState? state;
  final String? error;
  const ExResult.ok(ExerciseState this.state) : error = null;
  const ExResult.fail(String this.error) : state = null;
}

// ---------------------------------------------------------------- dates

String _addDays(String key, int delta) {
  final List<int> p = key.split('-').map(int.parse).toList();
  return dateKey(DateTime(p[0], p[1], p[2] + delta));
}

/// Monday = 0 ... Sunday = 6 for a date key.
int weekdayIndex(String key) {
  final List<int> p = key.split('-').map(int.parse).toList();
  return DateTime(p[0], p[1], p[2]).weekday - 1;
}

/// The seven date keys of the week (Monday to Sunday) that contains [today].
List<String> weekDates(String today) {
  final String monday = _addDays(today, -weekdayIndex(today));
  return <String>[for (int i = 0; i < 7; i++) _addDays(monday, i)];
}

// ---------------------------------------------------------------- logging

int? parseMinutes(String text) {
  final String t = text.trim();
  if (!RegExp(r'^\d{1,3}$').hasMatch(t)) return null;
  final int n = int.parse(t);
  return (n >= 1 && n <= maxEntryMinutes) ? n : null;
}

ExResult addEntry(ExerciseState s, String date, ActivityType type, int minutes) {
  if (minutes < 1 || minutes > maxEntryMinutes) return const ExResult.fail('Please enter minutes between 1 and $maxEntryMinutes.');
  if (s.log.length >= maxLogEntries) return const ExResult.fail('The log is full. Remove an old entry first.');
  final String oldest = _addDays(date, -_keepDays);
  final List<LogEntry> log = <LogEntry>[...s.log, LogEntry(date, type, minutes)].where((e) => e.date.compareTo(oldest) >= 0).toList();
  return ExResult.ok(s.copyWith(log: log));
}

ExerciseState removeEntry(ExerciseState s, int index) => s.copyWith(log: <LogEntry>[
      for (int i = 0; i < s.log.length; i++)
        if (i != index) s.log[i],
    ]);

List<LogEntry> entriesOn(ExerciseState s, String date) => s.log.where((e) => e.date == date).toList();

int minutesOn(ExerciseState s, String date, [ActivityType? type]) =>
    s.log.where((e) => e.date == date && (type == null || e.type == type)).fold<int>(0, (sum, e) => sum + e.minutes);

class WeekSummary {
  final int totalMinutes;
  final int yogaMinutes;
  final int daysActive;
  final Map<ActivityType, int> byType;
  const WeekSummary(this.totalMinutes, this.yogaMinutes, this.daysActive, this.byType);
}

WeekSummary summarizeWeek(ExerciseState s, String today) {
  final Set<String> dates = weekDates(today).toSet();
  final List<LogEntry> inWeek = s.log.where((e) => dates.contains(e.date)).toList();
  final Map<ActivityType, int> byType = <ActivityType, int>{for (final ActivityType t in ActivityType.values) t: 0};
  for (final LogEntry e in inWeek) {
    byType[e.type] = byType[e.type]! + e.minutes;
  }
  return WeekSummary(inWeek.fold<int>(0, (a, e) => a + e.minutes), byType[ActivityType.yoga]!, inWeek.map((e) => e.date).toSet().length, byType);
}

bool isLongDay(ExerciseState s, String date) => minutesOn(s, date) > longDayMinutes;

// ---------------------------------------------------------------- weekly plan and goal

ExResult setPlanDay(ExerciseState s, int weekday, PlannedDay? planned) {
  if (weekday < 0 || weekday > 6) return const ExResult.fail('Please pick a day.');
  final WeekPlan plan = <int, PlannedDay>{...s.plan};
  if (planned == null) {
    plan.remove(weekday);
  } else {
    if (planned.minutes < 1 || planned.minutes > maxEntryMinutes) return const ExResult.fail('Please enter minutes between 1 and $maxEntryMinutes.');
    plan[weekday] = planned;
  }
  return ExResult.ok(s.copyWith(plan: plan));
}

enum PlanStatus { rest, todo, partly, done }

/// A planned day is done when enough of the planned activity was logged on that date.
PlanStatus planStatus(ExerciseState s, String date) {
  final PlannedDay? planned = s.plan[weekdayIndex(date)];
  if (planned == null) return PlanStatus.rest;
  final int got = minutesOn(s, date, planned.type);
  if (got >= planned.minutes) return PlanStatus.done;
  return got > 0 ? PlanStatus.partly : PlanStatus.todo;
}

int plannedMinutesPerWeek(WeekPlan plan) => plan.values.fold<int>(0, (a, d) => a + d.minutes);

ExResult setWeeklyGoal(ExerciseState s, String text) {
  final String t = text.trim();
  if (t.isEmpty) return ExResult.ok(s.copyWith(weeklyGoal: null));
  if (!RegExp(r'^\d{1,4}$').hasMatch(t)) return const ExResult.fail('Please enter a number of minutes, or leave it blank for no goal.');
  final int n = int.parse(t);
  if (n < 10 || n > maxGoalMinutes) return const ExResult.fail('Please choose between 10 and $maxGoalMinutes minutes, or leave it blank.');
  return ExResult.ok(s.copyWith(weeklyGoal: n));
}

/// A neutral sentence about the week. No ranking, no "behind", no body talk.
String weekMessage(ExerciseState s, String today) {
  final WeekSummary w = summarizeWeek(s, today);
  if (w.totalMinutes == 0) return 'Nothing logged this week yet. Even a short stretch counts when you are ready.';
  final String base = 'This week you moved for ${w.totalMinutes} minutes on ${w.daysActive} ${w.daysActive == 1 ? 'day' : 'days'}.';
  final String yoga = w.yogaMinutes > 0 ? ' ${w.yogaMinutes} of those were yoga.' : '';
  if (s.weeklyGoal != null && w.totalMinutes >= s.weeklyGoal!) return '$base$yoga You reached the goal you set. Well done!';
  if (s.weeklyGoal != null) return '$base$yoga Your own goal is ${s.weeklyGoal} minutes. Go at your own pace.';
  return '$base$yoga';
}

class ExReaction {
  final Stance stance;
  final String text;
  const ExReaction(this.stance, this.text);
}

/// What the character says about today's movement. Always kind.
ExReaction exerciseReaction(ExerciseState s, String today, int hour) {
  final PlanStatus status = planStatus(s, today);
  final int todayMin = minutesOn(s, today);
  if (isLongDay(s, today)) return const ExReaction(Stance.meditating, 'That was a lot of movement today. Time to rest and stretch gently.');
  if (status == PlanStatus.done) return const ExReaction(Stance.celebrating, 'Yayyy! You finished today\'s workout. You did great!');
  if (status == PlanStatus.partly || (status == PlanStatus.rest && todayMin > 0)) {
    return ExReaction(Stance.happy, 'Nice! $todayMin minutes of movement today. Keep going at your own pace.');
  }
  if (status == PlanStatus.rest) return const ExReaction(Stance.meditating, 'Today is a rest day. Resting is part of the plan.');
  if (hour >= 18) return const ExReaction(Stance.waving, 'Hey, even a short stretch or a few minutes of yoga counts today.');
  return const ExReaction(Stance.waving, 'Good to see you! Log your movement when you are done.');
}

List<String> allExerciseLines() {
  const String monday = '2026-10-26';
  final WeekPlan plan = <int, PlannedDay>{0: const PlannedDay(ActivityType.walk, 20)};
  final ExerciseState base = ExerciseState(const <LogEntry>[], plan, 100);
  ExerciseState withLog(int m) => ExerciseState(<LogEntry>[LogEntry(monday, ActivityType.walk, m)], plan, 100);
  return <String>[
    restNote,
    longDayNote,
    for (final int hour in <int>[9, 20])
      for (final ExerciseState s in <ExerciseState>[base, withLog(10), withLog(20), withLog(200), const ExerciseState(<LogEntry>[], <int, PlannedDay>{}, 100)]) exerciseReaction(s, monday, hour).text,
    weekMessage(base, monday),
    weekMessage(withLog(20), monday),
    weekMessage(withLog(120), monday),
    weekMessage(withLog(20).copyWith(weeklyGoal: null), monday),
  ];
}

// ---------------------------------------------------------------- storage shape

Map<String, dynamic> exerciseToJson(ExerciseState s) => <String, dynamic>{
      'log': <Map<String, dynamic>>[for (final LogEntry e in s.log) <String, dynamic>{'date': e.date, 'type': e.type.name, 'minutes': e.minutes}],
      'plan': <String, dynamic>{for (final MapEntry<int, PlannedDay> e in s.plan.entries) '${e.key}': <String, dynamic>{'type': e.value.type.name, 'minutes': e.value.minutes}},
      'weeklyGoal': s.weeklyGoal,
    };

final RegExp _dateRe = RegExp(r'^\d{4}-\d{2}-\d{2}$');

ActivityType? _type(Object? n) {
  for (final ActivityType t in ActivityType.values) {
    if (t.name == n) return t;
  }
  return null;
}

/// Accepts whatever was stored and returns a safe state.
ExerciseState exerciseFromJson(Object? raw) {
  if (raw is! Map) return ExerciseState.empty();
  final List<LogEntry> log = <LogEntry>[];
  if (raw['log'] is List) {
    for (final Object? e in raw['log'] as List) {
      if (e is Map && e['date'] is String && _dateRe.hasMatch(e['date'] as String) && _type(e['type']) != null && e['minutes'] is int) {
        final int m = e['minutes'] as int;
        if (m >= 1 && m <= maxEntryMinutes) log.add(LogEntry(e['date'] as String, _type(e['type'])!, m));
      }
    }
  }
  final WeekPlan plan = <int, PlannedDay>{};
  if (raw['plan'] is Map) {
    (raw['plan'] as Map).forEach((Object? k, Object? v) {
      final int? i = k is String ? int.tryParse(k) : null;
      if (i != null && i >= 0 && i <= 6 && v is Map && _type(v['type']) != null && v['minutes'] is int) {
        final int m = v['minutes'] as int;
        if (m >= 1 && m <= maxEntryMinutes) plan[i] = PlannedDay(_type(v['type'])!, m);
      }
    });
  }
  final Object? g = raw['weeklyGoal'];
  final int? goal = (g is int && g >= 10 && g <= maxGoalMinutes) ? g : null;
  return ExerciseState(log.length > maxLogEntries ? log.sublist(log.length - maxLogEntries) : log, plan, goal);
}
