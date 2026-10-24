import 'dart:math';
import 'package:flutter/material.dart';
import 'feelings_logic.dart';
import 'game_content.dart';
import 'game_scoring.dart';
import 'games_widgets.dart';
import 'sound_script.dart';

enum _Phase { feeling, step, recap }

class FeelingsDetectiveScreen extends StatefulWidget {
  final GameEnv env;
  final VoidCallback onExit;
  final VoidCallback onAgain;
  final VoidCallback? onCheckMood;
  const FeelingsDetectiveScreen({super.key, required this.env, required this.onExit, required this.onAgain, this.onCheckMood});

  @override
  State<FeelingsDetectiveScreen> createState() => _FeelingsDetectiveScreenState();
}

class _FeelingsDetectiveScreenState extends State<FeelingsDetectiveScreen> {
  late final Difficulty _difficulty;
  late final List<FeelingsScenario> _scenarios;
  late final Map<String, String> _emoji;
  int _index = 0;
  _Phase _phase = _Phase.feeling;
  int _feelingTries = 0;
  int _stepTries = 0;
  int _clues = 0;
  final List<String> _tried = <String>[];
  String? _chosenFeeling;
  String? _chosenStep;
  final List<double> _credits = <double>[];
  int _mistakes = 0;
  int _hints = 0;
  String _message = '';
  bool _done = false;

  GameEnv get env => widget.env;
  FeelingsScenario get _s => _scenarios[_index];

  @override
  void initState() {
    super.initState();
    _difficulty = env.prefs.difficulty;
    _scenarios = buildFeelingsGame(env.content, _difficulty, Random());
    _emoji = env.content.feelingEmoji;
  }

  void _pickFeeling(String id) {
    env.audio.playNotes(feelingScript(id));
    env.audio.speak(env.content.feelingLabel(id, lang: env.lang));
    final Judgement j = judgeFeeling(_s, id);
    setState(() {
      _feelingTries++;
      _message = env.t(j.feedbackKey);
      if (j.accepted) {
        _chosenFeeling = id;
        _tried.clear();
        _phase = _Phase.step;
      } else {
        _tried.add(id);
        _mistakes++;
        env.audio.play(Effect.miss);
      }
    });
  }

  void _pickStep(String id) {
    final Judgement j = judgeStep(_s, id);
    setState(() {
      _stepTries++;
      _message = env.t(j.feedbackKey);
      if (j.accepted) {
        _chosenStep = id;
        _phase = _Phase.recap;
        env.audio.play(Effect.cheer);
      } else {
        _tried.add(id);
        _mistakes++;
        env.audio.play(Effect.miss);
      }
    });
  }

  void _showClue() {
    env.audio.play(Effect.hint);
    final int next = min(_clues + 1, _s.clueKeys.length);
    setState(() {
      if (next > _clues) _hints++;
      _clues = next;
    });
    env.audio.speak(env.t(_s.clueKeys[next - 1]));
  }

  void _next() {
    final double credit = (questionCredit(_feelingTries, _clues > 0) + questionCredit(_stepTries, false)) / 2;
    _credits.add(credit);
    if (_index + 1 < _scenarios.length) {
      setState(() {
        _index++;
        _phase = _Phase.feeling;
        _feelingTries = 0;
        _stepTries = 0;
        _clues = 0;
        _tried.clear();
        _chosenFeeling = null;
        _chosenStep = null;
        _message = '';
      });
      return;
    }
    env.controller.finishRound(RoundResult(
      gameId: 'feelings-detective',
      difficulty: _difficulty,
      score: averageScore(_credits),
      mistakes: _mistakes,
      hints: _hints,
    ));
    setState(() => _done = true);
  }

