/// Shared pieces for every game screen: the environment, the frame with pause /
/// exit / sound / voice, Pip the owl, and the end-of-round card.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../calm_tools/low_sensory.dart';
import 'game_audio.dart';
import 'game_content.dart';
import 'game_progress.dart';
import 'game_scoring.dart';
import 'games_controller.dart';
import 'sound_script.dart';

/// Everything a game screen needs, gathered once per build.
class GameEnv {
  final GameContent content;
  final GamesController controller;
  final GamesState state;
  final GameAudio audio;
  final GamePrefs prefs;
  final bool lowSensory;
  final String lang;

  /// True when the phone's language has no game text yet, so English is used.
  final bool languageFallback;

  const GameEnv({
    required this.content,
    required this.controller,
    required this.state,
    required this.audio,
    required this.prefs,
    required this.lowSensory,
    required this.lang,
    this.languageFallback = false,
  });

  /// Calm mode: no animation, longer pauses. Either the player's choice or the device setting.
  bool get calm => prefs.reducedMotion || lowSensory;

  String t(String key, {Map<String, String> vars = const <String, String>{}}) => content.text(key, vars: vars, lang: lang);

  String name(String symbol) => content.symbolName(symbol, lang: lang);

  Future<void> setPrefs(GamePrefs Function(GamePrefs) change) => controller.updatePrefs(prefs, change);

  Suggestion suggestionFor(String gameId) => controller.suggestionFor(gameId, prefs, content.adaptation);
}

const Color kGameBg = Color(0xFFF1F5E4);
const Color kGameBgCalm = Color(0xFFF4F1EA);
const Color kGameGreen = Color(0xFF678638);

/// Loads content and progress, tells the audio what the player chose, and
/// hands a [GameEnv] to [builder].
class GameEnvScope extends ConsumerWidget {
  final Widget Function(BuildContext context, GameEnv env) builder;
  const GameEnvScope({super.key, required this.builder});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<GameContent> content = ref.watch(gameContentProvider);
    final String owner = ref.watch(gamesOwnerProvider);
    final GamesState state = ref.watch(gamesControllerProvider(owner));
    final GamesController controller = ref.read(gamesControllerProvider(owner).notifier);
    final GameAudio audio = ref.watch(gameAudioProvider);
    final LowSensoryInfo sensory = watchLowSensory(context, ref);
    final String? wantedLang = Localizations.maybeLocaleOf(context)?.languageCode;
    final String lang = GameContent.resolveLanguage(wantedLang);

    return content.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (Object e, StackTrace s) => Scaffold(
        appBar: AppBar(title: const Text('Games Corner')),
        body: const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('The games could not be loaded. Please try again.'))),
      ),
      data: (GameContent c) {
        final GamePrefs prefs = state.data.prefs ?? GamePrefs.defaults(lowSensory: sensory.lowSensory);
        audio.soundEnabled = prefs.soundEnabled;
        audio.voiceEnabled = prefs.voiceEnabled;
        audio.lang = lang;
        return builder(
          context,
          GameEnv(
            content: c,
            controller: controller,
            state: state,
            audio: audio,
            prefs: prefs,
            lowSensory: sensory.lowSensory,
            lang: lang,
            languageFallback: GameContent.usesFallbackLanguage(wantedLang),
          ),
        );
      },
    );
  }
}

/// Pip the owl: a small friendly voice that cheers and explains. Never scolds.
class Buddy extends StatefulWidget {
  final GameEnv env;
  final String message;
  final bool speak;
  const Buddy({super.key, required this.env, required this.message, this.speak = true});

  @override
  State<Buddy> createState() => _BuddyState();
}

class _BuddyState extends State<Buddy> {
  @override
  void initState() {
    super.initState();
    _maybeSpeak();
  }

  @override
  void didUpdateWidget(Buddy old) {
    super.didUpdateWidget(old);
    if (old.message != widget.message) _maybeSpeak();
  }

