import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safespace_mobile/features/calm_tools/low_sensory.dart';
import 'package:safespace_mobile/features/story_workflow/story_logic.dart';
import 'package:safespace_mobile/features/story_workflow/story_workflow_screen.dart';
import 'package:safespace_mobile/features/wellness_modules/cycle_care_extras.dart';
import 'package:safespace_mobile/features/wellness_modules/diet_plan.dart';
import 'package:safespace_mobile/features/wellness_modules/health_assessment.dart';
import 'package:shared_preferences/shared_preferences.dart';
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

  group('cycle care extras logic', () {
    test('check-in wording is gentle and the summary never ranks or streaks', () {
      expect(describeCheckIn(<String, Level>{}), contains('Skipping is always fine'));
      expect(describeCheckIn(<String, Level>{'energy': Level.low, 'sleep': Level.good}).toLowerCase(), contains('energy: running low'));
      expect(summarizeCheckIns(<CheckIn>[]), contains('No check-ins yet'));
      expect(summarizeCheckIns(<CheckIn>[<String, Level>{'energy': Level.good}]), contains('1 time on'));
      expect(summarizeCheckIns(<CheckIn>[<String, Level>{'comfort': Level.low}, <String, Level>{'comfort': Level.low}]), contains('mention it to your doctor'));
      expect(summarizeCheckIns(<CheckIn>[<String, Level>{'mood': Level.good}]).toLowerCase(), isNot(contains('streak')));
    });

    test('note lists trim and reject empty, duplicate, long and overflow input', () {
      expect(addNote(<String>[], '  Ask about tests  ').items, <String>['Ask about tests']);
      expect(addNote(<String>[], '   ').error, isNotNull);
      expect(addNote(<String>['Vitamin D'], 'vitamin d').error, isNotNull);
      expect(addNote(<String>[], 'x' * (maxItemLength + 1)).error, isNotNull);
      expect(addNote(List<String>.generate(maxItems, (i) => 'n$i'), 'one more').error, isNotNull);
      expect(removeNote(<String>['a', 'b', 'c'], 1), <String>['a', 'c']);
    });

    test('water tally stays within 0 and the limit', () {
      expect(bumpWater(0, -1), 0);
      expect(bumpWater(2, 1), 3);
      expect(bumpWater(maxWater, 1), maxWater);
    });

    test('wording is body-neutral', () {
      for (final String t in cycleCareTexts) {
        expect(isBodyNeutral(t), true, reason: t);
      }
      expect(isBodyNeutral('Track your calories'), false);
      expect(isBodyNeutral('Keep your streak going'), false);
      expect(isBodyNeutral(bodyKindnessText), true);
    });
  });

  group('diet, rewards and health profile logic', () {
    const String day = '2026-10-24';
    DietState planned() {
      DietState st = DietState.empty();
      for (final MapEntry<MealId, String> e in <MealId, String>{MealId.breakfast: 'Oats upma', MealId.lunch: 'Roti and dal', MealId.dinner: 'Soup'}.entries) {
        st = st.copyWith(plan: addPlanItem(st.plan, e.key, e.value).plan);
      }
      return refreshDay(st, day);
    }

    test('plan items are trimmed and rejected when empty, duplicate, long or over the limit', () {
      expect(addPlanItem(emptyPlan(), MealId.lunch, '  ').error, isNotNull);
      final PlanResult a = addPlanItem(emptyPlan(), MealId.lunch, ' Roti and dal ');
      expect(a.plan![MealId.lunch], <String>['Roti and dal']);
      expect(addPlanItem(a.plan!, MealId.lunch, 'roti AND dal').error, isNotNull);
      expect(addPlanItem(emptyPlan(), MealId.snack, 'x' * (maxPlanItemLength + 1)).error, isNotNull);
      DietPlan plan = emptyPlan();
      for (int i = 0; i < maxPlanItemsPerMeal; i++) {
        plan = addPlanItem(plan, MealId.snack, 'item $i').plan!;
      }
      expect(addPlanItem(plan, MealId.snack, 'one more').error, isNotNull);
      expect(removePlanItem(plan, MealId.snack, 0)[MealId.snack]!.take(2), <String>['item 1', 'item 2']);
    });

    test('a star per ticked meal, a bonus for the whole plan, partial days still count', () {
      DietState st = planned();
      expect(starsForDay(st.days[day]), 0);
      st = toggleMeal(st, MealId.breakfast, day);
      expect(starsForDay(st.days[day]), 1);
      st = toggleMeal(toggleMeal(st, MealId.lunch, day), MealId.dinner, day);
      expect(starsForDay(st.days[day]), 4);
      st = toggleMeal(st, MealId.dinner, day);
      expect(starsForDay(st.days[day]), 2);
      expect(identical(toggleMeal(st, MealId.snack, day), st), true);
    });

    test('streak counts complete days and an unfinished today does not erase yesterday', () {
      const DayEntry done = DayEntry(3, 3);
      final Map<String, DayEntry> days = <String, DayEntry>{'2026-10-21': done, '2026-10-22': done, '2026-10-23': done, '2026-10-24': const DayEntry(3, 1)};
      expect(currentStreak(days, day), 3);
      expect(currentStreak(<String, DayEntry>{...days, day: done}, day), 4);
      expect(currentStreak(<String, DayEntry>{'2026-10-20': done}, day), 0);
      expect(bestStreak(<String, DayEntry>{...days, '2026-10-18': done, '2026-10-19': done}), 3);
      expect(totalStars(days), 4 + 4 + 4 + 1);
    });

    test('the character cheers, encourages and nudges kindly, and never shames or mentions the body', () {
      expect(characterReaction(const DayEntry(3, 3), 12, 0).stance, Stance.celebrating);
      expect(characterReaction(const DayEntry(3, 3), 12, 0).text.toLowerCase(), contains('yayyy'));
      expect(characterReaction(const DayEntry(3, 3), 12, 4).text, contains('4 days in a row'));
      expect(characterReaction(const DayEntry(3, 1), 12, 0).stance, Stance.happy);
      expect(characterReaction(const DayEntry(3, 0), 20, 0).text, contains('try to follow your plan'));
      expect(characterReaction(const DayEntry(3, 0), 9, 0).text, contains('Tick a meal'));
      expect(characterReaction(null, 9, 0).text, contains('Add a few meals'));
      final RegExp shaming = RegExp('lazy|failed|failure|bad|cheat|guilt|punish|fat|ugly|disappoint|should have|give up', caseSensitive: false);
      for (final String l in allCharacterLines()) {
        expect(shaming.hasMatch(l), false, reason: l);
      }
      final RegExp numbers = RegExp('calor|BMI|target weight|lose weight|fat loss|slim', caseSensitive: false);
      for (final String l in <String>[...generalGuidance, ...mealIdeas.map((i) => i.text)]) {
        expect(numbers.hasMatch(l), false, reason: l);
      }
    });

    test('meal ideas follow the food preference', () {
      String lunch(FoodPreference? p) => mealIdeasFor(MealId.lunch, p).map((i) => i.text).join('|');
      expect(lunch(null), contains('fish or chicken'));
      expect(lunch(FoodPreference.vegetarian), isNot(contains('chicken')));
      expect(mealIdeasFor(MealId.breakfast, FoodPreference.vegan).map((i) => i.text).join('|'), isNot(contains('Curd')));
      expect(mealIdeasFor(MealId.breakfast, FoodPreference.eggetarian).map((i) => i.text).join('|'), contains('omelette'));
    });

    test('stored diet data is sanitised and round-trips', () {
      expect(stateFromJson('nonsense').plan[MealId.breakfast], isEmpty);
      final DietState st = stateFromJson(<String, dynamic>{
        'plan': <String, dynamic>{'breakfast': <Object>['Oats', 5, ''], 'lunch': 'bad'},
        'ticks': <String, dynamic>{'2026-10-24': <String>['breakfast', 'dessert'], 'bad': <String>['lunch']},
        'days': <String, dynamic>{'2026-10-24': <String, int>{'planned': 2, 'done': 5}, '2026-10-23': <String, int>{'planned': 2, 'done': 1}},
        'hideRewards': 'yes',
      });
      expect(st.plan[MealId.breakfast], <String>['Oats']);
      expect(st.plan[MealId.lunch], isEmpty);
      expect(st.ticks.keys, <String>['2026-10-24']);
      expect(st.ticks['2026-10-24'], <MealId>[MealId.breakfast]);
      expect(st.days.keys, <String>['2026-10-23']);
      expect(st.hideRewards, false);
      final DietState back = stateFromJson(stateToJson(planned()));
      expect(back.plan[MealId.dinner], <String>['Soup']);
      expect(back.days[day]!.planned, 3);
    });

    test('health profile: every field optional, numbers range-checked, summary lists only what was shared', () {
      expect(validateAssessment(const Assessment()), isEmpty);
      expect(buildSummary(const Assessment()), isEmpty);
      expect(validateAssessment(const Assessment(weightKg: 'abc')).length, 1);
      expect(validateAssessment(const Assessment(hba1c: '40')).length, 1);
      expect(validateAssessment(const Assessment(weightKg: '62', waistCm: '78', fastingGlucose: '92', hba1c: '5.4')), isEmpty);
      final String s = buildSummary(const Assessment(cycle: 'irregular', history: <String>['thyroid'], weightKg: '62', preference: FoodPreference.vegetarian, goals: <String>['energy'], allergies: 'peanuts')).join(' ');
      expect(s, contains('Periods: irregular'));
      expect(s, contains('Thyroid condition'));
      expect(s, contains('Body weight: 62 kg'));
      expect(s, contains('Food preference: vegetarian'));
      expect(s, contains('Allergies: peanuts'));
      expect(RegExp('BMI|target|score|overweight|underweight|obese|normal range', caseSensitive: false).hasMatch(s), false);
      expect(buildSummary(const Assessment(goals: <String>['energy'])).join(' ').toLowerCase(), isNot(contains('weight')));
      expect(summaryNote, contains('not a diagnosis'));
      final Assessment a = assessmentFromJson(<String, dynamic>{'cycle': 'weird', 'history': <String>['thyroid', 'x'], 'preference': 'vegan'});
      expect(a.cycle, isNull);
      expect(a.history, <String>['thyroid']);
      expect(a.preference, FoodPreference.vegan);
      expect(assessmentFromJson(assessmentToJson(const Assessment(cycle: 'regular', allergies: 'nuts'))).allergies, 'nuts');
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

    testWidgets('cycle care shows PCOS myths and facts', (tester) async {
      await tester.pumpWidget(_wrap(CycleCareScreen(role: 'user', onExit: () {})));
      await tester.pump();
      await tester.ensureVisible(find.text('PCOS myths and facts'));
      expect(find.text('PCOS myths and facts'), findsOneWidget);
      expect(find.textContaining('Myth: PCOS means you have cysts'), findsOneWidget);
      expect(find.textContaining('not medical advice'), findsWidgets);
      expect(pcosMyths.length >= 5, true);
    });

    testWidgets('cycle care shows the new adult features and no cycle tracking', (tester) async {
      tester.view.physicalSize = const Size(800, 6000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(_wrap(CycleCareScreen(role: 'user', onExit: () {})));
      await tester.pump();
      expect(find.text('How are you today?'), findsOneWidget);
      expect(find.text('Movement for your energy'), findsOneWidget);
      expect(find.text('Water so far today'), findsOneWidget);
      expect(find.text('My medicine and supplement notes'), findsOneWidget);
      expect(find.text('Doctor visit prep'), findsOneWidget);
      expect(find.textContaining('does not set target weights, calorie targets or BMI scores'), findsOneWidget);
      expect(find.textContaining('no cycle tracking'), findsOneWidget);
      expect(find.textContaining(RegExp('log (your )?period|last period|cycle day', caseSensitive: false)), findsNothing);
    });

    testWidgets('cycle care: water tally goes up and down, never below zero', (tester) async {
      tester.view.physicalSize = const Size(800, 6000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(_wrap(CycleCareScreen(role: 'user', onExit: () {})));
      await tester.pump();
      expect(find.text('0 glasses'), findsOneWidget);
      await tester.tap(find.byTooltip('Add a glass'));
      await tester.pump();
      expect(find.text('1 glass'), findsOneWidget);
      await tester.tap(find.byTooltip('Remove a glass'));
      await tester.pump();
      expect(find.text('0 glasses'), findsOneWidget);
    });

    testWidgets('cycle care: movement ideas follow the chosen energy level', (tester) async {
      tester.view.physicalSize = const Size(800, 6000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(_wrap(CycleCareScreen(role: 'user', onExit: () {})));
      await tester.pump();
      expect(find.textContaining('Slow stretching'), findsNothing);
      await tester.tap(find.widgetWithText(ChoiceChip, 'Running low').last);
      await tester.pump();
      expect(find.textContaining('Slow stretching'), findsOneWidget);
    });

    testWidgets('cycle care shows diet plan, rewards, health profile and the reminders note, and caregivers see none', (tester) async {
      SharedPreferences.setMockInitialValues(<String, Object>{});
      tester.view.physicalSize = const Size(800, 12000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(_wrap(CycleCareScreen(role: 'user', onExit: () {})));
      await tester.pump();
      expect(find.text('Diet plan and rewards'), findsOneWidget);
      expect(find.text('General eating tips'), findsOneWidget);
      expect(find.textContaining('Add a few meals to your plan'), findsOneWidget);
      expect(find.text('0'), findsWidgets);
      expect(find.text('Hide stars and streaks'), findsOneWidget);
      expect(find.text('My health profile'), findsOneWidget);
      for (final String t in <String>['Menstrual cycle patterns', 'Health and medical history', 'Current eating habits', 'Nutritional requirements', 'Food preferences', 'Individual health goals']) {
        expect(find.text(t), findsOneWidget, reason: t);
      }
      expect(find.text('Show my private summary'), findsOneWidget);
      expect(find.text('Medicine and supplement reminders'), findsOneWidget);
      expect(find.textContaining('kept on this device only'), findsWidgets);

      await tester.pumpWidget(_wrap(CycleCareScreen(role: 'caregiver', onExit: () {})));
      await tester.pump();
      expect(find.text('Diet plan and rewards'), findsNothing);
    });

    testWidgets('cycle care: adding a meal and ticking it makes the character celebrate and gives stars', (tester) async {
      SharedPreferences.setMockInitialValues(<String, Object>{});
      tester.view.physicalSize = const Size(800, 12000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(_wrap(CycleCareScreen(role: 'user', onExit: () {})));
      await tester.pump();
      await tester.tap(find.widgetWithText(ActionChip, 'Vegetable oats upma'));
      await tester.pump();
      expect(find.textContaining('Nothing planned yet'), findsNWidgets(3));
      await tester.tap(find.widgetWithText(CheckboxListTile, 'Breakfast'));
      await tester.pump();
      expect(find.textContaining('Yayyy! You finished'), findsOneWidget);
      expect(find.text('2'), findsWidgets);
      await tester.tap(find.text('Hide stars and streaks'));
      await tester.pump();
      expect(find.text('Show stars and streaks'), findsOneWidget);
      expect(find.textContaining('Stars and streaks are hidden'), findsOneWidget);
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
