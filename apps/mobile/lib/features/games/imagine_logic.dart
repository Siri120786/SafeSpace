/// Imagine & Create helpers. There is no single correct answer, so the only
/// rules are "enough was chosen to count as finished". What the player makes
/// (including any text they type) stays on this device; only "one round
/// finished" is ever saved to the account.
library;

import 'game_content.dart';

class CharacterDraft {
  final String? body;
  final String? colorId;
  final String? accessory;
  final String? powerKey;
  final String name;
  const CharacterDraft({this.body, this.colorId, this.accessory, this.powerKey, this.name = ''});

  CharacterDraft copyWith({
    String? body,
    String? colorId,
    String? accessory,
    String? powerKey,
    String? name,
    bool clearAccessory = false,
  }) =>
      CharacterDraft(
        body: body ?? this.body,
        colorId: colorId ?? this.colorId,
        accessory: clearAccessory ? null : (accessory ?? this.accessory),
        powerKey: powerKey ?? this.powerKey,
        name: name ?? this.name,
      );

  Map<String, dynamic> toJson() =>
      <String, dynamic>{'body': body, 'colorId': colorId, 'accessory': accessory, 'powerKey': powerKey, 'name': name};

  static CharacterDraft fromJson(Map<String, dynamic> j) => CharacterDraft(
        body: j['body'] as String?,
        colorId: j['colorId'] as String?,
        accessory: j['accessory'] as String?,
        powerKey: j['powerKey'] as String?,
        name: (j['name'] as String?) ?? '',
      );
}

class SceneDraft {
  final String? backdropId;

  /// Sticker per grid cell, row by row; null = empty.
  final List<String?> cells;
  const SceneDraft({this.backdropId, required this.cells});

  factory SceneDraft.empty(GameContent content) {
    final Map<String, dynamic> grid = (content.imagine['scene'] as Map<String, dynamic>)['grid'] as Map<String, dynamic>;
    return SceneDraft(cells: List<String?>.filled((grid['columns'] as int) * (grid['rows'] as int), null));
  }

  SceneDraft copyWith({String? backdropId, List<String?>? cells}) =>
      SceneDraft(backdropId: backdropId ?? this.backdropId, cells: cells ?? this.cells);

  Map<String, dynamic> toJson() => <String, dynamic>{'backdropId': backdropId, 'cells': cells};

  static SceneDraft fromJson(Map<String, dynamic> j) =>
      SceneDraft(backdropId: j['backdropId'] as String?, cells: <String?>[for (final dynamic c in j['cells'] as List<dynamic>) c as String?]);
}

class StoryDraft {
  final String? starterId;
  final String? nextKey;
  final String? endKey;
  final String ownText;
  const StoryDraft({this.starterId, this.nextKey, this.endKey, this.ownText = ''});

  StoryDraft copyWith({String? starterId, String? nextKey, String? endKey, String? ownText, bool reset = false}) => reset
      ? StoryDraft(starterId: starterId)
      : StoryDraft(
          starterId: starterId ?? this.starterId,
          nextKey: nextKey ?? this.nextKey,
          endKey: endKey ?? this.endKey,
          ownText: ownText ?? this.ownText,
        );

  Map<String, dynamic> toJson() =>
      <String, dynamic>{'starterId': starterId, 'nextKey': nextKey, 'endKey': endKey, 'ownText': ownText};

  static StoryDraft fromJson(Map<String, dynamic> j) => StoryDraft(
        starterId: j['starterId'] as String?,
        nextKey: j['nextKey'] as String?,
        endKey: j['endKey'] as String?,
        ownText: (j['ownText'] as String?) ?? '',
      );
}

Map<String, dynamic> _character(GameContent c) => c.imagine['character'] as Map<String, dynamic>;
Map<String, dynamic> _scene(GameContent c) => c.imagine['scene'] as Map<String, dynamic>;
Map<String, dynamic> _story(GameContent c) => c.imagine['story'] as Map<String, dynamic>;

