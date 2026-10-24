// Cycle Care widgets for the diet plan, rewards, talking character, health profile and the
// medicine-reminders note. Mirrors apps/web/src/features/wellness-modules/components/.
// The plan, rewards and profile are kept on this device only (shared_preferences).
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'condition.dart';
import 'diet_plan.dart';
import 'health_assessment.dart';

const String dietPrefsKey = 'safespace.cycle-care.diet.v1';
const String profilePrefsKey = 'safespace.cycle-care.profile.v1';
const String exercisePrefsKey = 'safespace.cycle-care.exercise.v1';
const String conditionPrefsKey = 'safespace.cycle-care.condition.v1';

/// Reads which label the person follows (PCOS, PCOD, not sure). Kept on this device only.
Future<Condition?> loadCondition() async {
  try {
    final SharedPreferences p = await SharedPreferences.getInstance();
    return conditionFromName(p.getString(conditionPrefsKey));
  } catch (_) {
    return null;
  }
}

Future<void> saveCondition(Condition? c) async {
  try {
    final SharedPreferences p = await SharedPreferences.getInstance();
    if (c == null) {
      await p.remove(conditionPrefsKey);
    } else {
      await p.setString(conditionPrefsKey, c.name);
    }
  } catch (_) {
    // not saved
  }
}

/// Removes every PCOS / PCOD value kept on this device.
Future<void> clearAllPcosData() async {
  try {
    final SharedPreferences p = await SharedPreferences.getInstance();
    for (final String k in <String>[dietPrefsKey, profilePrefsKey, exercisePrefsKey, conditionPrefsKey]) {
      await p.remove(k);
    }
  } catch (_) {
    // nothing to clear
  }
}

const TextStyle _heading = TextStyle(fontSize: 20, fontWeight: FontWeight.w600);
const TextStyle _sub = TextStyle(fontSize: 16, fontWeight: FontWeight.w600);

Widget _card(List<Widget> children) => Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
      ),
    );

const String reminderPrivacyNote =
    'Reminders only say a generic line, like "Time for your medicine". The names in your notes are never sent anywhere. Alerts show while SafeSpace is open; there are no phone notifications yet.';

/// Medicine reminders use the shared Reminders feature, which is available on the web app first.
class MedicineRemindersNote extends StatelessWidget {
  const MedicineRemindersNote({super.key});

  @override
  Widget build(BuildContext context) => _card(<Widget>[
        const Text('Medicine and supplement reminders', style: _heading),
        const SizedBox(height: 8),
        const Text('Setting reminders from this app is coming soon. For now, add them in the SafeSpace web app with your adult account, and they will show there as in-app alerts.'),
        const SizedBox(height: 8),
        const Text(reminderPrivacyNote),
      ]);
}

/// The character hops while it talks. It stays still in low-sensory mode or when the device
/// asks for less motion.
class CoachCharacter extends StatefulWidget {
  final Stance stance;
  final String text;
  final bool lowSensory;
  const CoachCharacter({super.key, required this.stance, required this.text, required this.lowSensory});

  @override
  State<CoachCharacter> createState() => _CoachCharacterState();
}

