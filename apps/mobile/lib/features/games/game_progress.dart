/// Local-first progress. Everything a player does is saved on this device
/// first; the account copy (Supabase) is best-effort and catches up later. A
/// failed save never stops play (docs/games.md). Mirrors
/// apps/web/src/features/games/lib/progress.ts.
library;

import 'dart:convert';
import 'game_content.dart';
import 'game_scoring.dart';
import 'imagine_logic.dart';

class ProgressRow {
  final String gameId;
  final Difficulty difficulty;
  final int roundsCompleted;
  final int? bestScore;
  final String lastPlayedAt;
  const ProgressRow(this.gameId, this.difficulty, this.roundsCompleted, this.bestScore, this.lastPlayedAt);

  Map<String, dynamic> toJson() => <String, dynamic>{
        'gameId': gameId,
        'difficulty': difficulty.name,
        'roundsCompleted': roundsCompleted,
        'bestScore': bestScore,
        'lastPlayedAt': lastPlayedAt,
      };

  static ProgressRow? fromJson(Object? j) {
    if (j is! Map) return null;
    final Difficulty? d = parseDifficulty(j['difficulty']);
    if (d == null || j['gameId'] is! String || j['roundsCompleted'] is! int || j['lastPlayedAt'] is! String) return null;
    return ProgressRow(j['gameId'] as String, d, j['roundsCompleted'] as int, j['bestScore'] as int?, j['lastPlayedAt'] as String);
  }
}

class GamePrefs {
  final Difficulty difficulty;
  final bool reducedMotion;
  final bool soundEnabled;
  final bool voiceEnabled;
  const GamePrefs({
    required this.difficulty,
    required this.reducedMotion,
    required this.soundEnabled,
    required this.voiceEnabled,
  });

  /// Calm mode starts with sound off and reduced motion on; otherwise sound on, read-aloud off.
  factory GamePrefs.defaults({required bool lowSensory}) => GamePrefs(
        difficulty: Difficulty.easy,
        reducedMotion: lowSensory,
        soundEnabled: !lowSensory,
        voiceEnabled: false,
      );

  GamePrefs copyWith({Difficulty? difficulty, bool? reducedMotion, bool? soundEnabled, bool? voiceEnabled}) => GamePrefs(
        difficulty: difficulty ?? this.difficulty,
        reducedMotion: reducedMotion ?? this.reducedMotion,
        soundEnabled: soundEnabled ?? this.soundEnabled,
        voiceEnabled: voiceEnabled ?? this.voiceEnabled,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'difficulty': difficulty.name,
        'reducedMotion': reducedMotion,
        'soundEnabled': soundEnabled,
        'voiceEnabled': voiceEnabled,
      };

  static GamePrefs? fromJson(Object? j) {
    if (j is! Map) return null;
    final Difficulty? d = parseDifficulty(j['difficulty']);
    if (d == null || j['reducedMotion'] is! bool || j['soundEnabled'] is! bool || j['voiceEnabled'] is! bool) return null;
    return GamePrefs(
      difficulty: d,
      reducedMotion: j['reducedMotion'] as bool,
      soundEnabled: j['soundEnabled'] as bool,
      voiceEnabled: j['voiceEnabled'] as bool,
    );
  }
}

class PendingRound {
  final String gameId;
  final Difficulty difficulty;
  final int? score;
  const PendingRound(this.gameId, this.difficulty, this.score);

  Map<String, dynamic> toJson() => <String, dynamic>{'gameId': gameId, 'difficulty': difficulty.name, 'score': score};

  static PendingRound? fromJson(Object? j) {
    if (j is! Map) return null;
    final Difficulty? d = parseDifficulty(j['difficulty']);
    if (d == null || j['gameId'] is! String) return null;
    return PendingRound(j['gameId'] as String, d, j['score'] as int?);
  }
}

const int kMaxRecent = 5;
const int kMaxPending = 50;

class LocalGameState {
  final List<ProgressRow> progress;

  /// Null until the player (or their caregiver's default) chooses.
  final GamePrefs? prefs;

