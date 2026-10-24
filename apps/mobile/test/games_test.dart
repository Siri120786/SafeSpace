// Games Corner: shared content checks, the pure game rules, scoring, local-first
// progress and sound clips, plus smoke tests of the screens. Mirrors
// apps/web/tests/games.test.mts so both apps behave the same.
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safespace_mobile/features/calm_tools/low_sensory.dart';
import 'package:safespace_mobile/features/games/feelings_logic.dart';
import 'package:safespace_mobile/features/games/game_audio.dart';
import 'package:safespace_mobile/features/games/game_content.dart';
import 'package:safespace_mobile/features/games/game_progress.dart';
import 'package:safespace_mobile/features/games/game_scoring.dart';
import 'package:safespace_mobile/features/games/games_controller.dart';
import 'package:safespace_mobile/features/games/games_screens.dart';
import 'package:safespace_mobile/features/games/imagine_logic.dart';
import 'package:safespace_mobile/features/games/maze_logic.dart';
import 'package:safespace_mobile/features/games/memory_logic.dart';
import 'package:safespace_mobile/features/games/pattern_logic.dart';
import 'package:safespace_mobile/features/games/sound_script.dart';

GameContent _loadContent() => GameContent.fromSources(<String, String>{
      for (final String name in kContentFiles) name: File('assets/games/$name.json').readAsStringSync(),
    });

