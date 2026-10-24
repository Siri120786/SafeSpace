import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'game_content.dart';
import 'game_scoring.dart';
import 'games_widgets.dart';
import 'memory_logic.dart';
import 'sound_script.dart';

class MemoryMatchScreen extends StatefulWidget {
  final GameEnv env;
  final VoidCallback onExit;
  final VoidCallback onAgain;
  const MemoryMatchScreen({super.key, required this.env, required this.onExit, required this.onAgain});

  @override
  State<MemoryMatchScreen> createState() => _MemoryMatchScreenState();
}

class _MemoryMatchScreenState extends State<MemoryMatchScreen> {
  late final Difficulty _difficulty;
  late MemoryState _game;
  late String _message;
  List<int> _pointer = <int>[];
  int _feedbackCount = 0;
  bool _finished = false;
  final List<Timer> _timers = <Timer>[];

  GameEnv get env => widget.env;

  @override
  void initState() {
    super.initState();
    _difficulty = env.prefs.difficulty;
    _game = newMemoryGame(env.content, _difficulty, Random());
    _message = env.t('mm.prompt');
  }

  @override
  void dispose() {
    for (final Timer t in _timers) {
      t.cancel();
    }
    super.dispose();
  }

  void _later(VoidCallback fn, Duration d) {
    _timers.add(Timer(d, () {
      if (mounted) fn();
    }));
  }

  void _say(String kind) {
    final List<String> keys = env.content.memoryFeedbackKeys(kind);
    _message = env.t(keys[_feedbackCount % keys.length]);
    _feedbackCount++;
  }

  void _onCard(int index) {
    final MemoryState next = flipCard(_game, index);
    if (identical(next, _game)) return;
    setState(() {
      _game = next;
      _pointer = <int>[];
      switch (next.lastEvent) {
        case MemoryEvent.miss:
          _say('miss');
        case MemoryEvent.match:
          _say('match');
        case MemoryEvent.won:
          _say('done');
        case MemoryEvent.flip:
        case MemoryEvent.none:
          break;
      }
    });
    env.audio.speak(env.name(next.cards[index].face));
    switch (next.lastEvent) {
      case MemoryEvent.miss:
        env.audio.play(Effect.flip);
        _later(() => env.audio.play(Effect.miss), const Duration(milliseconds: 180));
        _later(
          () => setState(() => _game = resolveMismatch(_game)),
          Duration(milliseconds: env.calm ? env.content.memoryFlipBackCalmMs : env.content.memoryFlipBackMs),
        );
      case MemoryEvent.match:
        env.audio.play(Effect.match);
      case MemoryEvent.won:
        if (!_finished) {
          _finished = true;
          env.controller.finishRound(RoundResult(
            gameId: 'memory-match',
            difficulty: _difficulty,
            score: memoryScore(next.totalPairs, next.mistakes, next.hints),
            mistakes: next.mistakes,
            hints: next.hints,
          ));
        }
      case MemoryEvent.flip:
      case MemoryEvent.none:
        env.audio.play(Effect.flip);
    }
  }

  void _onHint() {
    final HintResult h = hintPair(_game);
    if (h.pair == null) return;
    setState(() {
      _game = h.state;
      _pointer = h.pair!;
      _message = env.t('mm.hint.text');
    });
    env.audio.play(Effect.hint);
    _later(() => setState(() => _pointer = <int>[]), const Duration(milliseconds: 2200));
  }

  String _label(int i) {
    final MemoryCard c = _game.cards[i];
    if (c.state == CardState.down) return 'Card ${i + 1}, face down';
    return '${env.name(c.face)}${c.state == CardState.matched ? ', matched' : ''}';
  }

  @override
  Widget build(BuildContext context) {
    return GameScaffold(
      env: env,
      gameId: 'memory-match',
      onExit: widget.onExit,
      readText: env.t('mm.prompt'),
      builder: (BuildContext context, bool paused) {
        if (_game.won) {
          return RoundSummary(
            env: env,
            gameId: 'memory-match',
            score: memoryScore(_game.totalPairs, _game.mistakes, _game.hints),
            message: _message,
            onAgain: widget.onAgain,
            onExit: widget.onExit,
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Buddy(env: env, message: _message, speak: false),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[
                Text('${_game.pairsLeft} ${env.t('mm.pairsLeft')}'),
                OutlinedButton.icon(
                  onPressed: _game.locked ? null : _onHint,
                  icon: const Icon(Icons.lightbulb_outline),
                  label: Text(env.t('ui.hint')),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: _game.columns * 112.0),
                child: GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: _game.columns,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  children: <Widget>[
                    for (final MemoryCard c in _game.cards) _tile(c),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _tile(MemoryCard c) {
    final bool hinted = _pointer.contains(c.index);
    final Color fill = c.state == CardState.matched
        ? const Color(0xFFE2EBD6)
        : c.state == CardState.up
            ? Colors.white
            : const Color(0xFFE8EFE0);
    return Semantics(
      button: true,
      selected: c.state != CardState.down,
      label: _label(c.index),
      child: ExcludeSemantics(
        child: Material(
          color: fill,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: BorderSide(
              color: hinted ? const Color(0xFFFD7289) : (c.state == CardState.matched ? kGameGreen : const Color(0xFFD2DFC3)),
              width: hinted ? 4 : 2,
            ),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: () => _onCard(c.index),
            child: Center(
              child: Text(c.state == CardState.down ? '❔' : c.face, style: const TextStyle(fontSize: 38)),
            ),
          ),
        ),
      ),
    );
  }
}