  /// Last few rounds per game, only for the optional level suggestion.
  final Map<String, List<RecentRound>> recent;

  /// Rounds not yet saved to the account.
  final List<PendingRound> pending;

  /// Characters, scenes and stories the player chose to keep. Never leaves the device.
  final List<Creation> creations;

  const LocalGameState({
    this.progress = const <ProgressRow>[],
    this.prefs,
    this.recent = const <String, List<RecentRound>>{},
    this.pending = const <PendingRound>[],
    this.creations = const <Creation>[],
  });

  LocalGameState copyWith({
    List<ProgressRow>? progress,
    GamePrefs? prefs,
    Map<String, List<RecentRound>>? recent,
    List<PendingRound>? pending,
    List<Creation>? creations,
  }) =>
      LocalGameState(
        progress: progress ?? this.progress,
        prefs: prefs ?? this.prefs,
        recent: recent ?? this.recent,
        pending: pending ?? this.pending,
        creations: creations ?? this.creations,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'v': 1,
        'progress': <Map<String, dynamic>>[for (final ProgressRow r in progress) r.toJson()],
        'prefs': prefs?.toJson(),
        'recent': <String, dynamic>{
          for (final MapEntry<String, List<RecentRound>> e in recent.entries)
            e.key: <Map<String, dynamic>>[for (final RecentRound r in e.value) r.toJson()],
        },
        'pending': <Map<String, dynamic>>[for (final PendingRound p in pending) p.toJson()],
        'creations': <Map<String, dynamic>>[for (final Creation c in creations) c.toJson()],
      };

  /// Reads saved state. Anything missing or damaged becomes a fresh state.
  static LocalGameState fromJsonString(String? raw) {
    if (raw == null || raw.isEmpty) return const LocalGameState();
    try {
      final Object? j = jsonDecode(raw);
      if (j is! Map<String, dynamic> || j['v'] != 1) return const LocalGameState();
      final Map<String, List<RecentRound>> recent = <String, List<RecentRound>>{};
      final Object? rawRecent = j['recent'];
      if (rawRecent is Map<String, dynamic>) {
        rawRecent.forEach((String k, dynamic v) {
          if (v is List) {
            recent[k] = v.map(RecentRound.fromJson).whereType<RecentRound>().toList();
          }
        });
      }
      return LocalGameState(
        progress: (j['progress'] as List<dynamic>? ?? <dynamic>[]).map(ProgressRow.fromJson).whereType<ProgressRow>().toList(),
        prefs: GamePrefs.fromJson(j['prefs']),
        recent: recent,
        pending: (j['pending'] as List<dynamic>? ?? <dynamic>[]).map(PendingRound.fromJson).whereType<PendingRound>().toList(),
        creations: (j['creations'] as List<dynamic>? ?? <dynamic>[]).map(Creation.fromJson).whereType<Creation>().toList(),
      );
    } catch (_) {
      return const LocalGameState();
    }
  }
}

/// Adds one finished round to the local record.
LocalGameState applyRound(LocalGameState state, RoundResult result, DateTime now) {
  final int? score = result.score == null ? null : clampScore(result.score!);
  final String at = now.toUtc().toIso8601String();
  final int i = state.progress.indexWhere((ProgressRow p) => p.gameId == result.gameId && p.difficulty == result.difficulty);
  final ProgressRow? prev = i >= 0 ? state.progress[i] : null;
  int? best = prev?.bestScore;
  if (score != null) best = (best == null || score > best) ? score : best;
  final ProgressRow row = ProgressRow(result.gameId, result.difficulty, (prev?.roundsCompleted ?? 0) + 1, best, at);
  final List<ProgressRow> progress = i >= 0
      ? <ProgressRow>[for (int k = 0; k < state.progress.length; k++) k == i ? row : state.progress[k]]
      : <ProgressRow>[...state.progress, row];

  final List<RecentRound> mine = <RecentRound>[
    ...(state.recent[result.gameId] ?? const <RecentRound>[]),
    RecentRound(result.difficulty, result.mistakes, result.hints),
  ];
  final Map<String, List<RecentRound>> recent = <String, List<RecentRound>>{
    ...state.recent,
    result.gameId: mine.length > kMaxRecent ? mine.sublist(mine.length - kMaxRecent) : mine,
  };
  final List<PendingRound> queue = <PendingRound>[...state.pending, PendingRound(result.gameId, result.difficulty, score)];
  return state.copyWith(
    progress: progress,
    recent: recent,
    pending: queue.length > kMaxPending ? queue.sublist(queue.length - kMaxPending) : queue,
  );
}

