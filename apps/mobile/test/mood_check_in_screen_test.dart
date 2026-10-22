import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safespace_mobile/core/theme.dart';
import 'package:safespace_mobile/features/mood/providers/mood_provider.dart';
import 'package:safespace_mobile/features/mood/screens/mood_check_in_screen.dart';
import 'package:safespace_mobile/models/mood_checkin.dart';

class FakeMoodNotifier extends StateNotifier<MoodState>
    implements MoodNotifier {
  int saveCount = 0;
  int retrySaveCount = 0;
  int loadHistoryCount = 0;
  int resetFormCount = 0;
  int clearErrorCount = 0;

  FakeMoodNotifier([
    super.initialState = const MoodState(
      historyStatus: MoodHistoryStatus.ready,
    ),
  ]);

  @override
  void selectMood(String mood) {
    state = state.copyWith(selectedMood: mood, clearErrorMessage: true);
  }

  @override
  void setIntensity(int? intensity) {
    if (intensity == null) {
      state = state.copyWith(clearIntensity: true, clearErrorMessage: true);
    } else {
      state = state.copyWith(intensity: intensity, clearErrorMessage: true);
    }
  }

  @override
  void setNote(String note) {
    state = state.copyWith(note: note, clearErrorMessage: true);
  }

  @override
  void resetForm() {
    resetFormCount++;
    state = state.copyWith(
      clearSelectedMood: true,
      clearIntensity: true,
      note: '',
      status: MoodCheckinStatus.idle,
      clearErrorMessage: true,
    );
  }

  @override
  void clearError() {
    clearErrorCount++;
    state = state.copyWith(clearErrorMessage: true);
  }

  @override
  Future<void> loadHistory() async {
    loadHistoryCount++;
  }

  @override
  Future<bool> saveCheckin() async {
    saveCount++;
    state = state.copyWith(status: MoodCheckinStatus.saved);
    return true;
  }

  @override
  Future<bool> retrySave() async {
    retrySaveCount++;
    return saveCheckin();
  }

  @override
  Future<void> refreshHistory() async => loadHistory();
}

Widget createTestWidget(FakeMoodNotifier notifier) {
  return ProviderScope(
    overrides: [
      moodProvider.overrideWith((ref) => notifier),
    ],
    child: MaterialApp(
      theme: AppTheme.lightTheme,
      home: const MoodCheckInScreen(),
    ),
  );
}