void main() {
  final GameContent content = _loadContent();

  group('content', () {
    test('catalog lists every game once, the three MVP games first', () {
      expect(content.games.map((GameInfo g) => g.id).toList(), kGameIds);
      expect(content.games.where((GameInfo g) => g.tier == 'mvp').map((GameInfo g) => g.id).toList(),
          <String>['memory-match', 'pattern-quest', 'feelings-detective']);
    });

    test('every text key used by the content has English text', () {
      final Set<String> keys = <String>{};
      for (final GameInfo g in content.games) {
        keys..add(g.titleKey)..add(g.blurbKey);
      }
      for (final String k in <String>['match', 'miss', 'done']) {
        keys.addAll(content.memoryFeedbackKeys(k));
      }
      for (final Difficulty d in Difficulty.values) {
        for (final PatternRound r in content.patternRounds(d)) {
          keys.add(r.hintKey);
        }
        for (final FeelingsScenario s in content.scenarios(d)) {
          keys..add(s.sceneKey)..addAll(s.clueKeys)..addAll(s.steps.map((StepChoice x) => x.textKey));
          keys.addAll(s.feelings.map((FeelingChoice f) => 'feeling.${f.id}'));
        }
      }
      keys..addAll(content.patternFeedbackKeys('correct'))..addAll(content.patternFeedbackKeys('retry'));
      final List<String> missing = keys.where((String k) => !content.hasText(k)).toList();
      expect(missing, isEmpty);
    });

    test('unknown languages fall back to English; unknown keys return the key', () {
      expect(content.text('ui.play', lang: 'fr'), content.text('ui.play'));
      expect(content.text('nope.key'), 'nope.key');
      expect(GameContent.resolveLanguage('fr_CA'), 'en');
      expect(GameContent.usesFallbackLanguage('fr'), isTrue);
      expect(GameContent.usesFallbackLanguage('en-GB'), isFalse);
      expect(content.text('fd.prompt.feeling', vars: <String, String>{'name': 'Bo'}), 'How might Bo be feeling?');
    });

    test('every picture has a spoken name', () {
      final Set<String> pics = <String>{};
      for (final MemoryTheme t in content.memoryThemes) {
        pics.addAll(t.cards);
      }
      for (final Difficulty d in Difficulty.values) {
        for (final PatternRound r in content.patternRounds(d)) {
          for (final String x in <String>[...r.items, ...r.options]) {
            if (x != kGap && int.tryParse(x) == null) pics.add(x);
          }
        }
        for (final FeelingsScenario s in content.scenarios(d)) {
          pics.add(s.character);
        }
      }
      expect(pics.where((String p) => content.symbolName(p) == p).toList(), isEmpty);
    });

    test('adaptation rules match the shared catalog', () {
      final AdaptationRules a = content.adaptation;
      expect((a.window, a.upMistakes, a.upHints, a.downMistakes), (3, 1, 0, 5));
    });
  });

  group('scoring', () {
    test('stars: at least one for everyone who finishes', () {
      expect(starsFor(0), 1);
      expect(starsFor(60), 2);
      expect(starsFor(95), 3);
      expect(starsFor(null), 3);
    });

    test('memory score', () {
      expect(memoryScore(4, 0, 0), 100);
      expect(memoryScore(4, 4, 0), 50);
      expect(memoryScore(3, 0, 2), 90);
      expect(memoryScore(3, 100, 99), 0);
    });

    test('question credit and maze score', () {
      expect(questionCredit(1, false), 1);
      expect(questionCredit(2, false), 0.5);
      expect(questionCredit(5, false), 0.25);
      expect(questionCredit(1, true), 0.75);
      expect(mazeScore(20, 20, 0), 100);
      expect(mazeScore(20, 40, 0), 50);
      expect(mazeScore(20, 20, 2), 90);
    });

    test('level suggestions need a full window at the current level', () {
      final AdaptationRules rules = content.adaptation;
      RecentRound smooth(Difficulty d) => RecentRound(d, 0, 0);
      RecentRound rough(Difficulty d) => RecentRound(d, 6, 2);
      expect(suggestDifficulty(Difficulty.easy, <RecentRound>[smooth(Difficulty.easy), smooth(Difficulty.easy), smooth(Difficulty.easy)], rules), Suggestion.up);
      expect(suggestDifficulty(Difficulty.hard, <RecentRound>[smooth(Difficulty.hard), smooth(Difficulty.hard), smooth(Difficulty.hard)], rules), Suggestion.same);
      expect(suggestDifficulty(Difficulty.easy, <RecentRound>[smooth(Difficulty.easy), smooth(Difficulty.easy)], rules), Suggestion.same);
      expect(suggestDifficulty(Difficulty.medium, <RecentRound>[rough(Difficulty.medium), rough(Difficulty.medium), rough(Difficulty.medium)], rules), Suggestion.down);
      expect(suggestDifficulty(Difficulty.easy, <RecentRound>[rough(Difficulty.easy), rough(Difficulty.easy), rough(Difficulty.easy)], rules), Suggestion.same);
      expect(suggestDifficulty(Difficulty.medium, <RecentRound>[smooth(Difficulty.easy), smooth(Difficulty.easy), smooth(Difficulty.medium)], rules), Suggestion.same);
      expect(nextDifficulty(Difficulty.easy, Suggestion.up), Difficulty.medium);
      expect(nextDifficulty(Difficulty.hard, Suggestion.up), Difficulty.hard);
      expect(nextDifficulty(Difficulty.easy, Suggestion.down), Difficulty.easy);
    });
  });

  group('memory match', () {
    test('pair counts 3 / 6 / 8 and every face exactly twice', () {
      for (final MapEntry<Difficulty, int> e in <Difficulty, int>{Difficulty.easy: 3, Difficulty.medium: 6, Difficulty.hard: 8}.entries) {
        final MemoryState g = newMemoryGame(content, e.key, Random(7));
        expect(g.totalPairs, e.value);
        expect(g.cards.length, e.value * 2);
        final Map<String, int> counts = <String, int>{};
        for (final MemoryCard c in g.cards) {
          counts[c.face] = (counts[c.face] ?? 0) + 1;
        }
        expect(counts.values.every((int n) => n == 2), isTrue);
      }
    });

    test('same seed gives the same deck', () {
      final List<String> a = newMemoryGame(content, Difficulty.medium, Random(5)).cards.map((MemoryCard c) => c.face).toList();
      final List<String> b = newMemoryGame(content, Difficulty.medium, Random(5)).cards.map((MemoryCard c) => c.face).toList();
      expect(a, b);
    });

    test('flip, miss, lock, flip back and match', () {
      MemoryState g = newMemoryGame(content, Difficulty.easy, Random(3));
      final String face = g.cards[0].face;
      final int mate = g.cards.firstWhere((MemoryCard c) => c.face == face && c.index != 0).index;
      final int other = g.cards.firstWhere((MemoryCard c) => c.face != face).index;
      g = flipCard(g, 0);
      expect(g.cards[0].state, CardState.up);
      expect(identical(flipCard(g, 0), g), isTrue);
      final MemoryState miss = flipCard(g, other);
      expect(miss.locked, isTrue);
      expect(miss.mistakes, 1);
      expect(identical(flipCard(miss, mate), miss), isTrue);
      final MemoryState back = resolveMismatch(miss);
      expect(back.locked, isFalse);
      expect(back.cards.every((MemoryCard c) => c.state == CardState.down), isTrue);
      final MemoryState hit = flipCard(g, mate);
      expect(hit.cards[0].state, CardState.matched);
      expect(hit.matchedPairs, 1);
      expect(hit.lastEvent, MemoryEvent.match);
    });

    test('hints point at a real pair and following them wins with no mistakes', () {
      MemoryState g = newMemoryGame(content, Difficulty.easy, Random(9));
      final HintResult h = hintPair(g);
      expect(h.pair, isNotNull);
      expect(g.cards[h.pair![0]].face, g.cards[h.pair![1]].face);
      expect(h.state.hints, 1);
      for (int guard = 0; !g.won && guard < 20; guard++) {
        final HintResult step = hintPair(g);
        g = flipCard(flipCard(g, step.pair![0]), step.pair![1]);
      }
      expect(g.won, isTrue);
      expect(g.mistakes, 0);
      expect(identical(flipCard(g, 0), g), isTrue);
    });
  });

  group('pattern quest', () {
    test('every round is well formed and numeric rules hold', () {
      for (final Difficulty d in Difficulty.values) {
        final List<PatternRound> rounds = content.patternRounds(d);
        expect(rounds.length, greaterThanOrEqualTo(content.patternRoundsPerGame));
        expect(rounds.map((PatternRound r) => r.id).toSet().length, rounds.length);
        for (final PatternRound r in rounds) {
          expect(r.options.contains(r.answer), isTrue, reason: r.id);
          expect(r.options.toSet().length, r.options.length, reason: r.id);
          expect(followsRule(r), isTrue, reason: r.id);
        }
      }
    });

    test('gaps, next, solved rows and notes', () {
      final PatternRound next = content.patternRounds(Difficulty.easy).first;
      final PatternRound gap = content.patternRounds(Difficulty.medium).firstWhere((PatternRound r) => r.items.contains(kGap));
      expect(gapIndex(next), -1);
      expect(displayItems(next).last, kGap);
      expect(gapIndex(gap), greaterThanOrEqualTo(0));
      expect(solvedItems(gap).contains(kGap), isFalse);
      expect(solvedItems(next).length, next.items.length + 1);
      expect(isCorrect(next, next.answer), isTrue);
      expect(noteIndexes(<String>['a', 'b', 'a', 'c', 'b']), <int>[0, 1, 0, 2, 1]);
      expect(patternScore(<int>[1, 1, 2, 1], <bool>[false, false, false, false]), 88);
    });

    test('a game has the right number of rounds and keeps the answer among the options', () {
      final List<PatternRound> g = buildPatternGame(content, Difficulty.easy, Random(2));
      expect(g.length, content.patternRoundsPerGame);
      expect(g.every((PatternRound r) => r.options.contains(r.answer)), isTrue);
    });
  });

  group('feelings detective', () {
    test('every scenario has several accepted feelings and kind and unkind steps', () {
      for (final Difficulty d in Difficulty.values) {
        final List<FeelingsScenario> list = content.scenarios(d);
        expect(list.length, greaterThanOrEqualTo(content.feelingsRoundsPerGame));
        for (final FeelingsScenario s in list) {
          expect(s.feelings.where((FeelingChoice f) => f.fit != 'unlikely').length, greaterThanOrEqualTo(2), reason: s.id);
          expect(s.steps.any((StepChoice x) => x.fit == 'helpful'), isTrue);
          expect(s.steps.any((StepChoice x) => x.fit == 'notHelpful'), isTrue);
          expect(s.feelings.every((FeelingChoice f) => content.feelingEmoji.containsKey(f.id)), isTrue);
        }
      }
    });

    test('feelings are accepted unless unlikely; unkind steps are redirected', () {
      final FeelingsScenario s = content.scenarios(Difficulty.easy).first;
      expect(judgeFeeling(s, 'sad').accepted, isTrue);
      expect(judgeFeeling(s, 'sad').feedbackKey, 'fd.fb.strong');
      expect(judgeFeeling(s, 'excited').accepted, isFalse);
      expect(judgeFeeling(s, 'excited').feedbackKey, 'fd.fb.unlikely');
      expect(judgeFeeling(s, 'not-a-feeling').accepted, isFalse);
      expect(judgeStep(s, 'a').accepted, isTrue);
      expect(judgeStep(s, 'c').accepted, isFalse);
      final FeelingsScenario mixed = content.scenarios(Difficulty.hard).first;
      for (final String id in <String>['disappointed', 'worried', 'relieved', 'angry']) {
        expect(judgeFeeling(mixed, id).accepted, isTrue, reason: id);
      }
      expect(buildFeelingsGame(content, Difficulty.medium, Random(4)).length, content.feelingsRoundsPerGame);
    });
  });

  group('maze explorer', () {
    test('every maze is rectangular, solvable, with open start and goal', () {
      for (final Difficulty d in Difficulty.values) {
        final List<MazeDef> all = content.mazes(d);
        expect(all.length, greaterThanOrEqualTo(3));
        for (final MazeDef m in all) {
          expect(m.rows.every((String r) => r.length == m.columns), isTrue, reason: m.id);
          expect(isOpen(m, m.start[0], m.start[1]), isTrue);
          expect(isOpen(m, m.goal[0], m.goal[1]), isTrue);
          expect(shortestPath(m, m.start), isNotNull, reason: m.id);
        }
      }
    });

    test('walls, hints, undo and reaching the goal', () {
      final MazeDef m = content.mazes(Difficulty.easy).first;
      MazeState s = newMazeGame(m);
      final List<List<int>> path = shortestPath(m, m.start)!;
      expect(optimalSteps(m), path.length - 1);
      final Dir wall = <Dir>[Dir.up, Dir.left].firstWhere((Dir d) => move(s, d).bumps == 1);
      expect(move(s, wall).pos, m.start);
      expect(move(s, wall).steps, 0);
      final MazeHint h = hint(s);
      expect(h.dir, isNotNull);
      expect(h.state.hints, 1);
      s = move(s, h.dir!);
      expect(s.steps, 1);
      final MazeState u = undo(s);
      expect(u.pos, m.start);
      expect(u.steps, 0);
      expect(undo(newMazeGame(m)).pos, m.start);
      MazeState play = newMazeGame(m);
      for (int i = 1; i < path.length; i++) {
        play = move(play, dirTo(play.pos, path[i])!);
      }
      expect(play.won, isTrue);
      expect(play.steps, optimalSteps(m));
      expect(identical(move(play, Dir.up), play), isTrue);
    });
  });

  group('imagine & create', () {
    test('what counts as finished', () {
      expect(characterIsComplete(content, const CharacterDraft()), isFalse);
      expect(characterIsComplete(content, const CharacterDraft(body: '🦄', colorId: 'mint')), isTrue);
      expect(characterIsComplete(content, const CharacterDraft(colorId: 'mint', accessory: '👑')), isFalse);
      SceneDraft sc = SceneDraft.empty(content).copyWith(backdropId: 'forest');
      sc = placeSticker(placeSticker(placeSticker(sc, 0, '🌳'), 5, '🌸'), 7, '🦋');
      expect(sceneIsComplete(content, sc), isTrue);
      expect(sceneIsComplete(content, placeSticker(sc, 7, null)), isFalse);
      expect(identical(placeSticker(sc, 999, '🌳'), sc), isTrue);
      const StoryDraft st = StoryDraft(starterId: 's1', nextKey: 'ic.story.s1.n1');
      expect(storyIsComplete(st), isFalse);
      expect(storyIsComplete(st.copyWith(endKey: 'ic.story.s1.e1')), isTrue);
      expect(storyIsComplete(const StoryDraft(starterId: 's1', ownText: 'They flew away.')), isTrue);
    });

    test('text is tidied, stories keep their order and characters introduce themselves', () {
      expect(cleanOwnText(content, '  hello \n\n  world  '), 'hello world');
      expect(cleanOwnText(content, 'x' * 500).length, 240);
      final String story = composeStory(content, const StoryDraft(starterId: 's1', nextKey: 'ic.story.s1.n1', endKey: 'ic.story.s1.e1', ownText: 'Then lunch.'));
      expect(story.startsWith('One morning'), isTrue);
      expect(story.contains('Then lunch.'), isTrue);
      expect(characterIntro(content, const CharacterDraft(name: 'Zed', powerKey: 'ic.power.fly')), 'Meet Zed! Zed can fly.');
      expect(characterIntro(content, const CharacterDraft()).startsWith('Meet your new friend'), isTrue);
    });

    test('kept creations are capped, newest first, and survive a round trip', () {
      List<Creation> list = <Creation>[];
      for (int i = 0; i < 20; i++) {
        list = keepCreation(list, Creation(id: '$i', kind: 'scene', createdAt: 'x'));
      }
      expect(list.length, kMaxCreations);
      expect(list.first.id, '19');
      final Creation c = const Creation(id: 'a', kind: 'character', createdAt: 'x', character: CharacterDraft(body: '🦄', name: 'Zed'));
      expect(Creation.fromJson(c.toJson())!.character!.name, 'Zed');
    });
  });

  group('local-first progress', () {
    final DateTime t0 = DateTime.utc(2026, 10, 24, 10);
    RoundResult round(String g, Difficulty d, int? score, {int mistakes = 0, int hints = 0}) =>
        RoundResult(gameId: g, difficulty: d, score: score, mistakes: mistakes, hints: hints);

    test('rounds add up and the best score is kept; open-ended games have no score', () {
      LocalGameState st = const LocalGameState();
      st = applyRound(st, round('memory-match', Difficulty.easy, 70), t0);
      st = applyRound(st, round('memory-match', Difficulty.easy, 90), t0);
      st = applyRound(st, round('memory-match', Difficulty.easy, 60), t0);
      expect(st.progress.length, 1);
      expect(st.progress.first.roundsCompleted, 3);
      expect(st.progress.first.bestScore, 90);
      st = applyRound(st, round('imagine-create', Difficulty.easy, null), t0);
      expect(st.progress.last.bestScore, isNull);
      expect(totalRounds(st.progress), 4);
      expect(roundsFor(st.progress, 'memory-match'), 3);
      expect(st.pending.length, 4);
    });

    test('queue and recent history are capped; scores are clamped', () {
      LocalGameState st = const LocalGameState();
      for (int i = 0; i < 80; i++) {
        st = applyRound(st, round('maze-explorer', Difficulty.hard, 50), t0);
      }
      expect(st.pending.length, kMaxPending);
      expect(st.recent['maze-explorer']!.length, kMaxRecent);
      expect(applyRound(const LocalGameState(), round('maze-explorer', Difficulty.easy, 250), t0).progress.first.bestScore, 100);
    });

    test('merging the account copy loses nothing', () {
      LocalGameState st = const LocalGameState();
      st = applyRound(st, round('memory-match', Difficulty.easy, 90), t0);
      final LocalGameState merged = mergeRemote(
        st,
        <ProgressRow>[
          const ProgressRow('memory-match', Difficulty.easy, 5, 80, '2026-10-20T00:00:00Z'),
          const ProgressRow('pattern-quest', Difficulty.hard, 2, 40, '2026-10-21T00:00:00Z'),
        ],
        const GamePrefs(difficulty: Difficulty.medium, reducedMotion: false, soundEnabled: true, voiceEnabled: false),
      );
      final ProgressRow mm = merged.progress.firstWhere((ProgressRow r) => r.gameId == 'memory-match');
      expect(mm.roundsCompleted, 5);
      expect(mm.bestScore, 90);
      expect(merged.progress.length, 2);
      expect(merged.prefs!.difficulty, Difficulty.medium);
      final LocalGameState keep = mergeRemote(st.copyWith(prefs: GamePrefs.defaults(lowSensory: false)), const <ProgressRow>[], merged.prefs);
      expect(keep.prefs!.difficulty, Difficulty.easy);
    });

    test('calm mode starts quiet', () {
      expect(GamePrefs.defaults(lowSensory: true).soundEnabled, isFalse);
      expect(GamePrefs.defaults(lowSensory: true).reducedMotion, isTrue);
      expect(GamePrefs.defaults(lowSensory: false).soundEnabled, isTrue);
      expect(GamePrefs.defaults(lowSensory: false).voiceEnabled, isFalse);
    });

    test('offline: a failed save keeps this and later rounds queued, and retry drains the queue', () async {
      LocalGameState st = const LocalGameState();
      for (int i = 0; i < 4; i++) {
        st = applyRound(st, round('memory-match', Difficulty.easy, 70), t0);
      }
      final _FlakyBackend flaky = _FlakyBackend(failOn: 3);
      final FlushResult first = await flushPending(st.pending, flaky);
      expect(first.ok, isFalse);
      expect(first.remaining.length, 2);
      final FlushResult second = await flushPending(first.remaining, flaky);
      expect(second.ok, isTrue);
      expect(second.remaining, isEmpty);
    });

    test('storage: restart, isolation between players, damaged data', () async {
      final MemoryGameStore store = MemoryGameStore();
      LocalGameState st = const LocalGameState();
      st = applyRound(st, round('pattern-quest', Difficulty.medium, 80, mistakes: 1), t0);
      st = st.copyWith(prefs: GamePrefs.defaults(lowSensory: false));
      expect(await saveState('kid1', st, store), isTrue);
      final LocalGameState back = await loadState('kid1', store);
      expect(back.progress.first.bestScore, 80);
      expect(back.pending.length, 1);
      expect(back.recent['pattern-quest']!.first.mistakes, 1);
      expect(back.prefs!.soundEnabled, isTrue);
      expect((await loadState('kid2', store)).progress, isEmpty);
      store.values[gameStorageKey('bad')] = '{not json';
      expect((await loadState('bad', store)).progress, isEmpty);
      store.values[gameStorageKey('old')] = '{"v":99,"progress":[1]}';
      expect((await loadState('old', store)).progress, isEmpty);
    });
  });

  group('sound', () {
    test('every effect is a short, quiet list of notes; a miss is low and soft', () {
      for (final Effect e in Effect.values) {
        final List<Note> s = effectScript(e);
        expect(s, isNotEmpty);
        expect(scriptDuration(s), lessThanOrEqualTo(1.2));
        expect(s.every((Note n) => n.gain > 0 && n.gain <= 1 && n.freq >= 150 && n.freq <= 1000), isTrue, reason: e.name);
      }
      expect(effectScript(Effect.miss).every((Note n) => n.freq < 250 && n.gain <= 0.5), isTrue);
    });

    test('patterns are heard one note per item, equal items equal notes', () {
      final List<Note> s = patternScript(noteIndexes(<String>['a', 'b', 'a']));
      expect(s.length, 3);
      expect(s[0].freq, s[2].freq);
      expect(s[0].freq, isNot(s[1].freq));
      expect(feelingScript('happy').first.freq, isNot(feelingScript('sad').first.freq));
      expect(scaleNote(0), scaleNote(kScale.length));
      expect(scaleNote(-1), kScale.last);
    });

    test('notes become a valid WAV clip', () {
      final Uint8List bytes = wavBytes(effectScript(Effect.match));
      expect(String.fromCharCodes(bytes.sublist(0, 4)), 'RIFF');
      expect(String.fromCharCodes(bytes.sublist(8, 12)), 'WAVE');
      expect(String.fromCharCodes(bytes.sublist(36, 40)), 'data');
      expect(bytes.length, greaterThan(44));
      expect(bytes.length.isEven, isTrue);
    });

    test('audio only makes sound or speech when the player turned it on', () async {
      final RecordingGameAudio audio = RecordingGameAudio();
      audio.play(Effect.tap);
      expect(await audio.speak('hello'), isFalse);
      expect(audio.log, isEmpty);
      audio.soundEnabled = true;
      audio.play(Effect.tap);
      expect(audio.log.single.startsWith('sound:'), isTrue);
      expect(await audio.speak('hello'), isFalse);
      expect(await audio.speak('hello', force: true), isTrue);
      audio.voiceEnabled = true;
      expect(await audio.speak('again'), isTrue);
      expect(audio.log.where((String l) => l.startsWith('say:')).length, 2);
    });
  });

  group('screens', () {
    Future<void> pump(WidgetTester tester, Widget home, RecordingGameAudio audio) async {
      tester.view.physicalSize = const Size(900, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: <Override>[
            gameContentProvider.overrideWith((ref) async => content),
            gameAudioProvider.overrideWithValue(audio),
            gameStoreProvider.overrideWithValue(MemoryGameStore()),
            gameBackendProvider.overrideWithValue(null),
            gamesOwnerProvider.overrideWithValue('test-player'),
            savedReducedSensoryProvider.overrideWith((ref) async => false),
          ],
          child: MaterialApp(home: home),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
    }

    testWidgets('hub lists all five games and the level choices', (WidgetTester tester) async {
      await pump(tester, const GamesHomeScreen(), RecordingGameAudio());
      expect(find.text('🎲 Games Corner'), findsOneWidget);
      for (final String title in <String>['Memory Match', 'Pattern Quest', 'Feelings Detective', 'Imagine & Create', 'Maze Explorer']) {
        expect(find.text(title), findsOneWidget);
      }
      expect(find.textContaining('Gentle'), findsOneWidget);
      expect(find.text('Saved on this device only.'), findsOneWidget);
    });

    testWidgets('memory match: a card flips with a sound, and pause shows a way out', (WidgetTester tester) async {
      final RecordingGameAudio audio = RecordingGameAudio();
      await pump(tester, const GameRouteScreen(gameId: 'memory-match'), audio);
      expect(find.text('Find the pairs that match.'), findsWidgets);
      await tester.tap(find.text('❔').first);
      await tester.pump();
      expect(audio.log.any((String l) => l.startsWith('sound:')), isTrue);
      await tester.tap(find.text('Pause'));
      await tester.pump();
      expect(find.text('Keep playing'), findsOneWidget);
      await tester.tap(find.text('Keep playing'));
      await tester.pump();
      expect(find.text('Keep playing'), findsNothing);
      await tester.pump(const Duration(seconds: 3)); // let any flip-back timer finish
    });

    testWidgets('pattern quest: a wrong choice is met kindly', (WidgetTester tester) async {
      await pump(tester, const GameRouteScreen(gameId: 'pattern-quest'), RecordingGameAudio());
      expect(find.text('What comes next?'), findsWidgets);
      expect(find.text('Hear the pattern'), findsOneWidget);
      expect(find.text('Hint'), findsOneWidget);
    });

    testWidgets('feelings detective, imagine and maze open without errors', (WidgetTester tester) async {
      for (final String id in <String>['feelings-detective', 'imagine-create', 'maze-explorer']) {
        await pump(tester, GameRouteScreen(gameId: id), RecordingGameAudio());
        expect(find.text('How to play'), findsOneWidget, reason: id);
        expect(tester.takeException(), isNull, reason: id);
      }
    });

    testWidgets('an unknown game id shows a friendly message', (WidgetTester tester) async {
      await pump(tester, const GameRouteScreen(gameId: 'chess'), RecordingGameAudio());
      expect(find.text('That game was not found.'), findsOneWidget);
    });
  });
}

class _FlakyBackend implements GameBackend {
  final int failOn;
  int calls = 0;
  _FlakyBackend({required this.failOn});

  @override
  Future<({List<ProgressRow> progress, GamePrefs? prefs})> fetch() async => (progress: <ProgressRow>[], prefs: null);

  @override
  Future<void> record(PendingRound round) async {
    calls++;
    if (calls == failOn) throw Exception('offline');
  }

  @override
  Future<void> savePrefs(GamePrefs prefs) async {}
}