/// Stars collected so far: one per finished round.
int totalRounds(List<ProgressRow> rows) => rows.fold(0, (int n, ProgressRow r) => n + r.roundsCompleted);

int roundsFor(List<ProgressRow> rows, String gameId) =>
    rows.where((ProgressRow r) => r.gameId == gameId).fold(0, (int n, ProgressRow r) => n + r.roundsCompleted);

/// Folds the account's copy into the local one without losing either: for each
/// game and level the larger count and best score win. Preferences from the
/// account are used only when none are saved locally.
LocalGameState mergeRemote(LocalGameState local, List<ProgressRow> remote, GamePrefs? remotePrefs) {
  final Map<String, ProgressRow> rows = <String, ProgressRow>{};
  String key(ProgressRow r) => '${r.gameId}:${r.difficulty.name}';
  for (final ProgressRow r in local.progress) {
    rows[key(r)] = r;
  }
  for (final ProgressRow r in remote) {
    final ProgressRow? have = rows[key(r)];
    if (have == null) {
      rows[key(r)] = r;
      continue;
    }
    int? best = have.bestScore;
    if (r.bestScore != null) best = (best == null || r.bestScore! > best) ? r.bestScore : best;
    rows[key(r)] = ProgressRow(
      have.gameId,
      have.difficulty,
      r.roundsCompleted > have.roundsCompleted ? r.roundsCompleted : have.roundsCompleted,
      best,
      have.lastPlayedAt.compareTo(r.lastPlayedAt) >= 0 ? have.lastPlayedAt : r.lastPlayedAt,
    );
  }
  return local.copyWith(progress: rows.values.toList(), prefs: local.prefs ?? remotePrefs);
}

/// What the app needs from the account. Adults and children each have an adapter.
abstract class GameBackend {
  Future<({List<ProgressRow> progress, GamePrefs? prefs})> fetch();
  Future<void> record(PendingRound round);
  Future<void> savePrefs(GamePrefs prefs);
}

class FlushResult {
  final List<PendingRound> remaining;
  final bool ok;
  const FlushResult(this.remaining, this.ok);
}

/// Sends waiting rounds in order. Stops at the first failure and keeps the rest.
Future<FlushResult> flushPending(List<PendingRound> pending, GameBackend backend) async {
  List<PendingRound> left = pending;
  while (left.isNotEmpty) {
    try {
      await backend.record(left.first);
    } catch (_) {
      return FlushResult(left, false);
    }
    left = left.sublist(1);
  }
  return FlushResult(left, true);
}

/// Where saved state lives on the device. A blocked or broken store just means
/// nothing is remembered; play continues.
abstract class GameLocalStore {
  Future<String?> read(String key);
  Future<bool> write(String key, String value);
}

class MemoryGameStore implements GameLocalStore {
  final Map<String, String> values = <String, String>{};
  @override
  Future<String?> read(String key) async => values[key];
  @override
  Future<bool> write(String key, String value) async {
    values[key] = value;
    return true;
  }
}

String gameStorageKey(String ownerId) => 'safespace_games_v1_$ownerId';

Future<LocalGameState> loadState(String ownerId, GameLocalStore store) async {
  try {
    return LocalGameState.fromJsonString(await store.read(gameStorageKey(ownerId)));
  } catch (_) {
    return const LocalGameState();
  }
}

Future<bool> saveState(String ownerId, LocalGameState state, GameLocalStore store) async {
  try {
    return await store.write(gameStorageKey(ownerId), jsonEncode(state.toJson()));
  } catch (_) {
    return false;
  }
}
