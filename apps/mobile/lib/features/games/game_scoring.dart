/// Scoring and level suggestions. Scores are only for the player's own
/// "stars" and the caregiver's activity summary. They are never used to infer
/// ability, a diagnosis or intelligence (docs/games.md).
library;

import 'game_content.dart';

class RoundResult {
  final String gameId;
  final Difficulty difficulty;

  /// 0-100, or null for open-ended games with no score.
  final int? score;
  final int mistakes;
  final int hints;
  const RoundResult({
    required this.gameId,
    required this.difficulty,
    required this.score,
    required this.mistakes,
    required this.hints,
  });
}

int clampScore(num n) => n.round().clamp(0, 100).toInt();

/// 1 to 3 stars. Everyone who finishes gets at least one.
int starsFor(int? score) {
  if (score == null) return 3;
  return score >= 80 ? 3 : (score >= 50 ? 2 : 1);
}

/// Memory Match: every pair needs one try; extra tries and hints take a little off.
int memoryScore(int pairs, int mistakes, int hints) => clampScore((100 * pairs) / (pairs + mistakes) - hints * 5);

/// Pattern Quest and Feelings Detective: full credit on the first try, half on
/// the second, a quarter after that; a hint caps it at three quarters.
double questionCredit(int attempts, bool usedHint) {
  final double base = attempts <= 1 ? 1 : (attempts == 2 ? 0.5 : 0.25);
  return usedHint && base > 0.75 ? 0.75 : base;
}

int averageScore(List<double> credits) {
  if (credits.isEmpty) return 0;
  final double sum = credits.fold(0.0, (double a, double b) => a + b);
  return clampScore((100 * sum) / credits.length);
}

/// Maze: steps close to the shortest route score high; hints take a little off.
int mazeScore(int optimalSteps, int steps, int hints) {
  final int denominator = steps > optimalSteps ? steps : optimalSteps;
  return clampScore((100 * optimalSteps) / denominator - hints * 5);
}

class RecentRound {
  final Difficulty difficulty;
  final int mistakes;
  final int hints;
  const RecentRound(this.difficulty, this.mistakes, this.hints);

  Map<String, dynamic> toJson() => <String, dynamic>{'difficulty': difficulty.name, 'mistakes': mistakes, 'hints': hints};

  static RecentRound? fromJson(Object? j) {
    if (j is! Map) return null;
    final Difficulty? d = parseDifficulty(j['difficulty']);
    if (d == null || j['mistakes'] is! int || j['hints'] is! int) return null;
    return RecentRound(d, j['mistakes'] as int, j['hints'] as int);
  }
}

enum Suggestion { up, down, same }

/// Optional adaptation: looks at the last few rounds played at the CURRENT
/// level only. Smooth rounds suggest one step up; a run of hard rounds suggests
/// one step down. It is only ever offered; the player or caregiver decides.
Suggestion suggestDifficulty(Difficulty current, List<RecentRound> recent, AdaptationRules rules) {
  final List<RecentRound> all = recent.where((RecentRound r) => r.difficulty == current).toList();
  final List<RecentRound> here = all.length > rules.window ? all.sublist(all.length - rules.window) : all;
  if (here.length < rules.window) return Suggestion.same;
  final bool smooth = here.every((RecentRound r) => r.mistakes <= rules.upMistakes && r.hints <= rules.upHints);
  if (smooth && current != Difficulty.hard) return Suggestion.up;
  final bool struggling = here.every((RecentRound r) => r.mistakes >= rules.downMistakes);
  if (struggling && current != Difficulty.easy) return Suggestion.down;
  return Suggestion.same;
}

Difficulty nextDifficulty(Difficulty current, Suggestion direction) {
  final int i = current.index + (direction == Suggestion.up ? 1 : -1);
  return Difficulty.values[i.clamp(0, Difficulty.values.length - 1).toInt()];
}