class _CoachCharacterState extends State<CoachCharacter> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final bool still = widget.lowSensory || MediaQuery.of(context).disableAnimations;
    if (still) {
      _c.stop();
      _c.value = 0;
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(CoachCharacter old) {
    super.didUpdateWidget(old);
    if (old.lowSensory != widget.lowSensory) didChangeDependencies();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  IconData get _icon {
    switch (widget.stance) {
      case Stance.celebrating:
        return Icons.celebration;
      case Stance.happy:
        return Icons.sentiment_very_satisfied;
      case Stance.meditating:
        return Icons.self_improvement;
      case Stance.waving:
        return Icons.waving_hand;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label: widget.text,
      child: ExcludeSemantics(
        child: Column(
          children: <Widget>[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.black12)),
              child: Text(widget.text, textAlign: TextAlign.center),
            ),
            const SizedBox(height: 8),
            AnimatedBuilder(
              animation: _c,
              builder: (BuildContext context, Widget? child) => Transform.translate(offset: Offset(0, -10 * Curves.easeInOut.transform(_c.value)), child: child),
              child: CircleAvatar(radius: 40, backgroundColor: const Color(0xFFF2708A), child: Icon(_icon, size: 44, color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }
}

/// Diet plan, rewards and character ([showDiet]) and the health profile ([showProfile]). The Food
/// module shows the diet part, the PCOS / PCOD hub shows the profile part.
class HealthSections extends StatefulWidget {
  final bool lowSensory;
  final bool showDiet;
  final bool showProfile;
  final Condition? condition;
  const HealthSections({super.key, required this.lowSensory, this.showDiet = true, this.showProfile = true, this.condition});

  @override
  State<HealthSections> createState() => _HealthSectionsState();
}

class _HealthSectionsState extends State<HealthSections> {
  DietState _diet = DietState.empty();
  Assessment _profile = const Assessment();
  bool _saveFailed = false;
  bool _showSummary = false;
  MealId _meal = MealId.breakfast;
  String? _planError;
  final TextEditingController _planText = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _planText.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final SharedPreferences p = await SharedPreferences.getInstance();
      final String? d = p.getString(dietPrefsKey);
      final String? a = p.getString(profilePrefsKey);
      if (!mounted) return;
      setState(() {
        if (d != null) _diet = stateFromJson(jsonDecode(d));
        if (a != null) _profile = assessmentFromJson(jsonDecode(a));
      });
    } catch (_) {
      // Unreadable or missing data simply starts empty.
    }
  }

  Future<void> _save() async {
    try {
      final SharedPreferences p = await SharedPreferences.getInstance();
      await p.setString(dietPrefsKey, jsonEncode(stateToJson(_diet)));
      await p.setString(profilePrefsKey, jsonEncode(assessmentToJson(_profile)));
      if (mounted && _saveFailed) setState(() => _saveFailed = false);
    } catch (_) {
      if (mounted) setState(() => _saveFailed = true);
    }
  }

  void _setDiet(DietState s) {
    setState(() => _diet = s);
    _save();
  }

  void _setProfile(Assessment a) {
    setState(() => _profile = a);
    _save();
  }

  void _addPlan(String text) {
    final PlanResult r = addPlanItem(_diet.plan, _meal, text);
    setState(() => _planError = r.error);
    if (r.plan != null) {
      _planText.clear();
      _setDiet(refreshDay(_diet.copyWith(plan: r.plan), dateKey(DateTime.now())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final String today = dateKey(DateTime.now());
    final DayEntry? entry = _diet.days[today];
    final int streak = currentStreak(_diet.days, today);
    final Reaction reaction = characterReaction(entry, DateTime.now().hour, streak);
    final List<MealId> ticked = _diet.ticks[today] ?? <MealId>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (widget.showDiet) _card(<Widget>[
          const Text('Diet plan and rewards', style: _heading),
          const SizedBox(height: 12),
          Center(child: CoachCharacter(stance: reaction.stance, text: reaction.text, lowSensory: widget.lowSensory)),
          const SizedBox(height: 16),
          const Text('General eating tips', style: _sub),
          const SizedBox(height: 4),
          for (final String g in <String>[...generalGuidance, ...foodFocusFor(widget.condition)]) Text('• $g'),
          const SizedBox(height: 4),
          const Text(foodSharedNote),
          const Text(guidanceNote),
          const SizedBox(height: 16),
          const Text('My plan for today', style: _sub),
          const Text('Write the plan your doctor or dietitian gave you, then tick each meal when you have had it.'),
          for (final MealId m in MealId.values)
            Card(
              margin: const EdgeInsets.only(top: 8),
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    CheckboxListTile(
                      value: ticked.contains(m),
                      onChanged: _diet.plan[m]!.isEmpty ? null : (_) => _setDiet(toggleMeal(_diet, m, today)),
                      title: Text(mealLabels[m]!),
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: EdgeInsets.zero,
                    ),
                    if (_diet.plan[m]!.isEmpty)
                      const Padding(padding: EdgeInsets.only(left: 8), child: Text('Nothing planned yet.', style: TextStyle(color: Colors.black54)))
                    else
                      for (int i = 0; i < _diet.plan[m]!.length; i++)
                        Row(
                          children: <Widget>[
                            Expanded(child: Padding(padding: const EdgeInsets.only(left: 8), child: Text(_diet.plan[m]![i]))),
                            TextButton(
                              onPressed: () => _setDiet(refreshDay(_diet.copyWith(plan: removePlanItem(_diet.plan, m, i)), today)),
                              child: Text('Remove', semanticsLabel: 'Remove ${_diet.plan[m]![i]}'),
                            ),
                          ],
                        ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 16),
          const Text('Add to my plan', style: _sub),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: <Widget>[
              for (final MealId m in MealId.values) ChoiceChip(label: Text(mealLabels[m]!), selected: _meal == m, onSelected: (_) => setState(() => _meal = m)),
            ],
          ),
          TextField(controller: _planText, maxLength: 120, decoration: const InputDecoration(labelText: 'What will you have?')),
          FilledButton(onPressed: () => _addPlan(_planText.text), child: const Text('Add to plan')),
          if (_planError != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(_planError!, style: const TextStyle(color: Colors.red))),
          const SizedBox(height: 8),
          Text('Ideas${_profile.preference != null ? ' that match your food preference' : ''}, tap to add:'),
          Wrap(
            spacing: 8,
            children: <Widget>[
              for (final MealIdea i in mealIdeasFor(_meal, _profile.preference)) ActionChip(label: Text(i.text), onPressed: () => _addPlan(i.text)),
            ],
          ),
          const SizedBox(height: 16),
          const Text('Rewards', style: _sub),
          const SizedBox(height: 8),
          if (_diet.hideRewards)
            const Text('Stars and streaks are hidden. The character still cheers you on.')
          else
            Row(
              children: <Widget>[
                _stat('${starsForDay(entry)}', 'stars today'),
                _stat('${totalStars(_diet.days)}', 'stars in total'),
                _stat('$streak', 'days in a row (best ${bestStreak(_diet.days)})'),
              ],
            ),
          const SizedBox(height: 8),
          const Text('A star for every meal you tick, and a bonus star for finishing the day. A partial day still counts, and you can start a new run any time.'),
          OutlinedButton(
            onPressed: () => _setDiet(_diet.copyWith(hideRewards: !_diet.hideRewards)),
            child: Text(_diet.hideRewards ? 'Show stars and streaks' : 'Hide stars and streaks'),
          ),
        ]),
        if (widget.showProfile) _profileCard(),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(
            'The ${widget.showDiet ? 'diet plan and rewards' : 'health profile'} are kept on this device only, not in your account.${_saveFailed ? ' This device is not allowing saving, so they will be lost when you leave.' : ''}',
            style: const TextStyle(color: Colors.black54),
          ),
        ),
      ],
    );
  }

  Widget _stat(String big, String small) => Expanded(
        child: Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
            child: Column(children: <Widget>[
              Text(big, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w600)),
              Text(small, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12)),
            ]),
          ),
        ),
      );

  Widget _checks(String legend, List<Choice> options, List<String> value, void Function(List<String>) onChanged) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const SizedBox(height: 12),
          Text(legend, style: _sub),
          for (final Choice o in options)
            CheckboxListTile(
              value: value.contains(o.id),
              onChanged: (_) => onChanged(toggleChoice(value, o.id)),
              title: Text(o.label),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              dense: true,
            ),
        ],
      );

  Widget _text(String label, String value, void Function(String) onChanged, {bool number = false}) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: TextFormField(
          key: ValueKey<String>('f-$label'),
          initialValue: value,
          keyboardType: number ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
          decoration: InputDecoration(labelText: label),
          onChanged: onChanged,
        ),
      );

  Widget _profileCard() {
    final List<String> errors = validateAssessment(_profile);
    final List<String> summary = buildSummary(_profile);
    return _card(<Widget>[
      const Text('My health profile', style: _heading),
      const SizedBox(height: 4),
      const Text(profileNote),
      const SizedBox(height: 12),
      const Text('Menstrual cycle patterns', style: _sub),
      Wrap(
        spacing: 8,
        children: <Widget>[
          for (final Choice o in cycleOptions)
            ChoiceChip(label: Text(o.label), selected: _profile.cycle == o.id, onSelected: (_) => _setProfile(_profile.copyWith(cycle: _profile.cycle == o.id ? null : o.id))),
        ],
      ),
      _checks('Health and medical history', historyOptions, _profile.history, (v) => _setProfile(_profile.copyWith(history: v))),
      _text('Body weight (kg, optional)', _profile.weightKg, (v) => _setProfile(_profile.copyWith(weightKg: v)), number: true),
      _text('Waist (cm, optional)', _profile.waistCm, (v) => _setProfile(_profile.copyWith(waistCm: v)), number: true),
      _text('Fasting blood glucose (mg/dL, optional)', _profile.fastingGlucose, (v) => _setProfile(_profile.copyWith(fastingGlucose: v)), number: true),
      _text('HbA1c (%, optional)', _profile.hba1c, (v) => _setProfile(_profile.copyWith(hba1c: v)), number: true),
      const Padding(
        padding: EdgeInsets.only(top: 4),
        child: Text('Numbers are only for your own summary. SafeSpace does not work out BMI, set a target weight or judge these values.', style: TextStyle(color: Colors.black54)),
      ),
      _checks('Current eating habits', eatingOptions, _profile.eating, (v) => _setProfile(_profile.copyWith(eating: v))),
      _checks('Nutritional requirements', needsOptions, _profile.needs, (v) => _setProfile(_profile.copyWith(needs: v))),
      _text('Allergies (optional)', _profile.allergies, (v) => _setProfile(_profile.copyWith(allergies: v))),
      const SizedBox(height: 12),
      const Text('Food preferences', style: _sub),
      Wrap(
        spacing: 8,
        children: <Widget>[
          for (final FoodPreference p in FoodPreference.values)
            ChoiceChip(label: Text(preferenceLabels[p]!), selected: _profile.preference == p, onSelected: (_) => _setProfile(_profile.copyWith(preference: _profile.preference == p ? null : p))),
        ],
      ),
      _text('Foods you like or avoid (optional)', _profile.likes, (v) => _setProfile(_profile.copyWith(likes: v))),
      _checks('Individual health goals', goalOptions, _profile.goals, (v) => _setProfile(_profile.copyWith(goals: v))),
      _text('In your own words (optional)', _profile.goalNote, (v) => _setProfile(_profile.copyWith(goalNote: v))),
      for (final String e in errors) Padding(padding: const EdgeInsets.only(top: 4), child: Text(e, style: const TextStyle(color: Colors.red))),
      const SizedBox(height: 12),
      FilledButton(onPressed: () => setState(() => _showSummary = !_showSummary), child: Text(_showSummary ? 'Hide my private summary' : 'Show my private summary')),
      if (_showSummary) ...<Widget>[
        const SizedBox(height: 8),
        if (summary.isEmpty) const Text('Nothing shared yet. Skipping is always fine.') else for (final String s in summary) Text('• $s'),
        const SizedBox(height: 4),
        const Text(summaryNote, style: TextStyle(color: Colors.black54)),
      ],
    ]);
  }
}
