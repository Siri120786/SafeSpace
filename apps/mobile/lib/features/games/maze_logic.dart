/// Maze Explorer rules: movement, shortest path (for hints and scoring) and undo.
library;

import 'dart:collection';
import 'dart:math';
import 'game_content.dart';

enum Dir { up, down, left, right }

const Map<Dir, List<int>> _delta = <Dir, List<int>>{
  Dir.up: <int>[0, -1],
  Dir.down: <int>[0, 1],
  Dir.left: <int>[-1, 0],
  Dir.right: <int>[1, 0],
};

enum MazeEvent { none, move, bump, undo, won }

class MazeState {
  final MazeDef maze;
  final List<int> pos; // [x, y]

  /// Where the explorer has been, oldest first, for undo. Does not include [pos].
  final List<List<int>> history;
  final int steps;
  final int hints;

  /// Bumps into walls, only used to give kind feedback.
  final int bumps;
  final bool won;
  final MazeEvent lastEvent;

  const MazeState({
    required this.maze,
    required this.pos,
    this.history = const <List<int>>[],
    this.steps = 0,
    this.hints = 0,
    this.bumps = 0,
    this.won = false,
    this.lastEvent = MazeEvent.none,
  });

  MazeState copyWith({
    List<int>? pos,
    List<List<int>>? history,
    int? steps,
    int? hints,
    int? bumps,
    bool? won,
    MazeEvent? lastEvent,
  }) =>
      MazeState(
        maze: maze,
        pos: pos ?? this.pos,
        history: history ?? this.history,
        steps: steps ?? this.steps,
        hints: hints ?? this.hints,
        bumps: bumps ?? this.bumps,
        won: won ?? this.won,
        lastEvent: lastEvent ?? this.lastEvent,
      );
}

MazeDef pickMaze(GameContent content, Difficulty difficulty, Random rng) {
  final List<MazeDef> all = content.mazes(difficulty);
  return all[rng.nextInt(all.length)];
}

MazeState newMazeGame(MazeDef maze) => MazeState(maze: maze, pos: List<int>.from(maze.start));

bool isOpen(MazeDef maze, int x, int y) =>
    y >= 0 && y < maze.rows.length && x >= 0 && x < maze.columns && maze.rows[y][x] == '.';

bool _same(List<int> a, List<int> b) => a[0] == b[0] && a[1] == b[1];

MazeState move(MazeState state, Dir dir) {
  if (state.won) return state;
  final List<int> d = _delta[dir]!;
  final int nx = state.pos[0] + d[0];
  final int ny = state.pos[1] + d[1];
  if (!isOpen(state.maze, nx, ny)) {
    return state.copyWith(bumps: state.bumps + 1, lastEvent: MazeEvent.bump);
  }
  final List<int> pos = <int>[nx, ny];
  final bool won = _same(pos, state.maze.goal);
  return state.copyWith(
    pos: pos,
    history: <List<int>>[...state.history, state.pos],
    steps: state.steps + 1,
    won: won,
    lastEvent: won ? MazeEvent.won : MazeEvent.move,
  );
}

/// Direction of an adjacent square from the explorer, or null if it isn't adjacent.
Dir? dirTo(List<int> from, List<int> to) {
  for (final MapEntry<Dir, List<int>> e in _delta.entries) {
    if (from[0] + e.value[0] == to[0] && from[1] + e.value[1] == to[1]) return e.key;
  }
  return null;
}

MazeState undo(MazeState state) {
  if (state.won || state.history.isEmpty) return state;
  // Taking a step back also takes the step off the count: undo is never a penalty.
  return state.copyWith(
    pos: state.history.last,
    history: state.history.sublist(0, state.history.length - 1),
    steps: state.steps - 1,
    lastEvent: MazeEvent.undo,
  );
}

/// Shortest route from [from] to the goal, including both ends; null if there is none.
List<List<int>>? shortestPath(MazeDef maze, List<int> from) {
  String key(List<int> p) => '${p[0]},${p[1]}';
  final Map<String, List<int>?> prev = <String, List<int>?>{key(from): null};
  final Queue<List<int>> queue = Queue<List<int>>()..add(from);
  while (queue.isNotEmpty) {
    final List<int> cur = queue.removeFirst();
    if (_same(cur, maze.goal)) {
      final List<List<int>> path = <List<int>>[];
      List<int>? p = cur;
      while (p != null) {
        path.insert(0, p);
        p = prev[key(p)];
      }
      return path;
    }
    for (final List<int> d in _delta.values) {
      final List<int> n = <int>[cur[0] + d[0], cur[1] + d[1]];
      if (isOpen(maze, n[0], n[1]) && !prev.containsKey(key(n))) {
        prev[key(n)] = cur;
        queue.add(n);
      }
    }
  }
  return null;
}

int optimalSteps(MazeDef maze) {
  final List<List<int>>? p = shortestPath(maze, maze.start);
  return (p?.length ?? 1) - 1;
}

class MazeHint {
  final MazeState state;
  final List<int>? next;
  final Dir? dir;
  const MazeHint(this.state, this.next, this.dir);
}

/// The next square on the best route from where the explorer is. Costs a hint.
MazeHint hint(MazeState state) {
  if (state.won) return MazeHint(state, null, null);
  final List<List<int>>? path = shortestPath(state.maze, state.pos);
  if (path == null || path.length < 2) return MazeHint(state, null, null);
  return MazeHint(state.copyWith(hints: state.hints + 1), path[1], dirTo(state.pos, path[1]));
}
