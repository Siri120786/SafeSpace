import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'game_content.dart';
import 'game_scoring.dart';
import 'games_widgets.dart';
import 'maze_logic.dart';
import 'sound_script.dart';

class MazeExplorerScreen extends StatefulWidget {
  final GameEnv env;
  final VoidCallback onExit;
  final VoidCallback onAgain;
  const MazeExplorerScreen({super.key, required this.env, required this.onExit, required this.onAgain});

  @override
  State<MazeExplorerScreen> createState() => _MazeExplorerScreenState();
}

class _MazeExplorerScreenState extends State<MazeExplorerScreen> {
  late final Difficulty _difficulty;
  late final MazeDef _maze;
  late final int _best;
  late MazeState _game;
  late String _message;
  List<int>? _pointer;
  bool _finished = false;
  Timer? _timer;

  GameEnv get env => widget.env;

  @override
  void initState() {
    super.initState();
    _difficulty = env.prefs.difficulty;
    _maze = pickMaze(env.content, _difficulty, Random());
    _best = optimalSteps(_maze);
    _game = newMazeGame(_maze);
    _message = env.t('mz.prompt');
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _go(Dir dir) {
    final MazeState next = move(_game, dir);
    if (identical(next, _game)) return;
    setState(() {
      _game = next;
      _pointer = null;
      if (next.lastEvent == MazeEvent.bump) {
        _message = env.t('mz.stuck');
      } else {
        _message = next.won ? env.t('mz.done2') : env.t('mz.prompt');
      }
    });
    if (next.lastEvent == MazeEvent.bump) {
      env.audio.play(Effect.bump);
    } else {
      env.audio.play(next.won ? Effect.match : Effect.step);
    }
    if (next.won && !_finished) {
      _finished = true;
      env.controller.finishRound(RoundResult(
        gameId: 'maze-explorer',
        difficulty: _difficulty,
        score: mazeScore(_best, next.steps, next.hints),
        mistakes: next.bumps,
        hints: next.hints,
      ));
    }
  }

  void _undo() {
    final MazeState next = undo(_game);
    if (identical(next, _game)) return;
    setState(() {
      _game = next;
      _pointer = null;
    });
    env.audio.play(Effect.undo);
  }

  void _hint() {
    final MazeHint h = hint(_game);
    if (h.next == null) return;
    final String dirText = h.dir == null ? '' : env.t('mz.${h.dir!.name}');
    setState(() {
      _game = h.state;
      _pointer = h.next;
      _message = '${env.t('mz.hint.text')} $dirText'.trim();
    });
    env.audio.play(Effect.hint);
    env.audio.speak(dirText);
    _timer?.cancel();
    _timer = Timer(const Duration(milliseconds: 2500), () {
      if (mounted) setState(() => _pointer = null);
    });
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;
    final Map<LogicalKeyboardKey, Dir> keys = <LogicalKeyboardKey, Dir>{
      LogicalKeyboardKey.arrowUp: Dir.up,
      LogicalKeyboardKey.arrowDown: Dir.down,
      LogicalKeyboardKey.arrowLeft: Dir.left,
      LogicalKeyboardKey.arrowRight: Dir.right,
    };
    final Dir? d = keys[event.logicalKey];
    if (d == null) return KeyEventResult.ignored;
    _go(d);
    return KeyEventResult.handled;
  }

  @override
  Widget build(BuildContext context) {
    return Focus(
      onKeyEvent: _onKey,
      child: GameScaffold(
        env: env,
        gameId: 'maze-explorer',
        onExit: widget.onExit,
        readText: env.t('mz.prompt'),
        builder: (BuildContext context, bool paused) {
          if (_game.won) {
            return RoundSummary(
              env: env,
              gameId: 'maze-explorer',
              score: mazeScore(_best, _game.steps, _game.hints),
              message: env.t('mz.done1'),
              onAgain: widget.onAgain,
              onExit: widget.onExit,
            );
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Buddy(env: env, message: _message, speak: false),
              const SizedBox(height: 8),
              Semantics(liveRegion: true, child: Text('${_game.steps} ${env.t('mz.moves')}')),
              const SizedBox(height: 8),
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 380),
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8EFE0),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white, width: 4),
                    ),
                    child: GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: _maze.columns,
                      children: <Widget>[
                        for (int y = 0; y < _maze.rows.length; y++)
                          for (int x = 0; x < _maze.columns; x++) _cell(x, y),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Center(
                child: SizedBox(
                  width: 190,
                  child: Column(
                    children: <Widget>[
                      _dirButton(Dir.up, '⬆️', env.t('mz.up')),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: <Widget>[
                          _dirButton(Dir.left, '⬅️', env.t('mz.left')),
                          _dirButton(Dir.down, '⬇️', env.t('mz.down')),
                          _dirButton(Dir.right, '➡️', env.t('mz.right')),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                children: <Widget>[
                  OutlinedButton.icon(
                    onPressed: _game.history.isEmpty ? null : _undo,
                    icon: const Icon(Icons.undo),
                    label: Text(env.t('ui.undo')),
                  ),
                  OutlinedButton.icon(
                    onPressed: _hint,
                    icon: const Icon(Icons.lightbulb_outline),
                    label: Text(env.t('ui.hint')),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _dirButton(Dir dir, String glyph, String label) {
    return Semantics(
      button: true,
      label: label,
      child: ExcludeSemantics(
        child: SizedBox(
          width: 58,
          height: 54,
          child: Material(
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: Color(0xFFD2DFC3), width: 2),
            ),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => _go(dir),
              child: Center(child: Text(glyph, style: const TextStyle(fontSize: 22))),
            ),
          ),
        ),
      ),
    );
  }

  Widget _cell(int x, int y) {
    final bool wall = _maze.rows[y][x] == '#';
    final bool here = _game.pos[0] == x && _game.pos[1] == y;
    final bool goal = _maze.goal[0] == x && _maze.goal[1] == y;
    final bool trail = _game.history.any((List<int> p) => p[0] == x && p[1] == y);
    final bool hinted = _pointer != null && _pointer![0] == x && _pointer![1] == y;
    final bool adjacent = !wall && dirTo(_game.pos, <int>[x, y]) != null;
    final Color color = wall
        ? const Color(0xFF526D2B)
        : hinted
            ? const Color(0xFFFFEAF0)
            : trail
                ? const Color(0xFFE6EEC4)
                : Colors.white;
    return Semantics(
      label: here ? 'explorer' : (goal ? 'finish flag' : (wall ? 'wall' : 'path')),
      child: ExcludeSemantics(
        child: GestureDetector(
          onTap: adjacent ? () => _go(dirTo(_game.pos, <int>[x, y])!) : null,
          child: Container(
            decoration: BoxDecoration(
              color: color,
              border: adjacent ? Border.all(color: const Color(0xFFD2DFC3)) : null,
            ),
            alignment: Alignment.center,
            child: FittedBox(child: Text(here ? '🚶' : (goal ? '🏁' : (hinted ? '✨' : '')))),
          ),
        ),
      ),
    );
  }
}
