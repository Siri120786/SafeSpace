// PCOS / PCOD hub and its Physical Exercise and Food modules (Cycle Care is in module_screens.dart).
// Mirrors apps/web/src/features/wellness-modules/components/PcosScreens.tsx.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../auth/auth_provider.dart';
import '../calm_tools/low_sensory.dart';
import 'condition.dart';
import 'cycle_care_extras.dart';
import 'cycle_care_health.dart';
import 'diet_plan.dart' show dateKey;
import 'exercise.dart';
import 'module_content.dart';
import 'module_screens.dart';

const TextStyle _heading = TextStyle(fontSize: 20, fontWeight: FontWeight.w600);
const TextStyle _sub = TextStyle(fontSize: 16, fontWeight: FontWeight.w600);

Widget _card(List<Widget> children) => Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
      ),
    );

Widget _bulletList(Iterable<String> items) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[for (final String i in items) Text('• $i')],
    );

Widget _adultsOnly(String title, VoidCallback? onExit) => ModuleFrame(
      title: title,
      onExit: onExit,
      child: Card(child: Padding(padding: const EdgeInsets.all(20), child: Text('$title is for adult accounts only for now.'))),
    );

Widget _backToHub(BuildContext context) => Align(
      alignment: Alignment.centerLeft,
      child: TextButton(onPressed: () => context.go('/modules/pcos-pcod'), child: const Text('Back to PCOS / PCOD')),
    );

// ------------------------------------------------------------------ PCOS / PCOD hub

class PcosPcodHubScreen extends ConsumerStatefulWidget {
  /// Override for tests. Normally taken from the signed-in role.
  final String? role;
  final VoidCallback? onExit;
  const PcosPcodHubScreen({super.key, this.role, this.onExit});

  @override
  ConsumerState<PcosPcodHubScreen> createState() => _PcosPcodHubScreenState();
}

class _PcosPcodHubScreenState extends ConsumerState<PcosPcodHubScreen> {
  Condition? _condition;
  int _profileVersion = 0;

  @override
  void initState() {
    super.initState();
    loadCondition().then((c) {
      if (mounted) setState(() => _condition = c);
    });
  }

  void _choose(Condition c) {
    setState(() => _condition = c);
    saveCondition(c);
  }

  Future<void> _clearAll() async {
    await clearAllPcosData();
    if (!mounted) return;
    setState(() {
      _condition = null;
      _profileVersion++;
    });
  }

