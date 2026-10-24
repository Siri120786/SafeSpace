/// Games Corner screens: the hub (/games) and one route per game (/games/:id).
/// Game rules and puzzles run on this device; progress is saved locally first
/// and to the account when the network allows.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'feelings_detective_screen.dart';
import 'game_content.dart';
import 'game_progress.dart';
import 'game_scoring.dart';
import 'games_controller.dart';
import 'games_widgets.dart';
import 'imagine_create_screen.dart';
import 'maze_explorer_screen.dart';
import 'memory_match_screen.dart';
import 'pattern_quest_screen.dart';
import 'sound_script.dart';

/// Back if there is a screen to go back to, else the dashboard.
void leaveGames(BuildContext context) {
  final GoRouter? router = GoRouter.maybeOf(context);
  if (router == null) {
    Navigator.of(context).maybePop();
  } else if (router.canPop()) {
    router.pop();
  } else {
    router.go('/user-dashboard');
  }
}

class GamesHomeScreen extends StatelessWidget {
  const GamesHomeScreen({super.key});

  static const Map<Difficulty, String> _levelEmoji = <Difficulty, String>{
    Difficulty.easy: '🌱',
    Difficulty.medium: '🌿',
    Difficulty.hard: '🌳',
  };

  @override
  Widget build(BuildContext context) {
    return GameEnvScope(
      builder: (BuildContext context, GameEnv env) {
        final int stars = totalRounds(env.state.data.progress);
        final List<GameInfo> games = env.content.games;
        final List<GameInfo> ordered = <GameInfo>[
          ...games.where((GameInfo g) => g.tier == 'mvp'),
          ...games.where((GameInfo g) => g.tier != 'mvp'),
        ];
        final String note = switch (env.state.saveStatus) {
          SaveStatus.account => env.t('ui.savedPrivate'),
          SaveStatus.later => env.t('ui.savedLater'),
          SaveStatus.device => env.t('ui.savedHere'),
        };
        return Scaffold(
          backgroundColor: env.calm ? kGameBgCalm : kGameBg,
          appBar: AppBar(
            automaticallyImplyLeading: false,
            title: Text('🎲 ${env.t('ui.title')}'),
            actions: <Widget>[
              TextButton(onPressed: () => leaveGames(context), child: Text(env.t('ui.exit'))),
              const SizedBox(width: 4),
            ],
          ),
          body: SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 640),
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: <Widget>[
                    Text(env.t('ui.subtitle')),
                    const SizedBox(height: 12),
                    Buddy(env: env, message: env.t('buddy.welcome'), speak: false),
                    const SizedBox(height: 12),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: <Widget>[
                                Text(env.t('ui.difficulty'), style: Theme.of(context).textTheme.titleMedium),
                                Semantics(
                                  label: '${env.t('ui.stars')}: $stars',
                                  child: ExcludeSemantics(child: Text('⭐ $stars')),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              children: <Widget>[
                                for (final Difficulty d in Difficulty.values)
                                  ChoiceChip(
                                    selected: env.prefs.difficulty == d,
                                    label: Text('${_levelEmoji[d]} ${env.t('ui.${d.name}')}'),
                                    onSelected: (bool _) {
                                      env.audio.play(Effect.tap);
                                      env.setPrefs((GamePrefs p) => p.copyWith(difficulty: d));
                                    },
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    for (final GameInfo g in ordered) _GameCard(env: env, game: g),
                    if (env.languageFallback)
                      Padding(padding: const EdgeInsets.only(top: 8), child: Text(env.t('ui.language.fallback'), style: const TextStyle(fontSize: 12))),
                    const SizedBox(height: 12),
                    Semantics(liveRegion: true, child: Text(note, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: Colors.black54))),
                    const SizedBox(height: 4),
                    Text(env.t('ui.noScoreNote'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: Colors.black54)),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _GameCard extends StatelessWidget {
  final GameEnv env;
  final GameInfo game;
  const _GameCard({required this.env, required this.game});

  @override
  Widget build(BuildContext context) {
    final int rounds = roundsFor(env.state.data.progress, game.id);
    final bool up = env.suggestionFor(game.id) == Suggestion.up;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push('/games/${game.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: <Widget>[
              ExcludeSemantics(child: Text(game.emoji, style: const TextStyle(fontSize: 42))),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(env.t(game.titleKey), style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 2),
                    Text(env.t(game.blurbKey)),
                    const SizedBox(height: 2),
                    Text(
                      rounds > 0
                          ? '${'⭐' * (rounds > 5 ? 5 : rounds)} $rounds ${env.t('ui.roundsDone')}${up ? ' · ${env.t('ui.suggestUp')}' : ''}'
                          : game.skills.join(' · '),
                      style: const TextStyle(fontSize: 12, color: Colors.black54),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

/// One game. Bumping the key starts a fresh round.
class GameRouteScreen extends StatefulWidget {
  final String gameId;
  const GameRouteScreen({super.key, required this.gameId});

  @override
  State<GameRouteScreen> createState() => _GameRouteScreenState();
}

class _GameRouteScreenState extends State<GameRouteScreen> {
  int _round = 0;

  void _exit() {
    final GoRouter? router = GoRouter.maybeOf(context);
    if (router != null && router.canPop()) {
      router.pop();
    } else {
      router?.go('/games');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!kGameIds.contains(widget.gameId)) {
      return const Scaffold(body: Center(child: Text('That game was not found.')));
    }
    return GameEnvScope(
      builder: (BuildContext context, GameEnv env) {
        void again() => setState(() => _round++);
        void mood() => GoRouter.maybeOf(context)?.push('/mood-check-in');
        final Key key = ValueKey<String>('${widget.gameId}-$_round');
        switch (widget.gameId) {
          case 'memory-match':
            return MemoryMatchScreen(key: key, env: env, onExit: _exit, onAgain: again);
          case 'pattern-quest':
            return PatternQuestScreen(key: key, env: env, onExit: _exit, onAgain: again);
          case 'feelings-detective':
            return FeelingsDetectiveScreen(key: key, env: env, onExit: _exit, onAgain: again, onCheckMood: mood);
          case 'imagine-create':
            return ImagineCreateScreen(key: key, env: env, onExit: _exit, onAgain: again);
          default:
            return MazeExplorerScreen(key: key, env: env, onExit: _exit, onAgain: again);
        }
      },
    );
  }
}
