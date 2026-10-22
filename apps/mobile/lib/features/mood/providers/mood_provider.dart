import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/mood_checkin.dart';
import '../../auth/auth_provider.dart';
import '../../auth/auth_state.dart';
import '../services/mood_service.dart';

enum MoodCheckinStatus { idle, saving, saved, error }
enum MoodHistoryStatus { loading, ready, error }

class MoodState {
  final String? selectedMood;
  final int? intensity;
  final String note;
  final MoodCheckinStatus status;
  final List<MoodCheckin> history;
  final MoodHistoryStatus historyStatus;
  final String? errorMessage;
  final String? historyErrorMessage;

  const MoodState({
    this.selectedMood,
    this.intensity,
    this.note = '',
    this.status = MoodCheckinStatus.idle,
    this.history = const [],
    this.historyStatus = MoodHistoryStatus.loading,
    this.errorMessage,
    this.historyErrorMessage,
  });

  MoodState copyWith({
    String? selectedMood,
    bool clearSelectedMood = false,
    int? intensity,
    bool clearIntensity = false,
    String? note,
    MoodCheckinStatus? status,
    List<MoodCheckin>? history,
    MoodHistoryStatus? historyStatus,
    String? errorMessage,
    bool clearErrorMessage = false,
    String? historyErrorMessage,
    bool clearHistoryErrorMessage = false,
  }) {
    return MoodState(
      selectedMood:
          clearSelectedMood ? null : (selectedMood ?? this.selectedMood),
      intensity: clearIntensity ? null : (intensity ?? this.intensity),
      note: note ?? this.note,
      status: status ?? this.status,
      history: history ?? this.history,
      historyStatus: historyStatus ?? this.historyStatus,
      errorMessage:
          clearErrorMessage ? null : (errorMessage ?? this.errorMessage),
      historyErrorMessage: clearHistoryErrorMessage
          ? null
          : (historyErrorMessage ?? this.historyErrorMessage),
    );
  }
}

class MoodNotifier extends StateNotifier<MoodState> {
  final Ref _ref;

  MoodNotifier(this._ref) : super(const MoodState()) {
    _ref.listen<AuthState>(authProvider, (previous, next) {
      if (previous?.userId != next.userId ||
          previous?.status != next.status) {
        if (next.status == AuthStatus.authenticated && next.userId != null) {
          loadHistory();
        } else if (next.status == AuthStatus.unauthenticated) {
          state = state.copyWith(
            history: const [],
            historyStatus: MoodHistoryStatus.ready,
            historyErrorMessage: 'Please sign in to view your check-in history.',
          );
        }
      }
    });

    final authState = _ref.read(authProvider);
    if (authState.status != AuthStatus.loading) {
      loadHistory();
    }
  }

  void selectMood(String mood) {
    state = state.copyWith(
      selectedMood: mood,
      clearErrorMessage: true,
    );
  }

  void setIntensity(int? intensity) {
    if (intensity == null) {
      state = state.copyWith(
        clearIntensity: true,
        clearErrorMessage: true,
      );
    } else {
      state = state.copyWith(
        intensity: intensity,
        clearErrorMessage: true,
      );
    }
  }

  void setNote(String note) {
    state = state.copyWith(
      note: note,
      clearErrorMessage: true,
    );
  }

  void resetForm() {
    state = state.copyWith(
      clearSelectedMood: true,
      clearIntensity: true,
      note: '',
      status: MoodCheckinStatus.idle,
      clearErrorMessage: true,
    );
  }

  void clearError() {
    state = state.copyWith(clearErrorMessage: true);
  }

  Future<void> loadHistory() async {
    final authState = _ref.read(authProvider);

    if (authState.status == AuthStatus.loading) {
      state = state.copyWith(
        historyStatus: MoodHistoryStatus.loading,
        clearHistoryErrorMessage: true,
      );
      return;
    }

    final userId = authState.userId;

    // NOTE: Child sessions are not supported on mobile until child PIN login is wired.
    // Child PIN verification is still a placeholder on mobile, so child tokens cannot
    // be exercised end-to-end here yet. Once child auth is wired, this should branch to
    // MoodService.listForChild using the child session token.
    if (userId == null) {
      state = state.copyWith(
        history: const [],
        historyStatus: MoodHistoryStatus.ready,
        historyErrorMessage: 'Please sign in to view your check-in history.',
      );
      return;
    }

    state = state.copyWith(
      historyStatus: MoodHistoryStatus.loading,
      clearHistoryErrorMessage: true,
    );

    try {
      final items = await MoodService.listForProfile(userId);
      if (!mounted) return;
      state = state.copyWith(
        history: items,
        historyStatus: MoodHistoryStatus.ready,
      );
    } catch (_) {
      if (!mounted) return;
      state = state.copyWith(
        historyStatus: MoodHistoryStatus.error,
        historyErrorMessage:
            'Unable to load check-in history. Please try again.',
      );
    }
  }

  Future<bool> saveCheckin() async {
    if (state.status == MoodCheckinStatus.saving) {
      return false;
    }

    final authState = _ref.read(authProvider);
    final userId = authState.userId;

    // NOTE: Child sessions are not supported on mobile until child PIN login is wired.
    // Child PIN verification is still a placeholder on mobile, so child tokens cannot
    // be exercised end-to-end here yet. Once child auth is wired, this should branch to
    // MoodService.createForChild using the child session token.
    if (userId == null) {
      state = state.copyWith(
        status: MoodCheckinStatus.error,
        errorMessage: 'Please sign in to save your mood check-in.',
      );
      return false;
    }

    final mood = state.selectedMood;
    if (mood == null || !moodValues.contains(mood)) {
      state = state.copyWith(
        status: MoodCheckinStatus.error,
        errorMessage: 'Please select how you are feeling to continue.',
      );
      return false;
    }

    final intensity = state.intensity;
    if (intensity != null &&
        (intensity < moodIntensityMin || intensity > moodIntensityMax)) {
      state = state.copyWith(
        status: MoodCheckinStatus.error,
        errorMessage:
            'Intensity must be between $moodIntensityMin and $moodIntensityMax.',
      );
      return false;
    }

    final trimmedNote = state.note.trim();
    final cleanNote = trimmedNote.isEmpty ? null : trimmedNote;

    if (cleanNote != null && cleanNote.length > moodNoteMaxLength) {
      state = state.copyWith(
        status: MoodCheckinStatus.error,
        errorMessage:
            'Your note is too long (maximum $moodNoteMaxLength characters).',
      );
      return false;
    }

    state = state.copyWith(
      status: MoodCheckinStatus.saving,
      clearErrorMessage: true,
    );

    try {
      await MoodService.createForProfile(
        profileId: userId,
        mood: mood,
        intensity: intensity,
        note: cleanNote,
      );
    } catch (_) {
      if (!mounted) return false;
      state = state.copyWith(
        status: MoodCheckinStatus.error,
        errorMessage:
            "We couldn't save your check-in right now. Please try again.",
      );
      return false;
    }

    if (!mounted) return true;
    state = state.copyWith(
      status: MoodCheckinStatus.saved,
      clearErrorMessage: true,
    );

    try {
      await loadHistory();
    } catch (_) {
      // Ignored: loadHistory updates historyStatus/historyErrorMessage itself.
    }

    return true;
  }

  Future<bool> retrySave() => saveCheckin();

  Future<void> refreshHistory() => loadHistory();
}

final moodProvider = StateNotifierProvider<MoodNotifier, MoodState>((ref) {
  return MoodNotifier(ref);
});