  Widget _space(BuildContext context, String name, String blurb, String path) => Card(
        child: ListTile(
          title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(blurb),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => context.push(path),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final String? role = widget.role ?? ref.watch(authProvider).role;
    if (!canOpenCycleCare(role)) return _adultsOnly('PCOS / PCOD', widget.onExit);
    final List<AboutBlock> about = _condition == Condition.pcos
        ? <AboutBlock>[aboutPcos]
        : _condition == Condition.pcod
            ? <AboutBlock>[aboutPcod]
            : <AboutBlock>[aboutPcos, aboutPcod];
    final String mythsTitle = _condition == Condition.pcos
        ? 'PCOS myths and facts'
        : _condition == Condition.pcod
            ? 'PCOD myths and facts'
            : 'PCOS and PCOD myths and facts';
    return ModuleFrame(
      title: 'PCOS / PCOD',
      onExit: widget.onExit,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _card(<Widget>[
            const Text('What does your doctor call it?', style: _heading),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: <Widget>[
                for (final Condition c in Condition.values) ChoiceChip(label: Text(conditionLabels[c]!), selected: _condition == c, onSelected: (_) => _choose(c)),
              ],
            ),
            const SizedBox(height: 8),
            const Text(termsNote),
          ]),
          for (final AboutBlock a in about) _card(<Widget>[Text(a.title, style: _heading), const SizedBox(height: 8), _bulletList(a.points)]),
          _card(<Widget>[
            const Text('PCOD and PCOS at a glance', style: _heading),
            const SizedBox(height: 8),
            for (final Difference d in differences)
              ExpansionTile(
                title: Text(d.aspect),
                childrenPadding: const EdgeInsets.all(12),
                expandedAlignment: Alignment.centerLeft,
                children: <Widget>[Text('PCOS: ${d.pcos}'), const SizedBox(height: 4), Text('PCOD: ${d.pcod}')],
              ),
            const Text(differencesNote),
          ]),
          const SizedBox(height: 8),
          const Text('Your care spaces', style: _heading),
          _space(context, 'Cycle Care', 'Check-ins, medicine notes and reminders, doctor-visit prep.', '/modules/pcos-pcod/cycle-care'),
          _space(context, 'Physical Exercise', 'Daily minutes, yoga time and a weekly workout plan.', '/modules/pcos-pcod/exercise'),
          _space(context, 'Food', 'Diet plan, rewards, water and meal ideas.', '/modules/pcos-pcod/food'),
          HealthSections(key: ValueKey<int>(_profileVersion), lowSensory: false, showDiet: false, showProfile: true, condition: _condition),
          _card(<Widget>[
            Text(mythsTitle, style: _heading),
            const SizedBox(height: 8),
            for (final Myth m in mythsFor(_condition))
              ExpansionTile(
                title: Text('Myth: ${m.myth}'),
                childrenPadding: const EdgeInsets.all(12),
                expandedAlignment: Alignment.centerLeft,
                children: <Widget>[Text('Fact: ${m.fact}')],
              ),
            const Text(mythsNote),
          ]),
          _card(<Widget>[
            const Text('Your choices, diet plan, movement and health profile are kept on this device only, not in your account.'),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: _clearAll, child: const Text('Clear all my PCOS / PCOD data')),
          ]),
          const SizedBox(height: 8),
          const ModuleNotes(extra: 'There is no cycle tracking in this version. Always follow your own doctor\'s advice.'),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------------ Food

class FoodScreen extends ConsumerStatefulWidget {
  final String? role;
  final VoidCallback? onExit;
  const FoodScreen({super.key, this.role, this.onExit});

  @override
  ConsumerState<FoodScreen> createState() => _FoodScreenState();
}

class _FoodScreenState extends ConsumerState<FoodScreen> {
  Condition? _condition;

  @override
  void initState() {
    super.initState();
    loadCondition().then((c) {
      if (mounted) setState(() => _condition = c);
    });
  }

  @override
  Widget build(BuildContext context) {
    final String? role = widget.role ?? ref.watch(authProvider).role;
    if (!canOpenCycleCare(role)) return _adultsOnly('Food', widget.onExit);
    return ModuleFrame(
      title: 'Food',
      onExit: widget.onExit,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _backToHub(context),
          HealthSections(lowSensory: watchLowSensory(context, ref).lowSensory, showDiet: true, showProfile: false, condition: _condition),
          const WaterTallyCard(),
          const SizedBox(height: 8),
          const ModuleNotes(extra: 'Always follow the eating plan your own doctor or dietitian gives you.'),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------------ Physical Exercise

class PhysicalExerciseScreen extends ConsumerStatefulWidget {
  final String? role;
  final VoidCallback? onExit;
  const PhysicalExerciseScreen({super.key, this.role, this.onExit});

  @override
  ConsumerState<PhysicalExerciseScreen> createState() => _PhysicalExerciseScreenState();
}

class _PhysicalExerciseScreenState extends ConsumerState<PhysicalExerciseScreen> {
  Condition? _condition;
  ExerciseState _state = ExerciseState.empty();
  ActivityType _type = ActivityType.walk;
  String? _error;
  bool _saveFailed = false;
  final TextEditingController _minutes = TextEditingController();
  final TextEditingController _goal = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _minutes.dispose();
    _goal.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final Condition? c = await loadCondition();
    ExerciseState s = ExerciseState.empty();
    try {
      final SharedPreferences p = await SharedPreferences.getInstance();
      final String? raw = p.getString(exercisePrefsKey);
      if (raw != null) s = exerciseFromJson(jsonDecode(raw));
    } catch (_) {
      // starts empty
    }
    if (mounted) {
      setState(() {
        _condition = c;
        _state = s;
      });
    }
  }

  Future<void> _save() async {
    try {
      final SharedPreferences p = await SharedPreferences.getInstance();
      await p.setString(exercisePrefsKey, jsonEncode(exerciseToJson(_state)));
      if (mounted && _saveFailed) setState(() => _saveFailed = false);
    } catch (_) {
      if (mounted) setState(() => _saveFailed = true);
    }
  }

  void _apply(ExResult r) {
    setState(() => _error = r.error);
    if (r.state != null) {
      setState(() => _state = r.state!);
      _save();
    }
  }

  void _log(ActivityType t, int? minutes) {
    if (minutes == null) {
      setState(() => _error = 'Please enter minutes between 1 and $maxEntryMinutes.');
      return;
    }
    _apply(addEntry(_state, dateKey(DateTime.now()), t, minutes));
    _minutes.clear();
  }

  void _changePlan(int day, ActivityType? t, int minutes) =>
      _apply(setPlanDay(_state, day, t == null ? null : PlannedDay(t, minutes)));

  @override
  Widget build(BuildContext context) {
    final String? role = widget.role ?? ref.watch(authProvider).role;
    if (!canOpenCycleCare(role)) return _adultsOnly('Physical Exercise', widget.onExit);
    final String today = dateKey(DateTime.now());
    final WeekSummary week = summarizeWeek(_state, today);
    final ExReaction reaction = exerciseReaction(_state, today, DateTime.now().hour);
    final List<String> dates = weekDates(today);
    final List<LogEntry> todays = entriesOn(_state, today);

    return ModuleFrame(
      title: 'Physical Exercise',
      onExit: widget.onExit,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _backToHub(context),
          _card(<Widget>[Center(child: CoachCharacter(stance: reaction.stance, text: reaction.text, lowSensory: watchLowSensory(context, ref).lowSensory))]),
          _card(<Widget>[
            const Text('Movement for your condition', style: _heading),
            const SizedBox(height: 8),
            _bulletList(moveFocusFor(_condition)),
            const SizedBox(height: 8),
            const Text(moveSharedNote, style: TextStyle(color: Colors.black54)),
          ]),
          const MovementPickerCard(),
          _card(<Widget>[
            const Text('Today\'s movement', style: _heading),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: <Widget>[
                for (final ActivityType a in ActivityType.values) ChoiceChip(label: Text(activityLabels[a]!), selected: _type == a, onSelected: (_) => setState(() => _type = a)),
              ],
            ),
            TextField(controller: _minutes, keyboardType: TextInputType.number, maxLength: 3, decoration: const InputDecoration(labelText: 'Minutes')),
            FilledButton(onPressed: () => _log(_type, parseMinutes(_minutes.text)), child: const Text('Add to today')),
            if (_error != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(_error!, style: const TextStyle(color: Colors.red))),
            for (final LogEntry e in todays)
              Row(
                children: <Widget>[
                  Expanded(child: Text('${activityLabels[e.type]} · ${e.minutes} min')),
                  TextButton(
                    onPressed: () {
                      setState(() => _state = removeEntry(_state, _state.log.indexOf(e)));
                      _save();
                    },
                    child: Text('Remove', semanticsLabel: 'Remove ${activityLabels[e.type]} ${e.minutes} minutes'),
                  ),
                ],
              ),
            const SizedBox(height: 8),
            Text('Today: ${minutesOn(_state, today)} minutes'),
            if (isLongDay(_state, today)) const Padding(padding: EdgeInsets.only(top: 4), child: Text(longDayNote)),
          ]),
          _card(<Widget>[
            const Text('Yoga time', style: _heading),
            const SizedBox(height: 4),
            const Text('Tap to add a yoga session to today.'),
            Wrap(
              spacing: 8,
              children: <Widget>[for (final int m in <int>[10, 20, 30]) ActionChip(label: Text('$m min yoga'), onPressed: () => _log(ActivityType.yoga, m))],
            ),
            const SizedBox(height: 8),
            Text('Yoga today: ${minutesOn(_state, today, ActivityType.yoga)} min · this week: ${week.yogaMinutes} min'),
            const SizedBox(height: 4),
            const Text(yogaNote, style: TextStyle(color: Colors.black54)),
          ]),
          _card(<Widget>[
            const Text('My weekly workout plan', style: _heading),
            const SizedBox(height: 4),
            const Text('Plan each day, or choose Rest. The plan repeats every week and ticks itself when you log enough minutes.'),
            for (int i = 0; i < 7; i++) _planRow(i, dates[i], today),
            const SizedBox(height: 8),
            const Text(restNote, style: TextStyle(color: Colors.black54)),
          ]),
          _card(<Widget>[
            const Text('This week', style: _heading),
            const SizedBox(height: 8),
            Text(weekMessage(_state, today)),
            for (final ActivityType a in ActivityType.values)
              if (week.byType[a]! > 0) Text('${activityLabels[a]}: ${week.byType[a]} min'),
            TextField(
              controller: _goal,
              keyboardType: TextInputType.number,
              maxLength: 4,
              decoration: InputDecoration(labelText: 'My own weekly minutes goal (optional, leave blank for none)', hintText: _state.weeklyGoal?.toString()),
            ),
            OutlinedButton(
              onPressed: () {
                _apply(setWeeklyGoal(_state, _goal.text));
                _goal.clear();
              },
              child: const Text('Save goal'),
            ),
            const SizedBox(height: 8),
            Text(
              'Your movement is saved on this device only, not in your account. SafeSpace does not count calories burned or link movement to weight.${_saveFailed ? ' This device is not allowing saving, so it will be lost when you leave.' : ''}',
              style: const TextStyle(color: Colors.black54),
            ),
          ]),
          const SizedBox(height: 8),
          const ModuleNotes(extra: 'Always follow your own doctor\'s advice about exercise.'),
        ],
      ),
    );
  }

  Widget _planRow(int i, String date, String today) {
    final PlannedDay? planned = _state.plan[i];
    final PlanStatus status = planStatus(_state, date);
    final String label = status == PlanStatus.rest ? 'Rest' : status == PlanStatus.done ? 'Done' : status == PlanStatus.partly ? 'Started' : 'To do';
    return Card(
      margin: const EdgeInsets.only(top: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(child: Text('${weekdays[i]}${date == today ? ' (today)' : ''}', style: _sub)),
                Text(label),
              ],
            ),
            Row(
              children: <Widget>[
                Expanded(
                  child: DropdownButton<ActivityType?>(
                    isExpanded: true,
                    value: planned?.type,
                    hint: const Text('Rest'),
                    items: <DropdownMenuItem<ActivityType?>>[
                      const DropdownMenuItem<ActivityType?>(value: null, child: Text('Rest')),
                      for (final ActivityType a in ActivityType.values) DropdownMenuItem<ActivityType?>(value: a, child: Text(activityLabels[a]!)),
                    ],
                    onChanged: (ActivityType? t) => _changePlan(i, t, planned?.minutes ?? 20),
                  ),
                ),
                if (planned != null) ...<Widget>[
                  const SizedBox(width: 12),
                  SizedBox(
                    width: 80,
                    child: TextFormField(
                      key: ValueKey<String>('plan-$i-${planned.type.name}-${planned.minutes}'),
                      initialValue: '${planned.minutes}',
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'min'),
                      onFieldSubmitted: (String v) {
                        final int? m = parseMinutes(v);
                        if (m != null) _changePlan(i, planned.type, m);
                      },
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
