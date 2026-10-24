// Cycle Care extras (PCOS/PCOD): logic, wording and widgets. Mirrors
// apps/web/src/features/wellness-modules/lib/cycleCare.ts.
//
// Design rules: PCOS is linked with a higher eating-disorder risk, so nothing here
// uses weight, calories, targets, streaks or good/bad scoring. Everything is optional,
// gentle and non-clinical. Wording is unreviewed (docs/content-needing-review.md).
import 'package:flutter/material.dart';

enum Level { low, okay, good }

class CheckInField {
  final String id;
  final String label;

  /// Labels for low / okay / good, in that order.
  final List<String> options;
  const CheckInField(this.id, this.label, this.options);

  String optionLabel(Level l) => options[l.index];
}

const List<CheckInField> checkinFields = <CheckInField>[
  CheckInField('energy', 'Energy', <String>['Running low', 'Steady', 'Plenty']),
  CheckInField('mood', 'Mood', <String>['Heavy', 'Mixed', 'Light']),
  CheckInField('comfort', 'Body comfort', <String>['Uncomfortable', 'Some discomfort', 'Comfortable']),
  CheckInField('sleep', 'Last night\'s sleep', <String>['Rough', 'Okay', 'Restful']),
];

typedef CheckIn = Map<String, Level>;

/// One gentle sentence for a single check-in. Never scores or judges.
String describeCheckIn(CheckIn c) {
  final List<String> parts = <String>[
    for (final CheckInField f in checkinFields)
      if (c[f.id] != null) '${f.label.toLowerCase()}: ${f.optionLabel(c[f.id]!).toLowerCase()}',
  ];
  if (parts.isEmpty) return 'Nothing noted yet. Skipping is always fine.';
  return 'Today you noted ${parts.join(', ')}.';
}

/// A neutral look back over the check-ins made on this screen. It counts, it does not
/// rank: no streaks, no best day, no targets.
String summarizeCheckIns(List<CheckIn> entries) {
  final List<CheckIn> filled = entries.where((e) => e.isNotEmpty).toList();
  if (filled.isEmpty) return 'No check-ins yet. Add one whenever you feel like it.';
  final int lowComfort = filled.where((e) => e['comfort'] == Level.low).length;
  final String base = 'You checked in ${filled.length} time${filled.length == 1 ? '' : 's'} on this screen.';
  if (lowComfort >= 2) {
    return '$base Your body felt uncomfortable more than once. If this keeps happening, it may help to mention it to your doctor.';
  }
  return '$base Notes like these can help you remember what to tell your doctor.';
}

const Map<Level, List<String>> movementByEnergy = <Level, List<String>>{
  Level.low: <String>['Slow stretching on the floor or in a chair', 'A few deep breaths by an open window', 'A very short, easy walk, only if you want to'],
  Level.okay: <String>['A walk at a comfortable pace', 'Gentle yoga or stretching', 'Dancing to one song'],
  Level.good: <String>['A longer walk or a bike ride you enjoy', 'Something playful like dancing or a game outside', 'Light strength moves, at your own pace'],
};

const String movementNote = 'There is no right amount. Rest counts too. Choose what feels kind to your body today.';

const List<String> visitPrompts = <String>[
  'What changes in my periods or body have I noticed lately?',
  'Which tests or check-ups do I need, and how often?',
  'What are my treatment options, and what are the side effects?',
  'Is it okay to take my supplements together with my medicine?',
  'What support is there for my mood, stress or sleep?',
];

const String medicationNote =
    'These are only your own notes, so you can remember what to ask. This app does not give medicine advice and does not send reminders from this screen. Use the Reminders page for alerts.';

const String waterNote = 'Just a tally for you. There is no goal to reach and nothing to keep up.';

const String bodyKindnessText =
    'SafeSpace does not track weight, calories or body size, on purpose. If thoughts about food or your body feel heavy, please talk to a doctor or someone you trust.';

const int maxItems = 20;
const int maxItemLength = 120;
const int maxWater = 30;

/// Adds a user-typed note to a short list. Returns the new list, or sets [error].
class AddResult {
  final List<String>? items;
  final String? error;
  const AddResult.ok(List<String> this.items) : error = null;
  const AddResult.fail(String this.error) : items = null;
}

