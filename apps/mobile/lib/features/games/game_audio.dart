/// Sound and voice for games. Sounds are synthesised from sound_script.dart
/// into tiny WAV clips (no audio files to ship); the voice is the phone's own
/// text-to-speech. Both stay silent unless the player turned them on, and any
/// failure (no audio device, no voice installed) is swallowed so a game never
/// breaks because of sound.
library;

import 'dart:typed_data';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'sound_script.dart';

/// Base class: decides WHETHER to make a sound; subclasses decide HOW.
/// The base does nothing audible, so tests and unsupported platforms are silent.
class GameAudio {
  bool soundEnabled = false;
  bool voiceEnabled = false;
  String lang = 'en';
  final Map<Effect, Uint8List> _cache = <Effect, Uint8List>{};

  /// Plays one of the standard effects if sound is on.
  void play(Effect effect) {
    if (!soundEnabled) return;
    output(_cache.putIfAbsent(effect, () => wavBytes(effectScript(effect))));
  }

  /// Plays a list of notes if sound is on.
  void playNotes(List<Note> notes) {
    if (!soundEnabled || notes.isEmpty) return;
    output(wavBytes(notes));
  }

  /// Speaks [message]. [force] is for the player pressing "Read to me";
  /// otherwise it only speaks when read-aloud is on. Returns whether it started.
  Future<bool> speak(String message, {bool force = false}) async {
    if ((!force && !voiceEnabled) || message.trim().isEmpty) return false;
    try {
      return await say(message);
    } catch (_) {
      return false;
    }
  }

  Future<void> stopSpeaking() async {
    try {
      await hush();
    } catch (_) {}
  }

  void dispose() {}

  /// Plays a finished WAV clip.
  void output(Uint8List wav) {}

  /// Speaks text; returns whether speech started.
  Future<bool> say(String message) async => false;

  /// Stops any speech.
  Future<void> hush() async {}
}

/// Records what was asked, for tests.
class RecordingGameAudio extends GameAudio {
  final List<String> log = <String>[];

  @override
  void output(Uint8List wav) => log.add('sound:${wav.length}');

  @override
  Future<bool> say(String message) async {
    log.add('say:$message');
    return true;
  }

  @override
  Future<void> hush() async => log.add('hush');
}

/// The real thing, on the phone.
class DeviceGameAudio extends GameAudio {
  AudioPlayer? _player;
  FlutterTts? _tts;
  bool _ttsReady = false;

  @override
  void output(Uint8List wav) {
    try {
      _player ??= AudioPlayer();
      final AudioPlayer p = _player!;
      p.stop().then((_) => p.play(BytesSource(wav), volume: 0.7)).catchError((Object _) {});
    } catch (_) {
      // Sound is a bonus; never break the game.
    }
  }

  @override
  Future<bool> say(String message) async {
    _tts ??= FlutterTts();
    final FlutterTts tts = _tts!;
    if (!_ttsReady) {
      await tts.setLanguage(lang == 'en' ? 'en-US' : lang);
      await tts.setSpeechRate(0.45);
      await tts.setPitch(1.05);
      _ttsReady = true;
    }
    await tts.stop();
    await tts.speak(message);
    return true;
  }

  @override
  Future<void> hush() async {
    await _tts?.stop();
  }

  @override
  void dispose() {
    try {
      _player?.dispose();
      _tts?.stop();
    } catch (_) {}
    _player = null;
    _tts = null;
  }
}