bool characterIsComplete(GameContent content, CharacterDraft c) {
  final int chosen = <String?>[c.body, c.colorId, c.accessory, c.powerKey].where((String? v) => v != null).length;
  return c.body != null && chosen >= (_character(content)['minChoices'] as int);
}

int stickerCount(SceneDraft s) => s.cells.where((String? c) => c != null).length;

bool sceneIsComplete(GameContent content, SceneDraft s) =>
    s.backdropId != null && stickerCount(s) >= (_scene(content)['minStickers'] as int);

bool storyIsComplete(StoryDraft s) {
  final bool own = s.ownText.trim().isNotEmpty;
  return s.starterId != null && (s.nextKey != null || own) && (s.endKey != null || own);
}

/// Trims, collapses whitespace and limits length. Never sent to the server.
String cleanOwnText(GameContent content, String raw) {
  final String tidy = raw.replaceAll(RegExp(r'\s+'), ' ').trim();
  final int max = _story(content)['maxOwnTextLength'] as int;
  return tidy.length > max ? tidy.substring(0, max) : tidy;
}

SceneDraft placeSticker(SceneDraft scene, int cell, String? sticker) {
  if (cell < 0 || cell >= scene.cells.length) return scene;
  final List<String?> cells = List<String?>.from(scene.cells);
  cells[cell] = sticker;
  return scene.copyWith(cells: cells);
}

String characterIntro(GameContent content, CharacterDraft c, {String lang = 'en'}) {
  final String name = c.name.trim().isEmpty ? content.text('ic.character.unnamed', lang: lang) : c.name.trim();
  final String power = c.powerKey == null ? '' : ' $name ${content.text(c.powerKey!, lang: lang)}.';
  return '${content.text('ic.character.intro', vars: <String, String>{'name': name}, lang: lang)}$power';
}

/// The whole story as one string, for reading aloud.
String composeStory(GameContent content, StoryDraft s, {String lang = 'en'}) {
  Map<String, dynamic>? starter;
  for (final dynamic x in _story(content)['starters'] as List<dynamic>) {
    if ((x as Map<String, dynamic>)['id'] == s.starterId) starter = x;
  }
  if (starter == null) return '';
  final List<String> parts = <String>[content.text(starter['textKey'] as String, lang: lang)];
  if (s.nextKey != null) parts.add(content.text(s.nextKey!, lang: lang));
  final String own = cleanOwnText(content, s.ownText);
  if (own.isNotEmpty) parts.add(own);
  if (s.endKey != null) parts.add(content.text(s.endKey!, lang: lang));
  return parts.join(' ');
}

class Creation {
  final String id;
  final String kind; // character | scene | story
  final String createdAt;
  final CharacterDraft? character;
  final SceneDraft? scene;
  final StoryDraft? story;
  const Creation({required this.id, required this.kind, required this.createdAt, this.character, this.scene, this.story});

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'kind': kind,
        'createdAt': createdAt,
        'character': character?.toJson(),
        'scene': scene?.toJson(),
        'story': story?.toJson(),
      };

  static Creation? fromJson(Object? j) {
    if (j is! Map<String, dynamic>) return null;
    try {
      return Creation(
        id: j['id'] as String,
        kind: j['kind'] as String,
        createdAt: j['createdAt'] as String,
        character: j['character'] == null ? null : CharacterDraft.fromJson(j['character'] as Map<String, dynamic>),
        scene: j['scene'] == null ? null : SceneDraft.fromJson(j['scene'] as Map<String, dynamic>),
        story: j['story'] == null ? null : StoryDraft.fromJson(j['story'] as Map<String, dynamic>),
      );
    } catch (_) {
      return null;
    }
  }
}

const int kMaxCreations = 12;

/// Newest first, capped, so storage never grows without limit.
List<Creation> keepCreation(List<Creation> list, Creation c) {
  final List<Creation> all = <Creation>[c, ...list.where((Creation x) => x.id != c.id)];
  return all.length > kMaxCreations ? all.sublist(0, kMaxCreations) : all;
}
