import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safespace_mobile/features/calm_tools/breathing_logic.dart';
import 'package:safespace_mobile/features/calm_tools/breathing_screen.dart';
import 'package:safespace_mobile/features/calm_tools/grounding_logic.dart';
import 'package:safespace_mobile/features/calm_tools/grounding_screen.dart';
import 'package:safespace_mobile/features/calm_tools/low_sensory.dart';

Widget _wrap(Widget child, {bool saved = false, bool osReduced = false}) {
  return ProviderScope(
    overrides: <Override>[
      savedReducedSensoryProvider.overrideWith((ref) async => saved),
    ],
    child: MediaQuery(
      data: MediaQueryData(disableAnimations: osReduced),
      child: MaterialApp(home: child),
    ),
  );
}

void main() {
  group('breathing logic', () {
    test('phases follow inhale 4 / hold 4 / exhale 6', () {
      expect(getBreathingState(Duration.zero).phase, BreathingPhase.inhale);
      expect(getBreathingState(const Duration(milliseconds: 3999)).phase, BreathingPhase.inhale);
      expect(getBreathingState(const Duration(seconds: 4)).phase, BreathingPhase.hold);
      expect(getBreathingState(const Duration(seconds: 8)).phase, BreathingPhase.exhale);
      final next = getBreathingState(const Duration(seconds: 14));
      expect(next.phase, BreathingPhase.inhale);
      expect(next.cycle, 2);
    });

    test('countdown and finish are accurate', () {
      expect(getBreathingState(Duration.zero).secondsLeft, 4);
      expect(getBreathingState(const Duration(seconds: 1)).secondsLeft, 3);
      expect(getBreathingState(const Duration(seconds: 69)).finished, false);
      expect(getBreathingState(const Duration(seconds: 70)).finished, true);
    });
  });

  group('grounding logic', () {
    test('next and back stay inside the steps', () {
      expect(groundingSteps.length, 5);
      expect(prevStepIndex(0), 0);
      expect(nextStepIndex(4), 4);
      expect(nextStepIndex(0), 1);
      expect(isLastStep(4), true);
    });
  });

  test('low sensory: either signal turns it on', () {
    expect(resolveLowSensory(osReducedMotion: false, savedPreference: false), false);
    expect(resolveLowSensory(osReducedMotion: true, savedPreference: false), true);
    expect(resolveLowSensory(osReducedMotion: false, savedPreference: true), true);
  });

  group('breathing screen', () {
    testWidgets('start, pause, resume and reset work', (tester) async {
      await tester.pumpWidget(_wrap(BreathingScreen(onExit: () {})));
      await tester.pump();
      expect(find.text('Start'), findsOneWidget);

      await tester.tap(find.text('Start'));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Breathe in'), findsOneWidget);
      expect(find.text('Pause'), findsOneWidget);

      await tester.pump(const Duration(seconds: 4));
      expect(find.text('Hold'), findsOneWidget);

      await tester.tap(find.text('Pause'));
      await tester.pump();
      expect(find.text('Paused'), findsOneWidget);
      expect(find.text('Resume'), findsOneWidget);

      await tester.tap(find.text('Reset'));
      await tester.pump();
      expect(find.text('Ready when you are'), findsOneWidget);
      expect(find.text('Start'), findsOneWidget);
    });

    testWidgets('Exit button and Escape key both exit', (tester) async {
      int exits = 0;
      await tester.pumpWidget(_wrap(BreathingScreen(onExit: () => exits++)));
      await tester.pump();
      await tester.tap(find.text('Exit'));
      expect(exits, 1);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      expect(exits, 2);
    });

    testWidgets('low-sensory mode removes the scale animation', (tester) async {
      await tester.pumpWidget(_wrap(BreathingScreen(onExit: () {}), osReduced: true));
      await tester.pump();
      await tester.tap(find.text('Start'));
      await tester.pump(const Duration(milliseconds: 200));
      final scale = tester.widget<AnimatedScale>(find.byType(AnimatedScale));
      expect(scale.scale, 1.0);
      expect(scale.duration, Duration.zero);
      // stop the periodic timer before the test ends
      await tester.tap(find.text('Pause'));
      await tester.pump();
    });

    testWidgets('saved preference also removes the animation', (tester) async {
      await tester.pumpWidget(_wrap(BreathingScreen(onExit: () {}), saved: true));
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('Start'));
      await tester.pump(const Duration(milliseconds: 200));
      expect(tester.widget<AnimatedScale>(find.byType(AnimatedScale)).duration, Duration.zero);
      await tester.tap(find.text('Pause'));
      await tester.pump();
    });
  });

  group('grounding screen', () {
    testWidgets('next, back and exit work', (tester) async {
      int exits = 0;
      await tester.pumpWidget(_wrap(GroundingScreen(onExit: () => exits++)));
      await tester.pump();
      expect(find.text('5 things you can see'), findsOneWidget);
      expect(tester.widget<OutlinedButton>(find.widgetWithText(OutlinedButton, 'Back')).onPressed, isNull);

      await tester.tap(find.text('Next'));
      await tester.pump();
      expect(find.text('4 things you can feel'), findsOneWidget);

      await tester.tap(find.text('Back'));
      await tester.pump();
      expect(find.text('5 things you can see'), findsOneWidget);

      await tester.tap(find.text('Exit'));
      expect(exits, 1);
    });

    testWidgets('reaches the end and offers Finish', (tester) async {
      int exits = 0;
      await tester.pumpWidget(_wrap(GroundingScreen(onExit: () => exits++)));
      await tester.pump();
      for (int i = 0; i < 4; i++) {
        await tester.tap(find.text('Next'));
        await tester.pump();
      }
      expect(find.text('1 thing you can taste'), findsOneWidget);
      await tester.tap(find.text('Done'));
      await tester.pump();
      expect(find.text('Well done'), findsOneWidget);
      await tester.tap(find.text('Finish'));
      expect(exits, 1);
    });
  });
}
