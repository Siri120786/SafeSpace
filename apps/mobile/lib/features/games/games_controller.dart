/// State for Games Corner: local-first progress, comfort settings, and the
/// best-effort sync to the account. Play never waits for the network.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;
import '../../services/supabase_service.dart';
import '../auth/auth_provider.dart';
import 'game_audio.dart';
import 'game_content.dart';
import 'game_progress.dart';
import 'game_scoring.dart';
import 'imagine_logic.dart';

/// device: saved here only. account: also saved to the account. later: waiting for the network.
enum SaveStatus { device, account, later }

class GamesState {
  final LocalGameState data;
  final bool loading;
  final SaveStatus saveStatus;
  const GamesState({this.data = const LocalGameState(), this.loading = true, this.saveStatus = SaveStatus.device});

  GamesState copyWith({LocalGameState? data, bool? loading, SaveStatus? saveStatus}) =>
      GamesState(data: data ?? this.data, loading: loading ?? this.loading, saveStatus: saveStatus ?? this.saveStatus);
}

class GamesController extends StateNotifier<GamesState> {
  final String ownerId;
  final GameLocalStore store;
  final GameBackend? backend;
  bool _syncing = false;
  bool _disposed = false;

  GamesController({required this.ownerId, required this.store, required this.backend}) : super(const GamesState()) {
    _init();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  void _set(GamesState s) {
    if (!_disposed) state = s;
  }

  Future<void> _init() async {
    final LocalGameState local = await loadState(ownerId, store);
    _set(state.copyWith(data: local, loading: false));
    final GameBackend? b = backend;
    if (b == null) return;
    try {
      final remote = await b.fetch();
      await _commit((LocalGameState s) => mergeRemote(s, remote.progress, remote.prefs));
      await sync();
    } catch (_) {
      _set(state.copyWith(saveStatus: SaveStatus.later));
    }
  }

  Future<void> _commit(LocalGameState Function(LocalGameState) change) async {
    final LocalGameState next = change(state.data);
    _set(state.copyWith(data: next));
    await saveState(ownerId, next, store);
  }

  /// Sends rounds that are still waiting. Safe to call at any time.
  Future<void> sync() async {
    final GameBackend? b = backend;
    if (b == null || _syncing) return;
    _syncing = true;
    try {
      for (int pass = 0; pass < 3; pass++) {
        final List<PendingRound> snapshot = state.data.pending;
        final FlushResult result = await flushPending(snapshot, b);
        final int sent = snapshot.length - result.remaining.length;
        if (sent > 0) {
          await _commit((LocalGameState s) => s.copyWith(pending: s.pending.sublist(sent.clamp(0, s.pending.length).toInt())));
        }
        if (!result.ok) {
          _set(state.copyWith(saveStatus: SaveStatus.later));
          return;
        }
        if (state.data.pending.isEmpty) break;
      }
      _set(state.copyWith(saveStatus: SaveStatus.account));
    } finally {
      _syncing = false;
    }
  }

  /// Records one finished round and starts saving it to the account.
  Future<void> finishRound(RoundResult result) async {
    await _commit((LocalGameState s) => applyRound(s, result, DateTime.now()));
    _set(state.copyWith(saveStatus: SaveStatus.device));
    await sync();
  }

  /// Changes comfort settings. [current] is what the player sees now (saved
  /// settings, or the calm-aware defaults).
  Future<void> updatePrefs(GamePrefs current, GamePrefs Function(GamePrefs) change) async {
    final GamePrefs next = change(current);
    await _commit((LocalGameState s) => s.copyWith(prefs: next));
    final GameBackend? b = backend;
    if (b != null) {
      try {
        await b.savePrefs(next);
      } catch (_) {
        _set(state.copyWith(saveStatus: SaveStatus.later));
      }
    }
  }

  Future<void> addCreation(Creation c) => _commit((LocalGameState s) => s.copyWith(creations: keepCreation(s.creations, c)));

  Suggestion suggestionFor(String gameId, GamePrefs prefs, AdaptationRules rules) =>
      suggestDifficulty(prefs.difficulty, state.data.recent[gameId] ?? const <RecentRound>[], rules);
}

// ---- Storage and account adapters ------------------------------------------

class SharedPrefsGameStore implements GameLocalStore {
  @override
  Future<String?> read(String key) async => (await SharedPreferences.getInstance()).getString(key);

