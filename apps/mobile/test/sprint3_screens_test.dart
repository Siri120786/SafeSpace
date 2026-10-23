import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safespace_mobile/features/calm_tools/low_sensory.dart';
import 'package:safespace_mobile/features/story_workflow/story_logic.dart';
import 'package:safespace_mobile/features/story_workflow/story_workflow_screen.dart';
import 'package:safespace_mobile/features/wellness_modules/module_content.dart';
import 'package:safespace_mobile/features/wellness_modules/module_screens.dart';

const String goodBody =
    'Once there was a small bird who learned to wait for the rain to stop. Then it flew home.';

Widget _wrap(Widget child) {
  return ProviderScope(
    overrides: <Override>[
      savedReducedSensoryProvider.overrideWith((ref) async => false),
    ],
    child: MaterialApp(home: child),
  );
}

void main() {
  group('story logic', () {
    test('valid draft passes; empty or short ones are rejected', () {
      expect(validateStory('A kind day', goodBody), isEmpty);
      expect(validateStory('', goodBody).first, contains('title'));
      expect(validateStory('Title', 'too short').first, contains('at least'));
    });

    test('flagged wording blocks sending', () {
      final issues = validateStory('Title', '$goodBody You should hurt yourself.');
      expect(issues.any((i) => i.contains('gentler')), true);
    });

    test('draft -> pending -> approved -> readable', () {
      final draft = createDraft('s1', 'A kind day', goodBody);
      expect(canRead(draft), false);
      final sent = submitForApproval(draft);
      expect(sent.ok, true);
      final approved = approveStory(sent.story!, true);
      expect(approved.ok, true);
      expect(canRead(approved.story!), true);
    });

    test('only a caregiver approves; cannot skip approval; rejection needs a reason', () {
      final draft = createDraft('s1', 'A kind day', goodBody);
      expect(approveStory(draft, true).ok, false);
      final sent = submitForApproval(draft).story!;
      expect(approveStory(sent, false).ok, false);
      expect(rejectStory(sent, true, '  ').ok, false);
      final rej = rejectStory(sent, true, 'Make it shorter');
      expect(rej.story!.status, StoryStatus.rejected);
      expect(canRead(rej.story!), false);
      expect(submitForApproval(rej.story!).ok, true);
    });
  });

  test('cycle care is adult-only', () {
    expect(canOpenCycleCare('user'), true);
    expect(canOpenCycleCare('caregiver'), false);
    expect(canOpenCycleCare(null), false);
  });

  group('story screen', () {
    testWidgets('non-caregivers cannot write', (tester) async {
      await tester.pumpWidget(_wrap(StoryWorkflowScreen(isCaregiver: false, onExit: () {})));
      await tester.pump();
      expect(find.textContaining('is for caregivers'), findsOneWidget);
      expect(find.text('Save draft'), findsNothing);
    });

    testWidgets('caregiver can write, send, approve and read', (tester) async {
      await tester.pumpWidget(_wrap(StoryWorkflowScreen(isCaregiver: true, onExit: () {})));
      await tester.pump();
      expect(find.textContaining('not saved yet'), findsOneWidget);

      await tester.enterText(find.widgetWithText(TextField, 'Title'), 'A kind day');
      await tester.enterText(find.widgetWithText(TextField, 'Story'), goodBody);
      await tester.ensureVisible(find.text('Save draft'));
      await tester.tap(find.text('Save draft'));
      await tester.pump();
      expect(find.text('Draft'), findsOneWidget);

      await tester.ensureVisible(find.text('Send for approval'));
      await tester.tap(find.text('Send for approval'));
      await tester.pump();
      expect(find.text('Waiting for approval'), findsOneWidget);

      await tester.ensureVisible(find.text('Approve'));
      await tester.tap(find.text('Approve'));
      await tester.pump();
      expect(find.text('Approved'), findsOneWidget);

      await tester.ensureVisible(find.text('Read story'));
      await tester.tap(find.text('Read story'));
      await tester.pump();
      expect(find.text(goodBody), findsOneWidget);
    });

    testWidgets('an empty draft shows a visible error', (tester) async {
      await tester.pumpWidget(_wrap(StoryWorkflowScreen(isCaregiver: true, onExit: () {})));
      await tester.pump();
      await tester.ensureVisible(find.text('Save draft'));
      await tester.tap(find.text('Save draft'));
      await tester.pump();
      expect(find.text('Please add a title.'), findsOneWidget);
    });

    testWidgets('Exit button and Escape both exit', (tester) async {
      int exits = 0;
      await tester.pumpWidget(_wrap(StoryWorkflowScreen(isCaregiver: true, onExit: () => exits++)));
      await tester.pump();
      await tester.tap(find.text('Exit'));
      expect(exits, 1);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      expect(exits, 2);
    });
  });

  group('module screens', () {
    testWidgets('every module screen has Exit, the review notice and the not-saved warning', (tester) async {
      final List<Widget> screens = <Widget>[
        CalmSpaceScreen(onExit: () {}),
        BrightDaysScreen(onExit: () {}),
        SafeHarborScreen(onExit: () {}),
        CycleCareScreen(role: 'user', onExit: () {}),
      ];
      for (final Widget s in screens) {
        await tester.pumpWidget(_wrap(s));
        await tester.pump();
        expect(find.text('Exit'), findsOneWidget);
        expect(find.textContaining('waiting for a professional review'), findsOneWidget);
        expect(find.textContaining('not saved yet'), findsOneWidget);
      }
    });

    testWidgets('cycle care blocks caregivers', (tester) async {
      await tester.pumpWidget(_wrap(CycleCareScreen(role: 'caregiver', onExit: () {})));
      await tester.pump();
      expect(find.textContaining('adult accounts only'), findsOneWidget);
      expect(find.byType(CheckboxListTile), findsNothing);
    });

    testWidgets('bright days: add goal, tick it, see encouragement; empty goal shows an error', (tester) async {
      await tester.pumpWidget(_wrap(BrightDaysScreen(onExit: () {})));
      await tester.pump();

      await tester.ensureVisible(find.text('Add goal'));
      await tester.tap(find.text('Add goal'));
      await tester.pump();
      expect(find.text('Please type a goal first.'), findsOneWidget);

      await tester.enterText(find.widgetWithText(TextField, 'Or write your own'), 'Go for a walk');
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Add goal'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Add goal'));
      await tester.pump();
      expect(find.byType(CheckboxListTile), findsOneWidget);

      await tester.ensureVisible(find.byType(CheckboxListTile).first);
      await tester.tap(find.byType(CheckboxListTile).first);
      await tester.pump();
      expect(find.text(encouragements.first), findsOneWidget);
    });

    testWidgets('safe harbor steps forward and back', (tester) async {
      await tester.pumpWidget(_wrap(SafeHarborScreen(onExit: () {})));
      await tester.pump();
      expect(find.textContaining('step 1 of'), findsOneWidget);
      await tester.ensureVisible(find.text('Next'));
      await tester.tap(find.text('Next'));
      await tester.pump();
      expect(find.textContaining('step 2 of'), findsOneWidget);
      await tester.ensureVisible(find.text('Back'));
      await tester.tap(find.text('Back'));
      await tester.pump();
      expect(find.textContaining('step 1 of'), findsOneWidget);
    });
  });
}
