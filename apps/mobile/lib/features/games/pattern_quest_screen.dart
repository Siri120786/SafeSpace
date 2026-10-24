import 'dart:math';
import 'package:flutter/material.dart';
import 'game_content.dart';
import 'game_scoring.dart';
import 'games_widgets.dart';
import 'pattern_logic.dart';
import 'sound_script.dart';

class PatternQuestScreen extends StatefulWidget {
  final GameEnv env;
  final VoidCallback onExit;
  final VoidCallback onAgain;
  const PatternQuestScreen({super.key, required this.env, required this.onExit, required this.onAgain});

  @override
  State<PatternQuestScreen> createState() => _PatternQuestScreenState();
}

class _PatternQuestScreenState extends State<PatternQuestScreen> {
  late final Difficulty _difficulty;
  late final List<PatternRound> _rounds;
  int _index = 0;
  List<int> _attempts = <int>[];
  List<bool> _hinted = <bool>[];
  int _tries = 0;
  bool _usedHint = false;
  final List<String> _wrong = <String>[];
  bool _solved = false;
  bool _done = false;
  int _fb = 0;
  late String _message;

  GameEnv get env => widget.env;
  PatternRound get _round => _rounds[_index];

  @override
  void initState() {
    super.initState();
    _difficulty = env.prefs.difficulty;
    _rounds = buildPatternGame(env.content, _difficulty, Random());
    _message = env.t('pq.prompt');
  }

  String _name(String s) => s == kGap ? 'missing' : (int.tryParse(s) != null ? s : env.name(s));

  void _hear() {
    final List<String> items = _solved ? solvedItems(_round) : _round.items;
    env.audio.playNotes(patternScript(noteIndexes(items)));
  }

  void _choose(String option) {
    if (_solved) return;
    env.audio.speak(_name(option));
    setState(() {
      _tries++;
      if (isCorrect(_round, option)) {
        _solved = true;
        final List<String> keys = env.content.patternFeedbackKeys('correct');
        _message = env.t(keys[_fb % keys.length]);
        env.audio.play(Effect.match);
      } else {
        _wrong.add(option);
        final List<String> keys = env.content.patternFeedbackKeys('retry');
        _message = env.t(keys[_fb % keys.length]);
        env.audio.play(Effect.miss);
      }
      _fb++;
    });
  }

  void _hint() {
    setState(() {
      _usedHint = true;
      _message = env.t(_round.hintKey);
    });
    env.audio.play(Effect.hint);
    env.audio.speak(env.t(_round.hintKey));
  }

  void _next() {
    final List<int> attempts = <int>[..._attempts, _tries];
    final List<bool> hinted = <bool>[..._hinted, _usedHint];
    if (_index + 1 < _rounds.length) {
      setState(() {
        _attempts = attempts;
        _hinted = hinted;
        _index++;
        _tries = 0;
        _usedHint = false;
        _wrong.clear();
        _solved = false;
        _message = env.t('pq.prompt');
      });
      return;
    }
    final int mistakes = attempts.fold(0, (int n, int x) => n + (x > 1 ? x - 1 : 0));
    env.controller.finishRound(RoundResult(
      gameId: 'pattern-quest',
      difficulty: _difficulty,
      score: patternScore(attempts, hinted),
      mistakes: mistakes,
      hints: hinted.where((bool h) => h).length,
    ));
    setState(() {
      _attempts = attempts;
      _hinted = hinted;
      _done = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final bool hasGap = !_done && gapIndex(_round) >= 0;
    final String prompt = hasGap ? env.t('pq.promptGap') : env.t('pq.prompt');
    return GameScaffold(
      env: env,
      gameId: 'pattern-quest',
      onExit: widget.onExit,
      readText: prompt,
      builder: (BuildContext context, bool paused) {
        if (_done) {
          return RoundSummary(
            env: env,
            gameId: 'pattern-quest',
            score: patternScore(_attempts, _hinted),
            message: env.t('pq.fb.correct1'),
            onAgain: widget.onAgain,
            onExit: widget.onExit,
          );
        }
        final List<String> shown = _solved ? solvedItems(_round) : displayItems(_round);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text('${_index + 1} / ${_rounds.length}', style: const TextStyle(color: Colors.black54)),
            const SizedBox(height: 8),
            Buddy(env: env, message: _message, speak: false),
            const SizedBox(height: 12),
            Text(prompt, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            Semantics(
              label: '$prompt ${shown.map(_name).join(', ')}',
              child: ExcludeSemantics(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24)),
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 8,
                    runSpacing: 8,
                    children: <Widget>[
                      for (final String s in shown)
                        Container(
                          width: 56,
                          height: 56,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: s == kGap ? const Color(0xFFFFEAF0) : const Color(0xFFF4F7EE),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: s == kGap ? const Color(0xFFFD7289) : const Color(0xFFD2DFC3), width: 2),
                          ),
                          child: Text(s == kGap ? '?' : s, style: const TextStyle(fontSize: 30)),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              children: <Widget>[
                OutlinedButton.icon(onPressed: _hear, icon: const Icon(Icons.music_note), label: Text(env.t('pq.hear'))),
                OutlinedButton.icon(
                  onPressed: _solved ? null : _hint,
                  icon: const Icon(Icons.lightbulb_outline),
                  label: Text(env.t('ui.hint')),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 12,
              runSpacing: 12,
              children: <Widget>[
                for (final String o in _round.options)
                  Semantics(
                    button: true,
                    label: _name(o),
                    child: ExcludeSemantics(
                      child: SizedBox(
                        width: 80,
                        height: 80,
                        child: Material(
                          color: _solved && o == _round.answer
                              ? const Color(0xFFE2EBD6)
                              : (_wrong.contains(o) ? const Color(0xFFF4F7EE) : Colors.white),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(24),
                            side: BorderSide(
                              color: _solved && o == _round.answer ? kGameGreen : const Color(0xFFD2DFC3),
                              width: 2,
                            ),
                          ),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(24),
                            onTap: _solved || _wrong.contains(o) ? null : () => _choose(o),
                            child: Center(
                              child: Opacity(
                                opacity: _wrong.contains(o) ? 0.4 : 1,
                                child: Text(o, style: const TextStyle(fontSize: 34)),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            if (_solved) ...<Widget>[
              const SizedBox(height: 16),
              Center(
                child: FilledButton(
                  onPressed: _next,
                  child: Text(_index + 1 < _rounds.length ? env.t('ui.next') : env.t('ui.done')),
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}
