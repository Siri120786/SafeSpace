/// Typed access to the shared game content (packages/game-content), copied to
/// assets/games by scripts/sync-game-content.mjs so web and mobile show the
/// same puzzles. Pure Dart apart from the asset loader.
library;

import 'dart:convert';
import 'package:flutter/services.dart' show AssetBundle, rootBundle;

enum Difficulty { easy, medium, hard }

Difficulty? parseDifficulty(Object? v) {
  for (final Difficulty d in Difficulty.values) {
    if (d.name == v) return d;
  }
  return null;
}

const List<String> kGameIds = <String>[
  'memory-match',
  'pattern-quest',
  'feelings-detective',
  'imagine-create',
  'maze-explorer',
];

const List<String> kContentFiles = <String>[
  'catalog',
  'symbols',
  'memory-match',
  'pattern-quest',
  'feelings-detective',
  'imagine-create',
  'maze-explorer',
];

class GameInfo {
  final String id;
  final String emoji;
  final String tier;
  final String titleKey;
  final String blurbKey;
  final List<String> skills;
  const GameInfo(this.id, this.emoji, this.tier, this.titleKey, this.blurbKey, this.skills);
}

class MemoryRules {
  final int pairs;
  final int columns;
  const MemoryRules(this.pairs, this.columns);
}

class MemoryTheme {
  final String id;
  final List<String> cards;
  const MemoryTheme(this.id, this.cards);
}

class PatternRule {
  final String type; // add | double | fibonacci
  final int by;
  const PatternRule(this.type, this.by);
}

class PatternRound {
  final String id;
  final List<String> items;
  final List<String> options;
  final String answer;
  final PatternRule? rule;
  final String hintKey;
  const PatternRound({
    required this.id,
    required this.items,
    required this.options,
    required this.answer,
    required this.hintKey,
    this.rule,
  });

  PatternRound withOptions(List<String> o) =>
      PatternRound(id: id, items: items, options: o, answer: answer, hintKey: hintKey, rule: rule);
}

class FeelingChoice {
  final String id;
  final String fit; // strong | okay | unlikely
  const FeelingChoice(this.id, this.fit);
}

class StepChoice {
  final String id;
  final String textKey;
  final String fit; // helpful | okay | notHelpful
  const StepChoice(this.id, this.textKey, this.fit);
}

class FeelingsScenario {
  final String id;
  final String character;
  final String name;
  final String sceneKey;
  final List<String> clueKeys;
  final List<FeelingChoice> feelings;
  final List<StepChoice> steps;
  const FeelingsScenario({
    required this.id,
    required this.character,
    required this.name,
    required this.sceneKey,
    required this.clueKeys,
    required this.feelings,
    required this.steps,
  });

  FeelingsScenario withOrder(List<FeelingChoice> f, List<StepChoice> s) => FeelingsScenario(
        id: id,
        character: character,
        name: name,
        sceneKey: sceneKey,
        clueKeys: clueKeys,
        feelings: f,
        steps: s,
      );
}

class MazeDef {
  final String id;
  final int columns;
  final List<String> rows;
  final List<int> start; // [x, y]
  final List<int> goal;
  const MazeDef(this.id, this.columns, this.rows, this.start, this.goal);
}

class AdaptationRules {
  final int window;
  final int upMistakes;
  final int upHints;
  final int downMistakes;
  const AdaptationRules(this.window, this.upMistakes, this.upHints, this.downMistakes);
}

class GameContent {
  final Map<String, dynamic> _docs;
  GameContent._(this._docs);

  /// Builds content from the JSON text of each file, keyed by file name
  /// without extension (see [kContentFiles]).
  factory GameContent.fromSources(Map<String, String> sources) {
    return GameContent._(<String, dynamic>{
      for (final MapEntry<String, String> e in sources.entries) e.key: jsonDecode(e.value),
    });
  }