  void _maybeSpeak() {
    if (widget.speak && widget.message.isNotEmpty) widget.env.audio.speak(widget.message);
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label: '${widget.env.t('ui.buddy')}: ${widget.message}',
      child: ExcludeSemantics(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Text('🦉', style: TextStyle(fontSize: 38)),
            const SizedBox(width: 10),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(4),
                    topRight: Radius.circular(18),
                    bottomLeft: Radius.circular(18),
                    bottomRight: Radius.circular(18),
                  ),
                  border: Border.all(color: const Color(0xFFD2DFC3)),
                ),
                child: Text(widget.message, style: const TextStyle(fontSize: 16)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _howKey(String gameId) {
  switch (gameId) {
    case 'memory-match':
      return 'mm.how';
    case 'pattern-quest':
      return 'pq.how';
    case 'feelings-detective':
      return 'fd.how';
    case 'imagine-create':
      return 'ic.how';
    default:
      return 'mz.how';
  }
}

/// Frame for every game: title, pause and exit that are always reachable,
/// sound / read-aloud / calm switches and "how to play". Escape pauses.
class GameScaffold extends StatefulWidget {
  final GameEnv env;
  final String gameId;
  final VoidCallback onExit;

  /// What "Read to me" speaks (the current prompt).
  final String? readText;
  final Widget Function(BuildContext context, bool paused) builder;

  const GameScaffold({
    super.key,
    required this.env,
    required this.gameId,
    required this.onExit,
    required this.builder,
    this.readText,
  });

  @override
  State<GameScaffold> createState() => _GameScaffoldState();
}

class _GameScaffoldState extends State<GameScaffold> {
  bool _paused = false;
  bool _showHow = false;

  void _togglePause() {
    widget.env.audio.stopSpeaking();
    setState(() => _paused = !_paused);
  }

  @override
  Widget build(BuildContext context) {
    final GameEnv env = widget.env;
    final GameInfo info = env.content.games.firstWhere((GameInfo g) => g.id == widget.gameId);
    return CallbackShortcuts(
      bindings: <ShortcutActivator, VoidCallback>{const SingleActivator(LogicalKeyboardKey.escape): _togglePause},
      child: Focus(
        autofocus: true,
        child: Scaffold(
          backgroundColor: env.calm ? kGameBgCalm : kGameBg,
          appBar: AppBar(
            automaticallyImplyLeading: false,
            title: Text('${info.emoji} ${env.t(info.titleKey)}'),
            actions: <Widget>[
              TextButton.icon(
                onPressed: _togglePause,
                icon: const Icon(Icons.pause_circle_outline),
                label: Text(env.t('ui.pause')),
              ),
              TextButton(onPressed: widget.onExit, child: Text(env.t('ui.exit'))),
              const SizedBox(width: 4),
            ],
          ),
          body: SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 640),
                child: Stack(
                  children: <Widget>[
                    ListView(
                      padding: const EdgeInsets.all(16),
                      children: <Widget>[
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: <Widget>[
                            _SwitchChip(
                              on: env.prefs.soundEnabled,
                              onLabel: env.t('ui.sound.on'),
                              offLabel: env.t('ui.sound.off'),
                              onIcon: Icons.volume_up,
                              offIcon: Icons.volume_off,
                              onChanged: (bool v) {
                                env.audio.soundEnabled = v;
                                env.setPrefs((GamePrefs p) => p.copyWith(soundEnabled: v));
                                if (v) env.audio.play(Effect.tap);
                              },
                            ),
                            _SwitchChip(
                              on: env.prefs.voiceEnabled,
                              onLabel: env.t('ui.voice.on'),
                              offLabel: env.t('ui.voice.off'),
                              onIcon: Icons.record_voice_over,
                              offIcon: Icons.voice_over_off,
                              onChanged: (bool v) {
                                env.audio.voiceEnabled = v;
                                env.setPrefs((GamePrefs p) => p.copyWith(voiceEnabled: v));
                                if (v) {
                                  env.audio.speak(env.t('ui.voice.on'), force: true);
                                } else {
                                  env.audio.stopSpeaking();
                                }
                              },
                            ),
                            _SwitchChip(
                              on: env.prefs.reducedMotion,
                              onLabel: env.t('ui.motion'),
                              offLabel: env.t('ui.motion'),
                              onIcon: Icons.spa,
                              offIcon: Icons.spa_outlined,
                              onChanged: (bool v) => env.setPrefs((GamePrefs p) => p.copyWith(reducedMotion: v)),
                            ),
                            if (widget.readText != null)
                              ActionChip(
                                avatar: const Icon(Icons.campaign_outlined, size: 18),
                                label: Text(env.t('ui.readAloud')),
                                onPressed: () => env.audio.speak(widget.readText!, force: true),
                              ),
                            ActionChip(
                              avatar: const Icon(Icons.help_outline, size: 18),
                              label: Text(env.t('ui.howToPlay')),
                              onPressed: () => setState(() => _showHow = !_showHow),
                            ),
                          ],
                        ),
                        if (_showHow)
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: Card(child: Padding(padding: const EdgeInsets.all(14), child: Text(env.t(_howKey(widget.gameId))))),
                          ),
                        const SizedBox(height: 12),
                        IgnorePointer(
                          ignoring: _paused,
                          child: Opacity(opacity: _paused ? 0.3 : 1, child: widget.builder(context, _paused)),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          env.t('ui.noScoreNote'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 12, color: Colors.black54),
                        ),
                      ],
                    ),
                    if (_paused)
                      Positioned.fill(
                        child: Container(
                          color: Colors.black26,
                          alignment: Alignment.center,
                          padding: const EdgeInsets.all(24),
                          child: Semantics(
                            scopesRoute: true,
                            explicitChildNodes: true,
                            namesRoute: true,
                            label: env.t('ui.paused'),
                            child: Card(
                              child: Padding(
                                padding: const EdgeInsets.all(24),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: <Widget>[
                                    const Text('🦉', style: TextStyle(fontSize: 48)),
                                    const SizedBox(height: 8),
                                    Text(env.t('ui.paused'), textAlign: TextAlign.center),
                                    const SizedBox(height: 16),
                                    FilledButton(onPressed: _togglePause, child: Text(env.t('ui.resume'))),
                                    const SizedBox(height: 8),
                                    OutlinedButton(onPressed: widget.onExit, child: Text(env.t('ui.exit'))),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SwitchChip extends StatelessWidget {
  final bool on;
  final String onLabel;
  final String offLabel;
  final IconData onIcon;
  final IconData offIcon;
  final ValueChanged<bool> onChanged;
  const _SwitchChip({
    required this.on,
    required this.onLabel,
    required this.offLabel,
    required this.onIcon,
    required this.offIcon,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      toggled: on,
      child: FilterChip(
        selected: on,
        avatar: Icon(on ? onIcon : offIcon, size: 18),
        label: Text(on ? onLabel : offLabel),
        onSelected: onChanged,
      ),
    );
  }
}

/// End-of-round card: stars, a kind message, save status and an optional level suggestion.
class RoundSummary extends StatefulWidget {
  final GameEnv env;
  final String gameId;
  final int? score;
  final String message;
  final VoidCallback onAgain;
  final VoidCallback onExit;
  final VoidCallback? onCheckMood;

  const RoundSummary({
    super.key,
    required this.env,
    required this.gameId,
    required this.score,
    required this.message,
    required this.onAgain,
    required this.onExit,
    this.onCheckMood,
  });

  @override
  State<RoundSummary> createState() => _RoundSummaryState();
}

class _RoundSummaryState extends State<RoundSummary> {
  @override
  void initState() {
    super.initState();
    widget.env.audio.play(Effect.win);
  }

  @override
  Widget build(BuildContext context) {
    final GameEnv env = widget.env;
    final int stars = starsFor(widget.score);
    final Suggestion suggestion = env.suggestionFor(widget.gameId);
    final String note = switch (env.state.saveStatus) {
      SaveStatus.account => env.t('ui.savedPrivate'),
      SaveStatus.later => env.t('ui.savedLater'),
      SaveStatus.device => env.t('ui.savedHere'),
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: <Widget>[
            Text(env.t('ui.finishedTitle'), style: Theme.of(context).textTheme.headlineSmall, textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Semantics(
              label: '$stars stars',
              child: ExcludeSemantics(
                child: Text('${'⭐' * stars}${'☆' * (3 - stars)}', style: const TextStyle(fontSize: 34)),
              ),
            ),
            const SizedBox(height: 12),
            Buddy(env: env, message: widget.message),
            if (suggestion != Suggestion.same) ...<Widget>[
              const SizedBox(height: 12),
              Text(suggestion == Suggestion.up ? env.t('ui.suggestUp') : env.t('ui.suggestDown'), textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                children: <Widget>[
                  FilledButton(
                    onPressed: () {
                      env.setPrefs((GamePrefs p) => p.copyWith(difficulty: nextDifficulty(p.difficulty, suggestion)));
                      widget.onAgain();
                    },
                    child: Text(env.t('ui.accept')),
                  ),
                  OutlinedButton(onPressed: widget.onAgain, child: Text(env.t('ui.notNow'))),
                ],
              ),
            ],
            const SizedBox(height: 16),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: <Widget>[
                FilledButton(onPressed: widget.onAgain, child: Text(env.t('ui.another'))),
                if (widget.onCheckMood != null)
                  OutlinedButton(onPressed: widget.onCheckMood, child: Text(env.t('ui.checkMood'))),
                OutlinedButton(onPressed: widget.onExit, child: Text(env.t('ui.back'))),
              ],
            ),
            const SizedBox(height: 8),
            Semantics(liveRegion: true, child: Text(note, style: const TextStyle(fontSize: 12, color: Colors.black54), textAlign: TextAlign.center)),
          ],
        ),
      ),
    );
  }
}