void main() {
  group('MoodCheckInScreen Widget Tests', () {
    testWidgets('Renders all initial sections and header correctly',
        (WidgetTester tester) async {
      final notifier = FakeMoodNotifier();
      await tester.pumpWidget(createTestWidget(notifier));
      await tester.pumpAndSettle();

      expect(find.text('Mood Check-in'), findsOneWidget);
      expect(find.byIcon(Icons.arrow_back), findsOneWidget);
      expect(find.text('How are you feeling right now?'), findsOneWidget);
      expect(find.text('Intensity'), findsOneWidget);
      expect(find.text('Add a note'), findsOneWidget);
      expect(find.text('Save Check-in'), findsOneWidget);
      expect(find.text('No check-ins yet'), findsOneWidget);
    });

    testWidgets('Selecting a mood updates notifier state',
        (WidgetTester tester) async {
      final notifier = FakeMoodNotifier();
      await tester.pumpWidget(createTestWidget(notifier));
      await tester.pumpAndSettle();

      expect(notifier.state.selectedMood, isNull);

      final happyFinder = find.text('Happy');
      expect(happyFinder, findsOneWidget);

      await tester.ensureVisible(happyFinder);
      await tester.tap(happyFinder);
      await tester.pumpAndSettle();

      expect(notifier.state.selectedMood, equals('happy'));
    });

    testWidgets(
        'Save button is disabled initially and enabled when mood is selected',
        (WidgetTester tester) async {
      final notifier = FakeMoodNotifier();
      await tester.pumpWidget(createTestWidget(notifier));
      await tester.pumpAndSettle();

      // Attempt tapping Save while disabled
      final saveButton = find.text('Save Check-in');
      await tester.ensureVisible(saveButton);
      await tester.tap(saveButton, warnIfMissed: false);
      await tester.pumpAndSettle();

      expect(notifier.saveCount, equals(0));

      // Select a mood to enable Save
      final happyFinder = find.text('Happy');
      await tester.ensureVisible(happyFinder);
      await tester.tap(happyFinder);
      await tester.pumpAndSettle();

      // Now tapping Save triggers saveCheckin
      await tester.ensureVisible(saveButton);
      await tester.tap(saveButton);
      await tester.pumpAndSettle();

      expect(notifier.saveCount, equals(1));
    });

    testWidgets('Optional intensity can be selected, toggled and cleared',
        (WidgetTester tester) async {
      final notifier = FakeMoodNotifier();
      await tester.pumpWidget(createTestWidget(notifier));
      await tester.pumpAndSettle();

      // Select intensity 3
      final level3Finder = find.text('3');
      expect(level3Finder, findsOneWidget);

      await tester.ensureVisible(level3Finder);
      await tester.tap(level3Finder);
      await tester.pumpAndSettle();

      expect(notifier.state.intensity, equals(3));
      expect(find.text('Clear'), findsOneWidget);

      // Tapping 3 again toggles it off
      await tester.ensureVisible(level3Finder);
      await tester.tap(level3Finder);
      await tester.pumpAndSettle();

      expect(notifier.state.intensity, isNull);

      // Select intensity 4 and tap Clear button
      final level4Finder = find.text('4');
      await tester.ensureVisible(level4Finder);
      await tester.tap(level4Finder);
      await tester.pumpAndSettle();
      expect(notifier.state.intensity, equals(4));

      final clearFinder = find.text('Clear');
      await tester.ensureVisible(clearFinder);
      await tester.tap(clearFinder);
      await tester.pumpAndSettle();
      expect(notifier.state.intensity, isNull);
    });

    testWidgets('Note input updates state and live counter reflects length',
        (WidgetTester tester) async {
      final notifier = FakeMoodNotifier();
      await tester.pumpWidget(createTestWidget(notifier));
      await tester.pumpAndSettle();

      expect(find.text('0 / $moodNoteMaxLength'), findsOneWidget);

      final noteField = find.byType(TextField);
      expect(noteField, findsOneWidget);

      await tester.ensureVisible(noteField);
      await tester.enterText(noteField, 'Feeling thoughtful today');
      await tester.pumpAndSettle();

      expect(notifier.state.note, equals('Feeling thoughtful today'));
      expect(
        find.text('${'Feeling thoughtful today'.length} / $moodNoteMaxLength'),
        findsOneWidget,
      );
    });

    testWidgets('Renders loading state for history',
        (WidgetTester tester) async {
      final notifier = FakeMoodNotifier(
        const MoodState(
          historyStatus: MoodHistoryStatus.loading,
          history: [],
        ),
      );
      await tester.pumpWidget(createTestWidget(notifier));
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Loading your history…'), findsOneWidget);
    });

    testWidgets('Renders error state with retry for saving and history',
        (WidgetTester tester) async {
      final notifier = FakeMoodNotifier(
        const MoodState(
          status: MoodCheckinStatus.error,
          errorMessage: 'We could not save your check-in right now.',
          historyStatus: MoodHistoryStatus.error,
          historyErrorMessage: 'Unable to load history.',
          history: [],
        ),
      );
      await tester.pumpWidget(createTestWidget(notifier));
      await tester.pumpAndSettle();

      // Save error banner
      expect(
        find.text('We could not save your check-in right now.'),
        findsOneWidget,
      );
      // History error view
      expect(find.text('Unable to load history.'), findsOneWidget);

      // Tap save banner retry button
      final saveRetryFinder = find.text('Try Again').first;
      await tester.ensureVisible(saveRetryFinder);
      await tester.tap(saveRetryFinder);
      await tester.pumpAndSettle();
      expect(notifier.retrySaveCount, equals(1));

      // Tap history retry button
      final historyRetryFinder = find.text('Try Again').last;
      await tester.ensureVisible(historyRetryFinder);
      await tester.tap(historyRetryFinder);
      await tester.pumpAndSettle();
      expect(notifier.loadHistoryCount, equals(1));
    });

    testWidgets('Renders gentle empty state when history is empty',
        (WidgetTester tester) async {
      final notifier = FakeMoodNotifier(
        const MoodState(
          historyStatus: MoodHistoryStatus.ready,
          history: [],
        ),
      );
      await tester.pumpWidget(createTestWidget(notifier));
      await tester.pumpAndSettle();

      expect(find.text('🌱'), findsOneWidget);
      expect(find.text('No check-ins yet'), findsOneWidget);
      expect(
        find.text(
            "Whenever you're ready to check in, your previous reflections will show up here."),
        findsOneWidget,
      );
    });

    testWidgets(
        'Renders saved confirmation banner and history entry on saved state',
        (WidgetTester tester) async {
      const checkin = MoodCheckin(
        id: 'chk-1',
        profileId: 'prof-1',
        mood: 'happy',
        intensity: 4,
        note: 'Had a peaceful morning walking outside.',
        isPrivateNote: false,
        createdAt: '2026-10-21T10:00:00Z',
      );

      final notifier = FakeMoodNotifier(
        const MoodState(
          status: MoodCheckinStatus.saved,
          historyStatus: MoodHistoryStatus.ready,
          history: [checkin],
        ),
      );

      await tester.pumpWidget(createTestWidget(notifier));
      await tester.pumpAndSettle();

      // Saved banner
      expect(find.text('Your check-in has been saved.'), findsOneWidget);

      // History entry
      expect(find.text('My History'), findsOneWidget);
      expect(find.text('1 entry'), findsOneWidget);
      expect(find.text('Happy'), findsNWidgets(2)); // 1 in grid, 1 in history
      expect(find.text('Intensity: 4/5'), findsOneWidget);
      expect(
        find.text('Had a peaceful morning walking outside.'),
        findsOneWidget,
      );

      // Dismiss banner calls resetForm
      final dismissButton = find.byTooltip('Dismiss confirmation');
      expect(dismissButton, findsOneWidget);

      await tester.ensureVisible(dismissButton);
      await tester.tap(dismissButton);
      await tester.pumpAndSettle();

      expect(notifier.resetFormCount, equals(1));
    });
  });
}