  static Future<GameContent> load([AssetBundle? bundle]) async {
    final AssetBundle b = bundle ?? rootBundle;
    final Map<String, String> sources = <String, String>{};
    for (final String name in kContentFiles) {
      sources[name] = await b.loadString('assets/games/$name.json');
    }
    return GameContent.fromSources(sources);
  }

  Map<String, dynamic> _doc(String name) => (_docs[name] as Map<String, dynamic>);

  // ---- text ---------------------------------------------------------------

  static const List<String> supportedLanguages = <String>['en'];

  /// The language games will use: the wanted one if we have it, else English.
  static String resolveLanguage(String? wanted) {
    final String base = (wanted ?? 'en').toLowerCase().split(RegExp('[-_]')).first;
    return supportedLanguages.contains(base) ? base : 'en';
  }

  static bool usesFallbackLanguage(String? wanted) {
    final String base = (wanted ?? 'en').toLowerCase().split(RegExp('[-_]')).first;
    return !supportedLanguages.contains(base);
  }

  String? _lookup(String key, String lang) {
    String? found;
    for (final String name in kContentFiles) {
      if (name == 'symbols') continue;
      final Object? strings = _doc(name)['strings'];
      if (strings is Map<String, dynamic>) {
        final Object? table = strings[lang];
        if (table is Map<String, dynamic> && table[key] is String) found = table[key] as String;
      }
    }
    return found;
  }

  /// Looks a key up in the language, then English, then returns the key itself.
  String text(String key, {Map<String, String> vars = const <String, String>{}, String lang = 'en'}) {
    String out = _lookup(key, lang) ?? _lookup(key, 'en') ?? key;
    vars.forEach((String k, String v) => out = out.replaceAll('{$k}', v));
    return out;
  }

  /// Spoken / screen-reader name of a picture. Numbers and unknown pictures read as themselves.
  String symbolName(String symbol, {String lang = 'en'}) {
    final Map<String, dynamic> s = _doc('symbols');
    final Object? table = s[lang] ?? s['en'];
    if (table is Map<String, dynamic> && table[symbol] is String) return table[symbol] as String;
    final Object? en = s['en'];
    if (en is Map<String, dynamic> && en[symbol] is String) return en[symbol] as String;
    return symbol;
  }

  String feelingLabel(String id, {String lang = 'en'}) => text('feeling.$id', lang: lang);

  /// Every picture name in the symbols file (used by tests).
  Set<String> get knownSymbols => ((_doc('symbols')['en'] as Map<String, dynamic>).keys).toSet();

  /// Every text key present in English (used by tests).
  bool hasText(String key) => _lookup(key, 'en') != null;

  // ---- catalog ------------------------------------------------------------

  List<GameInfo> get games => <GameInfo>[
        for (final dynamic g in (_doc('catalog')['games'] as List<dynamic>))
          GameInfo(
            g['id'] as String,
            g['emoji'] as String,
            g['tier'] as String,
            g['titleKey'] as String,
            g['blurbKey'] as String,
            <String>[for (final dynamic s in g['skills'] as List<dynamic>) s as String],
          ),
      ];

  AdaptationRules get adaptation {
    final Map<String, dynamic> a = _doc('catalog')['adaptation'] as Map<String, dynamic>;
    return AdaptationRules(
      a['window'] as int,
      a['stepUpIfAtMostMistakes'] as int,
      a['stepUpIfAtMostHints'] as int,
      a['stepDownIfAtLeastMistakes'] as int,
    );
  }

  // ---- memory -------------------------------------------------------------

  MemoryRules memoryRules(Difficulty d) {
    final Map<String, dynamic> r = (_doc('memory-match')['difficulty'] as Map<String, dynamic>)[d.name] as Map<String, dynamic>;
    return MemoryRules(r['pairs'] as int, r['columns'] as int);
  }

  List<MemoryTheme> get memoryThemes => <MemoryTheme>[
        for (final dynamic t in (_doc('memory-match')['themes'] as List<dynamic>))
          MemoryTheme(t['id'] as String, <String>[for (final dynamic c in t['cards'] as List<dynamic>) c as String]),
      ];