AddResult addNote(List<String> list, String text) {
  final String t = text.trim();
  if (t.isEmpty) return const AddResult.fail('Please type something first.');
  if (t.length > maxItemLength) return const AddResult.fail('Please keep it under $maxItemLength characters.');
  if (list.length >= maxItems) return const AddResult.fail('That list is full. Remove one to add another.');
  if (list.any((x) => x.toLowerCase() == t.toLowerCase())) return const AddResult.fail('That is already on the list.');
  return AddResult.ok(<String>[...list, t]);
}

List<String> removeNote(List<String> list, int index) => <String>[
      for (int i = 0; i < list.length; i++)
        if (i != index) list[i],
    ];

int bumpWater(int current, int delta) => (current + delta).clamp(0, maxWater);

/// Words that must never appear in Cycle Care wording (body-image safety). Checked by tests.
final List<RegExp> blockedTerms = <RegExp>[
  RegExp(r'\bcalor(?:ie|ies)\b', caseSensitive: false),
  RegExp(r'\bweigh(?:t|ing)\b', caseSensitive: false),
  RegExp(r'\bdiet\b', caseSensitive: false),
  RegExp(r'\blose\b', caseSensitive: false),
  RegExp(r'\bfat\b', caseSensitive: false),
  RegExp(r'\bBMI\b'),
  RegExp(r'\bstreak\b', caseSensitive: false),
  RegExp(r'\bgoal weight\b', caseSensitive: false),
];

bool isBodyNeutral(String text) {
  if (text == bodyKindnessText) return true;
  return !blockedTerms.any((re) => re.hasMatch(text));
}

List<String> get cycleCareTexts => <String>[
      for (final CheckInField f in checkinFields) ...<String>[f.label, ...f.options],
      for (final List<String> l in movementByEnergy.values) ...l,
      movementNote,
      ...visitPrompts,
      medicationNote,
      waterNote,
    ];

// ---------------------------------------------------------------- widgets

const TextStyle _heading = TextStyle(fontSize: 20, fontWeight: FontWeight.w600);

Widget _card(List<Widget> children) => Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
      ),
    );

class DailyCheckInCard extends StatefulWidget {
  const DailyCheckInCard({super.key});

  @override
  State<DailyCheckInCard> createState() => _DailyCheckInCardState();
}

class _DailyCheckInCardState extends State<DailyCheckInCard> {
  CheckIn _draft = <String, Level>{};
  final List<CheckIn> _entries = <CheckIn>[];

  @override
  Widget build(BuildContext context) {
    return _card(<Widget>[
      const Text('How are you today?', style: _heading),
      const SizedBox(height: 4),
      const Text('Choose only what you want to. There are no right answers.'),
      for (final CheckInField f in checkinFields) ...<Widget>[
        const SizedBox(height: 8),
        Text(f.label, style: const TextStyle(fontWeight: FontWeight.w600)),
        Wrap(
          spacing: 8,
          children: <Widget>[
            for (final Level lv in Level.values)
              ChoiceChip(
                label: Text(f.optionLabel(lv)),
                selected: _draft[f.id] == lv,
                onSelected: (sel) => setState(() {
                  _draft = <String, Level>{..._draft};
                  if (sel) {
                    _draft[f.id] = lv;
                  } else {
                    _draft.remove(f.id);
                  }
                }),
              ),
          ],
        ),
      ],
      const SizedBox(height: 8),
      Text(describeCheckIn(_draft)),
      const SizedBox(height: 8),
      FilledButton(
        onPressed: () => setState(() {
          _entries.add(_draft);
          _draft = <String, Level>{};
        }),
        child: const Text('Add check-in'),
      ),
      const SizedBox(height: 8),
      Text(summarizeCheckIns(_entries)),
    ]);
  }
}

class MovementPickerCard extends StatefulWidget {
  const MovementPickerCard({super.key});

  @override
  State<MovementPickerCard> createState() => _MovementPickerCardState();
}

class _MovementPickerCardState extends State<MovementPickerCard> {
  Level? _energy;

  @override
  Widget build(BuildContext context) {
    return _card(<Widget>[
      const Text('Movement for your energy', style: _heading),
      const SizedBox(height: 8),
      Wrap(
        spacing: 8,
        children: <Widget>[
          for (final Level lv in Level.values)
            ChoiceChip(
              label: Text(checkinFields[0].optionLabel(lv)),
              selected: _energy == lv,
              onSelected: (_) => setState(() => _energy = lv),
            ),
        ],
      ),
      if (_energy != null) ...<Widget>[
        const SizedBox(height: 8),
        for (final String m in movementByEnergy[_energy]!) Text('• $m'),
      ],
      const SizedBox(height: 8),
      const Text(movementNote),
    ]);
  }
}

