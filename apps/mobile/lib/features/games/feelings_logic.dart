/// Feelings Detective rules. More than one feeling can fit a situation, so a
/// choice is accepted unless it is marked "unlikely", and the feedback is
/// always gentle: nobody is told they are wrong about a feeling.
library;

import 'dart:math';
import 'game_content.dart';

List<FeelingsScenario> buildFeelingsGame(GameContent content, Difficulty difficulty, Random rng, {int? count}) {
  final List<FeelingsScenario> pool = List<FeelingsScenario>.from(content.scenarios(difficulty))..shuffle(rng);
  final int n = (count ?? content.feelingsRoundsPerGame).clamp(0, pool.length).toInt();
  return <FeelingsScenario>[
    for (final FeelingsScenario s in pool.take(n))
      s.withOrder(List<FeelingChoice>.from(s.feelings)..shuffle(rng), List<StepChoice>.from(s.steps)..shuffle(rng)),
  ];
}

class Judgement {
  final bool accepted;
  final String fit;

  /// Key of the feedback sentence to show.
  final String feedbackKey;
  const Judgement(this.accepted, this.fit, this.feedbackKey);
}

Judgement judgeFeeling(FeelingsScenario scenario, String feelingId) {
  String fit = 'unlikely';
  for (final FeelingChoice f in scenario.feelings) {
    if (f.id == feelingId) fit = f.fit;
  }
  return Judgement(fit != 'unlikely', fit, 'fd.fb.$fit');
}

Judgement judgeStep(FeelingsScenario scenario, String stepId) {
  String fit = 'notHelpful';
  for (final StepChoice s in scenario.steps) {
    if (s.id == stepId) fit = s.fit;
  }
  final String key = fit == 'helpful' ? 'fd.fb.helpful' : (fit == 'okay' ? 'fd.fb.okay2' : 'fd.fb.notHelpful');
  return Judgement(fit != 'notHelpful', fit, key);
}
