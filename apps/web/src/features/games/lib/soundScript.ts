// What each game sound is, as plain data: a list of soft notes. The browser
// plays them with Web Audio (audio.ts); the mobile app builds the same notes
// into short WAV clips. All tones are gentle (sine, quiet, short) and none
// is a buzzer or alarm, so a "miss" sounds like a soft, low boop.
export type Effect = "tap" | "flip" | "match" | "miss" | "win" | "hint" | "step" | "bump" | "place" | "undo" | "cheer";

export interface Note {
  /** Seconds after the sound starts. */
  at: number;
  /** Frequency in Hz. */
  freq: number;
  /** Length in seconds. */
  dur: number;
  /** 0 to 1, relative loudness. */
  gain: number;
}

// C major pentatonic: any mix of these notes sounds pleasant together.
export const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

/** Pentatonic note for an index; wraps around the scale. */
export const scaleNote = (i: number) => SCALE[((i % SCALE.length) + SCALE.length) % SCALE.length];

const n = (at: number, freq: number, dur: number, gain = 0.8): Note => ({ at, freq, dur, gain });

export function effectScript(effect: Effect): Note[] {
  switch (effect) {
    case "tap":
      return [n(0, SCALE[4], 0.08, 0.5)];
    case "flip":
      return [n(0, SCALE[2], 0.1, 0.6), n(0.05, SCALE[3], 0.1, 0.4)];
    case "match":
      return [n(0, SCALE[3], 0.14), n(0.12, SCALE[5], 0.14), n(0.24, SCALE[7], 0.26)];
    case "miss":
      return [n(0, 220, 0.2, 0.45), n(0.12, 196, 0.26, 0.35)];
    case "hint":
      return [n(0, SCALE[5], 0.12, 0.5), n(0.14, SCALE[5], 0.12, 0.35)];
    case "step":
      return [n(0, SCALE[1], 0.05, 0.35)];
    case "bump":
      return [n(0, 174.61, 0.12, 0.4)];
    case "place":
      return [n(0, SCALE[6], 0.1, 0.55), n(0.06, SCALE[8], 0.12, 0.4)];
    case "undo":
      return [n(0, SCALE[4], 0.08, 0.4), n(0.07, SCALE[2], 0.1, 0.4)];
    case "cheer":
      return [n(0, SCALE[2], 0.12), n(0.1, SCALE[4], 0.12), n(0.2, SCALE[5], 0.2)];
    case "win":
      return [n(0, SCALE[0], 0.18), n(0.16, SCALE[2], 0.18), n(0.32, SCALE[3], 0.18), n(0.48, SCALE[5], 0.18), n(0.64, SCALE[7], 0.5)];
  }
}

/** Notes for hearing a pattern: one note per item, evenly spaced. */
export function patternScript(noteIdx: number[], spacing = 0.42): Note[] {
  return noteIdx.map((idx, i) => n(i * spacing, scaleNote(idx * 2), 0.32, 0.7));
}

/** A soft, slightly different tone for each feeling so choices feel distinct. */
export function feelingScript(feelingId: string): Note[] {
  const warm = ["happy", "excited", "proud", "relieved", "determined", "curious", "surprised"];
  const low = ["sad", "lonely", "hurt", "disappointed", "left-out"];
  if (warm.includes(feelingId)) return [n(0, SCALE[3], 0.14, 0.5), n(0.12, SCALE[5], 0.2, 0.5)];
  if (low.includes(feelingId)) return [n(0, SCALE[1], 0.2, 0.45), n(0.16, SCALE[0], 0.28, 0.4)];
  return [n(0, SCALE[2], 0.16, 0.45), n(0.14, SCALE[2], 0.2, 0.35)];
}

export function scriptDuration(notes: Note[]): number {
  return notes.reduce((m, x) => Math.max(m, x.at + x.dur), 0);
}
