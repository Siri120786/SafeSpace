// The Trains theme's pictures and clips, kept in the app (compressed, no
// sound, no whistles). Peter and his engine friends are original toy-like
// engines. Each clip has a still picture shown until the person presses Play.

const at = (file: string) => new URL(`./media/${file}`, import.meta.url).href;

export interface TrainClip {
  still: string;
  loop: string;
}

const clip = (name: string): TrainClip => ({ still: at(`${name}.webp`), loop: at(`${name}.mp4`) });

// Home: Peter, Poppy, Sunny and Bramble together at the island station.
export const TRAIN_STATION = clip("station");

// Tools page: Peter waiting at the little platform.
export const TRAIN_PLATFORM = clip("platform");

// The closing: a quiet seat by a carriage window as mountains pass at sunset.
export const TRAIN_CARRIAGE = clip("carriage");

// One engine friend per tool.
export const TRAIN_CARD_CLIPS = {
  focus: clip("peter"), // Peter at the platform
  schedule: clip("poppy"), // Poppy with her picture board
  feelings: clip("sunny"), // Sunny pulling the feeling balloons
  countdown: clip("bramble"), // Bramble beside the sand timer
} as const;

export const TRAIN_FRIEND_NAMES = {
  focus: "Peter",
  schedule: "Poppy",
  feelings: "Sunny",
  countdown: "Bramble",
} as const;
