import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_provider.dart';
import '../calm_tools/calm_tool_scaffold.dart';
import '../calm_tools/low_sensory.dart';
import 'condition.dart';
import 'cycle_care_extras.dart';
import 'cycle_care_health.dart';
import 'module_content.dart';

const TextStyle _heading = TextStyle(fontSize: 20, fontWeight: FontWeight.w600);

class ModuleNotes extends StatelessWidget {
  final String? extra;
  const ModuleNotes({super.key, this.extra});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text('$reviewNotice Your entries stay on this screen only and are not saved yet.${extra == null ? '' : ' $extra'}'),
        const SizedBox(height: 8),
        const Text(supportText),
      ],
    );
  }
}

Widget _bullets(List<String> items) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[for (final String i in items) Text('• $i')],
    );

Widget _card(List<Widget> children) => Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
      ),
    );

void _push(BuildContext context, String path) => context.push(path);

/// Shared wrapper that reads low-sensory info and wires Exit.
class ModuleFrame extends ConsumerWidget {
  final String title;
  final VoidCallback? onExit;
  final bool forceLowSensory;
  final Widget child;
  const ModuleFrame({
    super.key,
    required this.title,
    required this.child,
    this.onExit,
    this.forceLowSensory = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final LowSensoryInfo s = watchLowSensory(context, ref);
    return CalmToolScaffold(
      title: title,
      lowSensory: forceLowSensory || s.lowSensory,
      notice: s.notice,
      onExit: onExit ?? () => defaultCalmToolExit(context),
      child: child,
    );
  }
}

class ModulesHomeScreen extends StatelessWidget {
  final VoidCallback? onExit;
  const ModulesHomeScreen({super.key, this.onExit});

  Widget _tile(BuildContext context, String title, String sub, String path) => Card(
        child: ListTile(
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(sub),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => _push(context, path),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return ModuleFrame(
      title: 'Wellness modules',
      onExit: onExit,
      child: Column(
        children: <Widget>[
          _tile(context, 'Calm Space', 'Breathing, grounding and calming tips.', '/modules/calm-space'),
          _tile(context, 'Bright Days', 'Small goals and gratitude notes.', '/modules/bright-days'),
          _tile(context, 'Safe Harbor', 'A quiet space with text relaxation steps.', '/modules/safe-harbor'),
          _tile(context, 'PCOS / PCOD', 'Cycle Care, Physical Exercise and Food in one place (adults only).', '/modules/pcos-pcod'),
          _tile(context, 'Story workflow', 'For caregivers: write, check, approve and read stories.', '/story-workflow'),
        ],
      ),
    );
  }
}

class CalmSpaceScreen extends StatelessWidget {
  final VoidCallback? onExit;
  const CalmSpaceScreen({super.key, this.onExit});

  @override
  Widget build(BuildContext context) {
    return ModuleFrame(
      title: 'Calm Space',
      onExit: onExit,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _card(<Widget>[
            const Text('Calming tools', style: _heading),
            const SizedBox(height: 8),
            Wrap(spacing: 8, children: <Widget>[
              OutlinedButton(
                onPressed: () => _push(context, '/calm-tools/breathing'),
                child: const Text('Breathing exercise'),
              ),
              OutlinedButton(
                onPressed: () => _push(context, '/calm-tools/grounding'),
                child: const Text('5-4-3-2-1 grounding'),
              ),
            ]),
          ]),
          _card(<Widget>[const Text('Gentle tips', style: _heading), const SizedBox(height: 8), _bullets(anxietyTips)]),
          const SizedBox(height: 8),
          const ModuleNotes(),
        ],
      ),
    );
  }
}

class BrightDaysScreen extends StatefulWidget {
  final VoidCallback? onExit;
  const BrightDaysScreen({super.key, this.onExit});

  @override
  State<BrightDaysScreen> createState() => _BrightDaysScreenState();
}

class _Goal {
  final String text;
  bool done;
  _Goal(this.text) : done = false;
}

class _BrightDaysScreenState extends State<BrightDaysScreen> {
  final List<_Goal> _goals = <_Goal>[];
  final List<String> _gratitude = <String>[];
  final TextEditingController _goalCtl = TextEditingController();
  final TextEditingController _gratCtl = TextEditingController();
  String? _message;
  String? _error;

  @override
  void dispose() {
    _goalCtl.dispose();
    _gratCtl.dispose();
    super.dispose();
  }

  void _addGoal(String text) {
    final String t = text.trim();
    if (t.isEmpty) {
      setState(() => _error = 'Please type a goal first.');
      return;
    }
    setState(() {
      _error = null;
      _goals.add(_Goal(t));
      _goalCtl.clear();
    });
  }

  void _toggle(int i) {
    setState(() {
      _goals[i].done = !_goals[i].done;
      _message = _goals[i].done ? encouragements[i % encouragements.length] : null;
    });
  }

