import 'package:flutter/material.dart';
import 'game_scoring.dart';
import 'games_widgets.dart';
import 'imagine_logic.dart';
import 'sound_script.dart';

enum _Mode { menu, character, scene, story, done }

Color _hex(String hex) => Color(int.parse('FF${hex.replaceFirst('#', '')}', radix: 16));

class ImagineCreateScreen extends StatefulWidget {
  final GameEnv env;
  final VoidCallback onExit;
  final VoidCallback onAgain;
  const ImagineCreateScreen({super.key, required this.env, required this.onExit, required this.onAgain});

  @override
  State<ImagineCreateScreen> createState() => _ImagineCreateScreenState();
}

class _ImagineCreateScreenState extends State<ImagineCreateScreen> {
  _Mode _mode = _Mode.menu;
  CharacterDraft _character = const CharacterDraft();
  late SceneDraft _scene;
  StoryDraft _story = const StoryDraft();
  String? _sticker;
  late String _message;
  bool _kept = false;
  int _praise = 0;
  String _lastKind = 'character';
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _ownController = TextEditingController();

  GameEnv get env => widget.env;
  Map<String, dynamic> get _data => env.content.imagine;
  Map<String, dynamic> get _characterData => _data['character'] as Map<String, dynamic>;
  Map<String, dynamic> get _sceneData => _data['scene'] as Map<String, dynamic>;
  Map<String, dynamic> get _storyData => _data['story'] as Map<String, dynamic>;

  @override
  void initState() {
    super.initState();
    _scene = SceneDraft.empty(env.content);
    _message = env.t('ic.how');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _ownController.dispose();
    super.dispose();
  }

  void _finish(String kind) {
    // Only "one round finished" goes to the account; what was made stays here.
    env.controller.finishRound(RoundResult(
      gameId: 'imagine-create',
      difficulty: env.prefs.difficulty,
      score: null,
      mistakes: 0,
      hints: 0,
    ));
    setState(() {
      _message = env.t(<String>['ic.encourage', 'ic.encourage2', 'ic.encourage3'][_praise % 3]);
      _praise++;
      _lastKind = kind;
      _mode = _Mode.done;
    });
  }

  void _keep() {
    env.controller.addCreation(Creation(
      id: '$_lastKind-${DateTime.now().millisecondsSinceEpoch}',
      kind: _lastKind,
      createdAt: DateTime.now().toUtc().toIso8601String(),
      character: _lastKind == 'character' ? _character : null,
      scene: _lastKind == 'scene' ? _scene : null,
      story: _lastKind == 'story' ? _story.copyWith(ownText: cleanOwnText(env.content, _story.ownText)) : null,
    ));
    setState(() => _kept = true);
    env.audio.play(Effect.cheer);
  }

  void _back() => setState(() {
        _kept = false;
        _mode = _Mode.menu;
      });

  Widget _choice({required Widget child, required bool selected, required VoidCallback onTap, String? label}) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: Material(
        color: selected ? const Color(0xFFE2EBD6) : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: selected ? kGameGreen : const Color(0xFFD2DFC3), width: 2),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), child: child),
        ),
      ),
    );
  }

  Widget _heading(String text) => Padding(
        padding: const EdgeInsets.only(top: 12, bottom: 6),
        child: Text(text, style: Theme.of(context).textTheme.titleMedium),
      );

  @override
  Widget build(BuildContext context) {
    return GameScaffold(
      env: env,
      gameId: 'imagine-create',
      onExit: widget.onExit,
      readText: _message,
      builder: (BuildContext context, bool paused) {
        switch (_mode) {
          case _Mode.done:
            return Column(
              children: <Widget>[
                RoundSummary(
                  env: env,
                  gameId: 'imagine-create',
                  score: null,
                  message: _message,
                  onAgain: widget.onAgain,
                  onExit: widget.onExit,
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _kept ? null : _keep,
                  icon: const Icon(Icons.push_pin_outlined),
                  label: Text(_kept ? env.t('ic.saved') : env.t('ic.save')),
                ),
              ],
            );
          case _Mode.menu:
            return _menu();
          case _Mode.character:
            return _characterView();
          case _Mode.scene:
            return _sceneView();
          case _Mode.story:
            return _storyView();
        }
      },
    );
  }

  Widget _menu() {
    final List<(String, String)> modes = <(String, String)>[('character', '🦄'), ('scene', '🏝️'), ('story', '📖')];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Buddy(env: env, message: _message),
        const SizedBox(height: 12),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          alignment: WrapAlignment.center,
          children: <Widget>[
            for (final (String, String) m in modes)
              SizedBox(
                width: 170,
                child: Card(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () {
                      env.audio.play(Effect.tap);
                      setState(() {
                        _kept = false;
                        _mode = _Mode.values.firstWhere((_Mode v) => v.name == m.$1);
                      });
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: <Widget>[
                          Text(m.$2, style: const TextStyle(fontSize: 44)),
                          const SizedBox(height: 4),
                          Text(env.t('ic.mode.${m.$1}'), textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
        if (env.state.data.creations.isNotEmpty) ...<Widget>[
          _heading(env.t('ic.gallery')),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              for (final Creation c in env.state.data.creations)
                Semantics(
                  label: env.t('ic.mode.${c.kind}'),
                  child: ExcludeSemantics(
                    child: Chip(label: Text(c.kind == 'character' ? (c.character?.body ?? '🦄') : (c.kind == 'scene' ? '🏝️' : '📖'), style: const TextStyle(fontSize: 26))),
                  ),
                ),
            ],
          ),
          Text(env.t('ui.savedHere'), style: const TextStyle(fontSize: 12, color: Colors.black54)),
        ],
      ],
    );
  }

  Widget _characterView() {
    final List<dynamic> bodies = _characterData['bodies'] as List<dynamic>;
    final List<dynamic> colors = _characterData['colors'] as List<dynamic>;
    final List<dynamic> accessories = _characterData['accessories'] as List<dynamic>;
    final List<dynamic> powers = _characterData['powers'] as List<dynamic>;
    Color? fill;
    for (final dynamic c in colors) {
      if (c['id'] == _character.colorId) fill = _hex(c['hex'] as String);
    }
    final bool complete = characterIsComplete(env.content, _character);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Center(
          child: Semantics(
            label: _character.body == null ? 'your character' : env.name(_character.body!),
            child: ExcludeSemantics(
              child: Container(
                width: 130,
                height: 130,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: fill ?? const Color(0xFFF3EFE6),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 4),
                ),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: <Widget>[
                    Text(_character.body ?? '❓', style: const TextStyle(fontSize: 68)),
                    if (_character.accessory != null)
                      Positioned(right: -14, top: -10, child: Text(_character.accessory!, style: const TextStyle(fontSize: 34))),
                  ],
                ),
              ),
            ),
          ),
        ),
        _heading(env.t('ic.character.body')),
        Wrap(spacing: 8, runSpacing: 8, children: <Widget>[
          for (final dynamic b in bodies)
            _choice(
              label: env.name(b as String),
              selected: _character.body == b,
              onTap: () {
                env.audio.play(Effect.place);
                setState(() => _character = _character.copyWith(body: b));
              },
              child: Text(b, style: const TextStyle(fontSize: 30)),
            ),
        ]),
        _heading(env.t('ic.character.color')),
        Wrap(spacing: 8, runSpacing: 8, children: <Widget>[
          for (final dynamic c in colors)
            _choice(
              selected: _character.colorId == c['id'],
              onTap: () {
                env.audio.play(Effect.tap);
                setState(() => _character = _character.copyWith(colorId: c['id'] as String));
              },
              child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                Container(width: 20, height: 20, decoration: BoxDecoration(color: _hex(c['hex'] as String), shape: BoxShape.circle)),
                const SizedBox(width: 6),
                Text(env.t(c['nameKey'] as String)),
              ]),
            ),
        ]),
        _heading(env.t('ic.character.accessory')),
        Wrap(spacing: 8, runSpacing: 8, children: <Widget>[
          for (final dynamic a in accessories)
            _choice(
              label: env.name(a as String),
              selected: _character.accessory == a,
              onTap: () {
                env.audio.play(Effect.tap);
                setState(() => _character = _character.accessory == a ? _character.copyWith(clearAccessory: true) : _character.copyWith(accessory: a));
              },
              child: Text(a, style: const TextStyle(fontSize: 26)),
            ),
        ]),
        _heading(env.t('ic.character.power')),
        Wrap(spacing: 8, runSpacing: 8, children: <Widget>[
          for (final dynamic p in powers)
            _choice(
              selected: _character.powerKey == p,
              onTap: () {
                env.audio.play(Effect.tap);
                setState(() => _character = _character.copyWith(powerKey: p));
              },
              child: Text(env.t(p as String)),
            ),
        ]),
        _heading(env.t('ic.character.name')),
        TextField(
          controller: _nameController,
          maxLength: 24,
          decoration: InputDecoration(hintText: env.t('ic.character.namePlaceholder'), border: const OutlineInputBorder(), filled: true, fillColor: Colors.white),
          onChanged: (String v) => setState(() => _character = _character.copyWith(name: v)),
        ),
        if (complete)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Semantics(liveRegion: true, child: Text(characterIntro(env.content, _character, lang: env.lang), textAlign: TextAlign.center)),
          ),
        Wrap(alignment: WrapAlignment.center, spacing: 8, runSpacing: 8, children: <Widget>[
          OutlinedButton(onPressed: _back, child: Text(env.t('ui.back'))),
          OutlinedButton.icon(
            onPressed: complete ? () => env.audio.speak(characterIntro(env.content, _character, lang: env.lang), force: true) : null,
            icon: const Icon(Icons.campaign_outlined),
            label: Text(env.t('ui.readAloud')),
          ),
          FilledButton(onPressed: complete ? () => _finish('character') : null, child: Text(env.t('ic.finish'))),
        ]),
      ],
    );
  }

  Widget _sceneView() {
    final List<dynamic> backdrops = _sceneData['backdrops'] as List<dynamic>;
    final List<dynamic> stickers = _sceneData['stickers'] as List<dynamic>;
    final Map<String, dynamic> grid = _sceneData['grid'] as Map<String, dynamic>;
    Map<String, dynamic>? backdrop;
    for (final dynamic b in backdrops) {
      if (b['id'] == _scene.backdropId) backdrop = b as Map<String, dynamic>;
    }
    final bool complete = sceneIsComplete(env.content, _scene);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _heading(env.t('ic.scene.pick')),
        Wrap(spacing: 8, runSpacing: 8, children: <Widget>[
          for (final dynamic b in backdrops)
            _choice(
              selected: _scene.backdropId == b['id'],
              onTap: () {
                env.audio.play(Effect.tap);
                setState(() => _scene = _scene.copyWith(backdropId: b['id'] as String));
              },
              child: Text('${b['emoji']} ${env.t(b['nameKey'] as String)}'),
            ),
        ]),
        const SizedBox(height: 8),
        Text(env.t('ic.scene.stickers')),
        const SizedBox(height: 6),
        Wrap(spacing: 8, runSpacing: 8, children: <Widget>[
          for (final dynamic s in stickers)
            _choice(
              label: env.name(s as String),
              selected: _sticker == s,
              onTap: () {
                env.audio.play(Effect.tap);
                setState(() => _sticker = _sticker == s ? null : s);
              },
              child: Text(s, style: const TextStyle(fontSize: 24)),
            ),
        ]),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white, width: 4),
            gradient: backdrop == null
                ? null
                : LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: <Color>[_hex(backdrop['from'] as String), _hex(backdrop['to'] as String)],
                  ),
            color: backdrop == null ? const Color(0xFFF3EFE6) : null,
          ),
          child: GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: grid['columns'] as int,
            mainAxisSpacing: 4,
            crossAxisSpacing: 4,
            children: <Widget>[
              for (int i = 0; i < _scene.cells.length; i++)
                Semantics(
                  button: true,
                  label: _scene.cells[i] != null ? '${env.name(_scene.cells[i]!)}, tap to remove' : 'Empty square ${i + 1}',
                  child: ExcludeSemantics(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () {
                        if (_scene.cells[i] != null) {
                          env.audio.play(Effect.undo);
                          setState(() => _scene = placeSticker(_scene, i, null));
                        } else if (_sticker != null) {
                          env.audio.play(Effect.place);
                          setState(() => _scene = placeSticker(_scene, i, _sticker));
                        }
                      },
                      child: Container(
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: Colors.white38, borderRadius: BorderRadius.circular(12)),
                        child: FittedBox(child: Text(_scene.cells[i] ?? '', style: const TextStyle(fontSize: 30))),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Wrap(alignment: WrapAlignment.center, spacing: 8, runSpacing: 8, children: <Widget>[
          OutlinedButton(onPressed: _back, child: Text(env.t('ui.back'))),
          OutlinedButton(
            onPressed: stickerCount(_scene) == 0 ? null : () => setState(() => _scene = SceneDraft(backdropId: _scene.backdropId, cells: List<String?>.filled(_scene.cells.length, null))),
            child: Text(env.t('ic.scene.clear')),
          ),
          FilledButton(onPressed: complete ? () => _finish('scene') : null, child: Text(env.t('ic.finish'))),
        ]),
      ],
    );
  }

  Widget _storyView() {
    final List<dynamic> starters = _storyData['starters'] as List<dynamic>;
    Map<String, dynamic>? starter;
    for (final dynamic s in starters) {
      if (s['id'] == _story.starterId) starter = s as Map<String, dynamic>;
    }
    final bool complete = storyIsComplete(_story);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _heading(env.t('ic.story.pick')),
        for (final dynamic st in starters)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _choice(
              selected: _story.starterId == st['id'],
              onTap: () {
                env.audio.play(Effect.tap);
                env.audio.speak(env.t(st['textKey'] as String));
                _ownController.clear();
                setState(() => _story = StoryDraft(starterId: st['id'] as String));
              },
              child: Align(alignment: Alignment.centerLeft, child: Text(env.t(st['textKey'] as String))),
            ),
          ),
        if (starter != null) ...<Widget>[
          _heading(env.t('ic.story.middle')),
          for (final dynamic k in starter['nextKeys'] as List<dynamic>)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _choice(
                selected: _story.nextKey == k,
                onTap: () {
                  env.audio.play(Effect.tap);
                  setState(() => _story = _story.copyWith(nextKey: k));
                },
                child: Align(alignment: Alignment.centerLeft, child: Text(env.t(k as String))),
              ),
            ),
          _heading(env.t('ic.story.end')),
          for (final dynamic k in starter['endKeys'] as List<dynamic>)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _choice(
                selected: _story.endKey == k,
                onTap: () {
                  env.audio.play(Effect.tap);
                  setState(() => _story = _story.copyWith(endKey: k));
                },
                child: Align(alignment: Alignment.centerLeft, child: Text(env.t(k as String))),
              ),
            ),
          const SizedBox(height: 4),
          Text(env.t('ic.story.own')),
          const SizedBox(height: 6),
          TextField(
            controller: _ownController,
            maxLines: 3,
            maxLength: _storyData['maxOwnTextLength'] as int,
            decoration: const InputDecoration(border: OutlineInputBorder(), filled: true, fillColor: Colors.white),
            onChanged: (String v) => setState(() => _story = _story.copyWith(ownText: v)),
          ),
        ],
        if (complete)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(env.t('ic.story.yours'), style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 6),
                  Text(composeStory(env.content, _story, lang: env.lang)),
                ],
              ),
            ),
          ),
        const SizedBox(height: 8),
        Wrap(alignment: WrapAlignment.center, spacing: 8, runSpacing: 8, children: <Widget>[
          OutlinedButton(onPressed: _back, child: Text(env.t('ui.back'))),
          OutlinedButton.icon(
            onPressed: complete ? () => env.audio.speak(composeStory(env.content, _story, lang: env.lang), force: true) : null,
            icon: const Icon(Icons.campaign_outlined),
            label: Text(env.t('ic.story.read')),
          ),
          FilledButton(onPressed: complete ? () => _finish('story') : null, child: Text(env.t('ic.finish'))),
        ]),
      ],
    );
  }
}