class _NoteList extends StatefulWidget {
  final String label;
  final String addLabel;
  final List<String> items;
  final ValueChanged<List<String>> onChanged;
  const _NoteList({required this.label, required this.addLabel, required this.items, required this.onChanged});

  @override
  State<_NoteList> createState() => _NoteListState();
}

class _NoteListState extends State<_NoteList> {
  final TextEditingController _c = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _add(String value) {
    final AddResult r = addNote(widget.items, value);
    setState(() => _error = r.error);
    if (r.items != null) {
      widget.onChanged(r.items!);
      _c.clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        TextField(controller: _c, maxLength: 200, decoration: InputDecoration(labelText: widget.label)),
        FilledButton(onPressed: () => _add(_c.text), child: Text(widget.addLabel)),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(_error!, style: const TextStyle(color: Colors.red))),
        for (int i = 0; i < widget.items.length; i++)
          Row(
            children: <Widget>[
              Expanded(child: Text(widget.items[i])),
              TextButton(
                onPressed: () => widget.onChanged(removeNote(widget.items, i)),
                child: Text('Remove', semanticsLabel: 'Remove ${widget.items[i]}'),
              ),
            ],
          ),
      ],
    );
  }
}

class DoctorVisitPrepCard extends StatefulWidget {
  const DoctorVisitPrepCard({super.key});

  @override
  State<DoctorVisitPrepCard> createState() => _DoctorVisitPrepCardState();
}

class _DoctorVisitPrepCardState extends State<DoctorVisitPrepCard> {
  List<String> _questions = <String>[];

  @override
  Widget build(BuildContext context) {
    return _card(<Widget>[
      const Text('Doctor visit prep', style: _heading),
      const SizedBox(height: 4),
      const Text('Tap an idea to add it to your list, or write your own.'),
      Wrap(
        spacing: 8,
        children: <Widget>[
          for (final String q in visitPrompts)
            ActionChip(
              label: Text(q),
              onPressed: () {
                final AddResult r = addNote(_questions, q);
                if (r.items != null) setState(() => _questions = r.items!);
              },
            ),
        ],
      ),
      _NoteList(label: 'Add your own question', addLabel: 'Add question', items: _questions, onChanged: (v) => setState(() => _questions = v)),
    ]);
  }
}

class MedicationNotesCard extends StatefulWidget {
  const MedicationNotesCard({super.key});

  @override
  State<MedicationNotesCard> createState() => _MedicationNotesCardState();
}

class _MedicationNotesCardState extends State<MedicationNotesCard> {
  List<String> _notes = <String>[];

  @override
  Widget build(BuildContext context) {
    return _card(<Widget>[
      const Text('My medicine and supplement notes', style: _heading),
      _NoteList(label: 'Name and when you take it, as your doctor told you', addLabel: 'Add note', items: _notes, onChanged: (v) => setState(() => _notes = v)),
      const SizedBox(height: 8),
      const Text(medicationNote),
    ]);
  }
}

class WaterTallyCard extends StatefulWidget {
  const WaterTallyCard({super.key});

  @override
  State<WaterTallyCard> createState() => _WaterTallyCardState();
}

class _WaterTallyCardState extends State<WaterTallyCard> {
  int _glasses = 0;

  @override
  Widget build(BuildContext context) {
    return _card(<Widget>[
      const Text('Water so far today', style: _heading),
      Row(
        children: <Widget>[
          IconButton(tooltip: 'Remove a glass', onPressed: _glasses == 0 ? null : () => setState(() => _glasses = bumpWater(_glasses, -1)), icon: const Icon(Icons.remove)),
          Text('$_glasses ${_glasses == 1 ? 'glass' : 'glasses'}', style: const TextStyle(fontSize: 18)),
          IconButton(tooltip: 'Add a glass', onPressed: () => setState(() => _glasses = bumpWater(_glasses, 1)), icon: const Icon(Icons.add)),
        ],
      ),
      const Text(waterNote),
    ]);
  }
}

class BodyKindnessNote extends StatelessWidget {
  const BodyKindnessNote({super.key});

  @override
  Widget build(BuildContext context) => const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text(bodyKindnessText));
}