  @override
  Widget build(BuildContext context) {
    final String scene = _done ? '' : env.t(_s.sceneKey);
    final String question = _done
        ? ''
        : (_phase == _Phase.feeling
            ? env.t('fd.prompt.feeling', vars: <String, String>{'name': _s.name})
            : env.t('fd.prompt.step', vars: <String, String>{'name': _s.name}));
    return GameScaffold(
      env: env,
      gameId: 'feelings-detective',
      onExit: widget.onExit,
      readText: '$scene $question'.trim(),
      builder: (BuildContext context, bool paused) {
        if (_done) {
          return RoundSummary(
            env: env,
            gameId: 'feelings-detective',
            score: averageScore(_credits),
            message: env.t('fd.summary.note'),
            onAgain: widget.onAgain,
            onExit: widget.onExit,
            onCheckMood: widget.onCheckMood,
          );
        }
        final TextTheme text = Theme.of(context).textTheme;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text('${_index + 1} / ${_scenarios.length}', style: const TextStyle(color: Colors.black54)),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Semantics(label: '${_s.name}, ${env.name(_s.character)}', child: ExcludeSemantics(child: Text(_s.character, style: const TextStyle(fontSize: 46)))),
                        const SizedBox(width: 12),
                        Expanded(child: Text(scene, style: const TextStyle(fontSize: 16))),
                      ],
                    ),
                    if (_clues > 0) ...<Widget>[
                      const SizedBox(height: 8),
                      Semantics(
                        label: env.t('fd.clues'),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            for (final String k in _s.clueKeys.take(_clues)) Text('• ${env.t(k)}'),
                          ],
                        ),
                      ),
                    ],
                    if (_clues < _s.clueKeys.length && _phase != _Phase.recap)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: OutlinedButton.icon(
                          onPressed: _showClue,
                          icon: const Icon(Icons.search),
                          label: Text(env.t('fd.clue.show')),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (_message.isNotEmpty) ...<Widget>[
              const SizedBox(height: 8),
              Buddy(env: env, message: _message),
            ],
            const SizedBox(height: 12),
            if (_phase == _Phase.feeling) ...<Widget>[
              Text(question, style: text.titleLarge),
              const SizedBox(height: 8),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.5,
                children: <Widget>[
                  for (final FeelingChoice f in _s.feelings)
                    Semantics(
                      button: true,
                      label: env.content.feelingLabel(f.id, lang: env.lang),
                      child: ExcludeSemantics(
                        child: Material(
                          color: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(24),
                            side: const BorderSide(color: Color(0xFFD2DFC3), width: 2),
                          ),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(24),
                            onTap: () => _pickFeeling(f.id),
                            child: Opacity(
                              opacity: _tried.contains(f.id) ? 0.5 : 1,
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: <Widget>[
                                  Text(_emoji[f.id] ?? '🙂', style: const TextStyle(fontSize: 36)),
                                  Text(env.content.feelingLabel(f.id, lang: env.lang), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
            if (_phase == _Phase.step) ...<Widget>[
              if (_chosenFeeling != null)
                Text('${_emoji[_chosenFeeling!] ?? ''} ${env.content.feelingLabel(_chosenFeeling!, lang: env.lang)}'),
              const SizedBox(height: 4),
              Text(question, style: text.titleLarge),
              const SizedBox(height: 8),
              for (final StepChoice st in _s.steps)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      alignment: Alignment.centerLeft,
                      padding: const EdgeInsets.all(16),
                      backgroundColor: Colors.white,
                    ),
                    onPressed: _tried.contains(st.id) ? null : () => _pickStep(st.id),
                    child: Text(env.t(st.textKey), style: const TextStyle(fontSize: 16)),
                  ),
                ),
            ],
            if (_phase == _Phase.recap)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: <Widget>[
                      Text(env.t('fd.summary', vars: <String, String>{'name': _s.name}), style: text.titleMedium),
                      const SizedBox(height: 8),
                      Text(
                        '${_emoji[_chosenFeeling] ?? ''} ${_chosenFeeling == null ? '' : env.content.feelingLabel(_chosenFeeling!, lang: env.lang)}'
                        ' → ${env.t(_s.steps.firstWhere((StepChoice x) => x.id == _chosenStep).textKey)}',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: _next,
                        child: Text(_index + 1 < _scenarios.length ? env.t('ui.next') : env.t('ui.done')),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