  int get memoryFlipBackMs => ((_doc('memory-match')['timing'] as Map<String, dynamic>)['flipBackMs'] as int);
  int get memoryFlipBackCalmMs => ((_doc('memory-match')['timing'] as Map<String, dynamic>)['flipBackCalmMs'] as int);

  List<String> memoryFeedbackKeys(String kind) =>
      <String>[for (final dynamic k in ((_doc('memory-match')['feedbackKeys'] as Map<String, dynamic>)[kind] as List<dynamic>)) k as String];

  // ---- pattern quest ------------------------------------------------------

  int get patternRoundsPerGame => _doc('pattern-quest')['roundsPerGame'] as int;

  List<PatternRound> patternRounds(Difficulty d) {
    final List<dynamic> list = (_doc('pattern-quest')['rounds'] as Map<String, dynamic>)[d.name] as List<dynamic>;
    return <PatternRound>[
      for (final dynamic r in list)
        PatternRound(
          id: r['id'] as String,
          items: <String>[for (final dynamic x in r['items'] as List<dynamic>) x as String],
          options: <String>[for (final dynamic x in r['options'] as List<dynamic>) x as String],
          answer: r['answer'] as String,
          hintKey: r['hintKey'] as String,
          rule: r['rule'] == null
              ? null
              : PatternRule((r['rule'] as Map<String, dynamic>)['type'] as String, ((r['rule'] as Map<String, dynamic>)['by'] as int?) ?? 0),
        ),
    ];
  }

  List<String> patternFeedbackKeys(String kind) =>
      <String>[for (final dynamic k in ((_doc('pattern-quest')['feedbackKeys'] as Map<String, dynamic>)[kind] as List<dynamic>)) k as String];

  // ---- feelings detective -------------------------------------------------

  int get feelingsRoundsPerGame => _doc('feelings-detective')['roundsPerGame'] as int;

  Map<String, String> get feelingEmoji => <String, String>{
        for (final MapEntry<String, dynamic> e in (_doc('feelings-detective')['feelings'] as Map<String, dynamic>).entries)
          e.key: e.value as String,
      };

  List<FeelingsScenario> scenarios(Difficulty d) {
    final List<dynamic> list = (_doc('feelings-detective')['scenarios'] as Map<String, dynamic>)[d.name] as List<dynamic>;
    return <FeelingsScenario>[
      for (final dynamic s in list)
        FeelingsScenario(
          id: s['id'] as String,
          character: s['character'] as String,
          name: s['name'] as String,
          sceneKey: s['sceneKey'] as String,
          clueKeys: <String>[for (final dynamic k in s['clueKeys'] as List<dynamic>) k as String],
          feelings: <FeelingChoice>[
            for (final dynamic f in s['feelings'] as List<dynamic>) FeelingChoice(f['id'] as String, f['fit'] as String),
          ],
          steps: <StepChoice>[
            for (final dynamic x in s['steps'] as List<dynamic>) StepChoice(x['id'] as String, x['textKey'] as String, x['fit'] as String),
          ],
        ),
    ];
  }

  // ---- imagine & create ---------------------------------------------------

  Map<String, dynamic> get imagine => _doc('imagine-create');

  // ---- maze explorer ------------------------------------------------------

  List<MazeDef> mazes(Difficulty d) {
    final List<dynamic> list = (_doc('maze-explorer')['mazes'] as Map<String, dynamic>)[d.name] as List<dynamic>;
    return <MazeDef>[
      for (final dynamic m in list)
        MazeDef(
          m['id'] as String,
          m['columns'] as int,
          <String>[for (final dynamic r in m['rows'] as List<dynamic>) r as String],
          <int>[for (final dynamic v in m['start'] as List<dynamic>) v as int],
          <int>[for (final dynamic v in m['goal'] as List<dynamic>) v as int],
        ),
    ];
  }
}
