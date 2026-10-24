/// Pattern Quest rules.
library;

import 'dart:math';
import 'game_content.dart';
import 'game_scoring.dart';

const String kGap = '?';

/// Rounds for one game: a shuffled selection, with the answer options shuffled too.
List<PatternRound> buildPatternGame(GameContent content, Difficulty difficulty, Random rng, {int? count}) {
  final List<PatternRound> pool = List<PatternRound>.from(content.patternRounds(difficulty))..shuffle(rng);
  final int n = (count ?? content.patternRoundsPerGame).clamp(0, pool.length).toInt();
  return <PatternRound>[
    for (final PatternRound r in pool.take(n)) r.withOptions(List<String>.from(r.options)..shuffle(rng)),
  ];
}

/// Index of the missing item, or -1 when the question is "what comes next?".
int gapIndex(PatternRound round) => round.items.indexOf(kGap);

/// The row as the player sees it: a gap or a trailing "?" for what comes next.
List<String> displayItems(PatternRound round) =>
    gapIndex(round) >= 0 ? round.items : <String>[...round.items, kGap];

bool isCorrect(PatternRound round, String choice) => choice == round.answer;

/// The finished row, used to read the pattern aloud and to show the solved state.
List<String> solvedItems(PatternRound round) {
  final int i = gapIndex(round);
  if (i < 0) return <String>[...round.items, round.answer];
  return <String>[for (int k = 0; k < round.items.length; k++) k == i ? round.answer : round.items[k]];
}

/// Musical position for each item (first new picture = 0, next new = 1 ...).
/// Equal pictures get equal notes, so the pattern can be heard as well as seen.
List<int> noteIndexes(List<String> items) {
  final List<String> seen = <String>[];
  return <int>[
    for (final String x in items)
      () {
        int i = seen.indexOf(x);
        if (i < 0) {
          seen.add(x);
          i = seen.length - 1;
        }
        return i;
      }(),
  ];
}

/// Checks that a numeric round follows its declared rule. Used by content tests.
bool followsRule(PatternRound round) {
  final PatternRule? rule = round.rule;
  if (rule == null) return true;
  final List<int?> nums = solvedItems(round).map(int.tryParse).toList();
  if (nums.any((int? n) => n == null)) return false;
  for (int i = 1; i < nums.length; i++) {
    final int cur = nums[i]!;
    final int prev = nums[i - 1]!;
    if (rule.type == 'add' && cur - prev != rule.by) return false;
    if (rule.type == 'double' && cur != prev * 2) return false;
    if (rule.type == 'fibonacci' && i >= 2 && cur != prev + nums[i - 2]!) return false;
  }
  return true;
}

int patternScore(List<int> attempts, List<bool> hinted) => averageScore(<double>[
      for (int i = 0; i < attempts.length; i++) questionCredit(attempts[i], i < hinted.length && hinted[i]),
    ]);