  void _addGratitude() {
    final String t = _gratCtl.text.trim();
    if (t.isEmpty) {
      setState(() => _error = 'Please write something first.');
      return;
    }
    setState(() {
      _error = null;
      _gratitude.add(t);
      _gratCtl.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return ModuleFrame(
      title: 'Bright Days',
      onExit: widget.onExit,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _card(<Widget>[
            const Text('My small goals', style: _heading),
            const SizedBox(height: 4),
            const Text('Pick your own. Skip any you like. Ideas:'),
            Wrap(spacing: 8, children: <Widget>[
              for (final String g in goalIdeas) OutlinedButton(onPressed: () => _addGoal(g), child: Text(g)),
            ]),
            const SizedBox(height: 8),
            TextField(
              controller: _goalCtl,
              decoration: const InputDecoration(labelText: 'Or write your own', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 8),
            FilledButton(onPressed: () => _addGoal(_goalCtl.text), child: const Text('Add goal')),
            for (int i = 0; i < _goals.length; i++)
              CheckboxListTile(
                value: _goals[i].done,
                onChanged: (_) => _toggle(i),
                title: Text(_goals[i].text),
                controlAffinity: ListTileControlAffinity.leading,
              ),
            if (_message != null) Semantics(liveRegion: true, child: Text(_message!)),
          ]),
          _card(<Widget>[
            const Text('Gratitude notes', style: _heading),
            const SizedBox(height: 4),
            const Text(gratitudePrompt),
            const SizedBox(height: 8),
            TextField(
              controller: _gratCtl,
              decoration: const InputDecoration(labelText: 'Your note', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 8),
            FilledButton(onPressed: _addGratitude, child: const Text('Add note')),
            const SizedBox(height: 8),
            _bullets(_gratitude),
          ]),
          _card(<Widget>[
            const Text('Hobby ideas (optional)', style: _heading),
            const SizedBox(height: 8),
            _bullets(hobbyIdeas),
          ]),
          if (_error != null)
            Semantics(liveRegion: true, child: Text(_error!, style: const TextStyle(color: Color(0xFFB00020)))),
          const SizedBox(height: 8),
          const ModuleNotes(),
        ],
      ),
    );
  }
}

/// Safe Harbor always runs in low-sensory mode.
class SafeHarborScreen extends StatefulWidget {
  final VoidCallback? onExit;
  const SafeHarborScreen({super.key, this.onExit});

  @override
  State<SafeHarborScreen> createState() => _SafeHarborScreenState();
}

class _SafeHarborScreenState extends State<SafeHarborScreen> {
  int _step = 0;

  @override
  Widget build(BuildContext context) {
    final bool last = _step == relaxationSteps.length - 1;
    return ModuleFrame(
      title: 'Safe Harbor',
      onExit: widget.onExit,
      forceLowSensory: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const Text('This is a quiet space. Nothing moves and there is no sound. You can leave at any time.'),
          const SizedBox(height: 8),
          _card(<Widget>[
            Text('Relaxation, step ${_step + 1} of ${relaxationSteps.length}', style: const TextStyle(color: Colors.black54)),
            const SizedBox(height: 8),
            Semantics(liveRegion: true, child: Text(relaxationSteps[_step], style: const TextStyle(fontSize: 18, height: 1.4))),
            const SizedBox(height: 12),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: <Widget>[
              OutlinedButton(
                onPressed: _step == 0 ? null : () => setState(() => _step--),
                child: const Text('Back'),
              ),
              FilledButton(
                onPressed: last ? null : () => setState(() => _step++),
                child: const Text('Next'),
              ),
            ]),
          ]),
          _card(<Widget>[
            OutlinedButton(
              onPressed: () => _push(context, '/calm-tools/grounding'),
              child: const Text('Try the grounding activity'),
            ),
          ]),
          _card(<Widget>[
            const Text('Support from people', style: _heading),
            const SizedBox(height: 8),
            const Text(careBridgingText),
          ]),
          const SizedBox(height: 8),
          const ModuleNotes(extra: 'This is not treatment.'),
        ],
      ),
    );
  }
}

class CycleCareScreen extends ConsumerStatefulWidget {
  /// Override for tests. Normally taken from the signed-in role.
  final String? role;
  final VoidCallback? onExit;
  const CycleCareScreen({super.key, this.role, this.onExit});

  @override
  ConsumerState<CycleCareScreen> createState() => _CycleCareScreenState();
}

class _CycleCareScreenState extends ConsumerState<CycleCareScreen> {
  final Map<String, bool> _checked = <String, bool>{};
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
    if (!canOpenCycleCare(role)) {
      return ModuleFrame(
        title: 'Cycle Care',
        onExit: widget.onExit,
        child: const Card(
          child: Padding(
            padding: EdgeInsets.all(20),
            child: Text('Cycle Care is for adult accounts only for now.'),
          ),
        ),
      );
    }
    return ModuleFrame(
      title: 'Cycle Care',
      onExit: widget.onExit,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(onPressed: () => context.go('/modules/pcos-pcod'), child: const Text('Back to PCOS / PCOD')),
          ),
          const DailyCheckInCard(),
          _card(<Widget>[
            const Text('Today\'s self-care', style: _heading),
            for (final List<String> item in pcosChecklist)
              CheckboxListTile(
                value: _checked[item[0]] ?? false,
                onChanged: (v) => setState(() => _checked[item[0]] = v ?? false),
                title: Text(item[1]),
                controlAffinity: ListTileControlAffinity.leading,
              ),
            const Text('This checklist does not send reminders. It resets when you leave the screen.'),
          ]),
          const MedicationNotesCard(),
          const MedicineRemindersNote(),
          DoctorVisitPrepCard(prompts: visitQuestionsFor(_condition)),
          _card(<Widget>[
            const Text('Sleep and stress', style: _heading),
            const SizedBox(height: 8),
            _bullets(sleepStressIdeas),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () => _push(context, '/calm-tools/breathing'),
              child: const Text('Open the breathing exercise'),
            ),
          ]),
          const BodyKindnessNote(),
          const ModuleNotes(extra: 'There is no cycle tracking in this version. Always follow your own doctor\'s advice.'),
        ],
      ),
    );
  }
}
