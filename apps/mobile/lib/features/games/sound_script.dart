/// What each game sound is, as plain data: a list of soft notes. This mirrors
/// apps/web/src/features/games/lib/soundScript.ts; the notes are built into
/// short WAV clips here. All tones are gentle (sine, quiet, short) and none is
/// a buzzer or alarm, so a "miss" sounds like a soft, low boop.
library;

import 'dart:math';
import 'dart:typed_data';

enum Effect { tap, flip, match, miss, win, hint, step, bump, place, undo, cheer }

class Note {
  /// Seconds after the sound starts.
  final double at;

  /// Frequency in Hz.
  final double freq;

  /// Length in seconds.
  final double dur;

  /// 0 to 1, relative loudness.
  final double gain;
  const Note(this.at, this.freq, this.dur, [this.gain = 0.8]);
}

/// C major pentatonic: any mix of these notes sounds pleasant together.
const List<double> kScale = <double>[261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

double scaleNote(int i) => kScale[((i % kScale.length) + kScale.length) % kScale.length];

List<Note> effectScript(Effect effect) {
  switch (effect) {
    case Effect.tap:
      return const <Note>[Note(0, 440.0, 0.08, 0.5)];
    case Effect.flip:
      return const <Note>[Note(0, 329.63, 0.1, 0.6), Note(0.05, 392.0, 0.1, 0.4)];
    case Effect.match:
      return const <Note>[Note(0, 392.0, 0.14), Note(0.12, 523.25, 0.14), Note(0.24, 659.25, 0.26)];
    case Effect.miss:
      return const <Note>[Note(0, 220, 0.2, 0.45), Note(0.12, 196, 0.26, 0.35)];
    case Effect.hint:
      return const <Note>[Note(0, 523.25, 0.12, 0.5), Note(0.14, 523.25, 0.12, 0.35)];
    case Effect.step:
      return const <Note>[Note(0, 293.66, 0.05, 0.35)];
    case Effect.bump:
      return const <Note>[Note(0, 174.61, 0.12, 0.4)];
    case Effect.place:
      return const <Note>[Note(0, 587.33, 0.1, 0.55), Note(0.06, 783.99, 0.12, 0.4)];
    case Effect.undo:
      return const <Note>[Note(0, 440.0, 0.08, 0.4), Note(0.07, 329.63, 0.1, 0.4)];
    case Effect.cheer:
      return const <Note>[Note(0, 329.63, 0.12), Note(0.1, 440.0, 0.12), Note(0.2, 523.25, 0.2)];
    case Effect.win:
      return const <Note>[
        Note(0, 261.63, 0.18),
        Note(0.16, 329.63, 0.18),
        Note(0.32, 392.0, 0.18),
        Note(0.48, 523.25, 0.18),
        Note(0.64, 659.25, 0.5),
      ];
  }
}

/// Notes for hearing a pattern: one note per item, evenly spaced.
List<Note> patternScript(List<int> noteIdx, {double spacing = 0.42}) =>
    <Note>[for (int i = 0; i < noteIdx.length; i++) Note(i * spacing, scaleNote(noteIdx[i] * 2), 0.32, 0.7)];

/// A soft, slightly different tone for each feeling so choices feel distinct.
List<Note> feelingScript(String feelingId) {
  const List<String> warm = <String>['happy', 'excited', 'proud', 'relieved', 'determined', 'curious', 'surprised'];
  const List<String> low = <String>['sad', 'lonely', 'hurt', 'disappointed', 'left-out'];
  if (warm.contains(feelingId)) return <Note>[Note(0, kScale[3], 0.14, 0.5), Note(0.12, kScale[5], 0.2, 0.5)];
  if (low.contains(feelingId)) return <Note>[Note(0, kScale[1], 0.2, 0.45), Note(0.16, kScale[0], 0.28, 0.4)];
  return <Note>[Note(0, kScale[2], 0.16, 0.45), Note(0.14, kScale[2], 0.2, 0.35)];
}

double scriptDuration(List<Note> notes) => notes.fold(0.0, (double m, Note n) => max(m, n.at + n.dur));

/// Renders notes as a 16-bit mono PCM WAV file (quiet sine tones with a short
/// fade in and out so there are no clicks).
Uint8List wavBytes(List<Note> notes, {int sampleRate = 22050, double masterGain = 0.5}) {
  final double total = scriptDuration(notes) + 0.05;
  final int count = max(1, (total * sampleRate).ceil());
  final List<double> mix = List<double>.filled(count, 0);
  for (final Note n in notes) {
    final int start = (n.at * sampleRate).floor();
    final int len = (n.dur * sampleRate).floor();
    for (int i = 0; i < len && start + i < count; i++) {
      final double t = i / sampleRate;
      final double attack = min(1.0, t / 0.015);
      final double decay = 1.0 - (i / len);
      mix[start + i] += sin(2 * pi * n.freq * t) * n.gain * attack * decay * decay;
    }
  }
  final ByteData data = ByteData(44 + count * 2);
  void ascii(int offset, String s) {
    for (int i = 0; i < s.length; i++) {
      data.setUint8(offset + i, s.codeUnitAt(i));
    }
  }

  ascii(0, 'RIFF');
  data.setUint32(4, 36 + count * 2, Endian.little);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  data.setUint32(16, 16, Endian.little);
  data.setUint16(20, 1, Endian.little); // PCM
  data.setUint16(22, 1, Endian.little); // mono
  data.setUint32(24, sampleRate, Endian.little);
  data.setUint32(28, sampleRate * 2, Endian.little);
  data.setUint16(32, 2, Endian.little);
  data.setUint16(34, 16, Endian.little);
  ascii(36, 'data');
  data.setUint32(40, count * 2, Endian.little);
  for (int i = 0; i < count; i++) {
    final double v = (mix[i] * masterGain).clamp(-1.0, 1.0).toDouble();
    data.setInt16(44 + i * 2, (v * 32767).round(), Endian.little);
  }
  return data.buffer.asUint8List();
}