  @override
  Future<bool> write(String key, String value) async => (await SharedPreferences.getInstance()).setString(key, value);
}

/// An adult's own progress, under their login and the database's row-level rules.
class SupabaseGameBackend implements GameBackend {
  final String userId;
  SupabaseGameBackend(this.userId);

  SupabaseClient get _c => SupabaseService.client;

  @override
  Future<({List<ProgressRow> progress, GamePrefs? prefs})> fetch() async {
    final List<dynamic> rows = await _c
        .from('game_progress')
        .select('game_id, difficulty, rounds_completed, best_score, last_played_at')
        .eq('profile_id', userId);
    final Map<String, dynamic>? p = await _c
        .from('game_preferences')
        .select('difficulty, reduced_motion, sound_enabled, voice_enabled')
        .eq('profile_id', userId)
        .maybeSingle();
    final List<ProgressRow> progress = <ProgressRow>[
      for (final dynamic r in rows)
        if (parseDifficulty(r['difficulty']) != null)
          ProgressRow(
            r['game_id'] as String,
            parseDifficulty(r['difficulty'])!,
            r['rounds_completed'] as int,
            r['best_score'] as int?,
            r['last_played_at'] as String,
          ),
    ];
    final GamePrefs? prefs = p == null
        ? null
        : GamePrefs.fromJson(<String, dynamic>{
            'difficulty': p['difficulty'],
            'reducedMotion': p['reduced_motion'],
            'soundEnabled': p['sound_enabled'],
            'voiceEnabled': p['voice_enabled'],
          });
    return (progress: progress, prefs: prefs);
  }

  @override
  Future<void> record(PendingRound round) async {
    await _c.rpc('record_game_round', params: <String, dynamic>{
      'p_game_id': round.gameId,
      'p_difficulty': round.difficulty.name,
      'p_score': round.score,
    });
  }

  @override
  Future<void> savePrefs(GamePrefs prefs) async {
    await _c.rpc('save_game_preferences', params: <String, dynamic>{
      'p_difficulty': prefs.difficulty.name,
      'p_reduced_motion': prefs.reducedMotion,
      'p_sound_enabled': prefs.soundEnabled,
      'p_voice_enabled': prefs.voiceEnabled,
    });
  }
}

// ---- Providers ---------------------------------------------------------------

final gameContentProvider = FutureProvider<GameContent>((ref) => GameContent.load());

/// Tests replace this with a [RecordingGameAudio] or a silent [GameAudio].
final gameAudioProvider = Provider<GameAudio>((ref) {
  final GameAudio audio = DeviceGameAudio();
  ref.onDispose(audio.dispose);
  return audio;
});

final gameStoreProvider = Provider<GameLocalStore>((ref) => SharedPrefsGameStore());

/// Whose progress this is: the signed-in adult, or this device (the child
/// sign-in flow in the mobile app is not built yet, so a child's games stay on
/// the device).
final gamesOwnerProvider = Provider<String>((ref) => ref.watch(authProvider).userId ?? 'device');

/// The account copy, only for a signed-in adult when Supabase is configured.
final gameBackendProvider = Provider<GameBackend?>((ref) {
  final String? userId = ref.watch(authProvider).userId;
  if (userId == null) return null;
  try {
    SupabaseService.client; // throws when Supabase was not initialised
    return SupabaseGameBackend(userId);
  } catch (_) {
    return null;
  }
});

final gamesControllerProvider =
    StateNotifierProvider.autoDispose.family<GamesController, GamesState, String>((ref, ownerId) {
  return GamesController(
    ownerId: ownerId,
    store: ref.watch(gameStoreProvider),
    backend: ref.watch(gameBackendProvider),
  );
});
