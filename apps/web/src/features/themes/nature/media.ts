// The Nature theme's pictures and clips, kept in the app (compressed, no
// sound). Each clip has a still picture shown until the person presses Play.

const at = (file: string) => new URL(`./media/${file}`, import.meta.url).href;

export interface NatureClip {
  still: string;
  loop: string;
}

const clip = (name: string): NatureClip => ({ still: at(`${name}.webp`), loop: at(`${name}.mp4`) });

// Home: a cherry-blossom valley under a white sky, two soft clouds, a
// blossom tree, and the valley again by moonlight for the closing words.
export const NATURE_VALLEY = clip("valley");
export const NATURE_CLOUDS = { a: at("cloud-a.webp"), b: at("cloud-b.webp") } as const;
export const NATURE_TREE = at("tree.webp");
export const NATURE_NIGHT = at("night.webp");

// Tools page: a glass dome of moss, wildflowers and butterflies on old
// roots in the dark, and four close views of it for the tool cards.
export const NATURE_REALM = clip("realm");
export const NATURE_CARD_CLIPS = {
  focus: clip("dome"),
  schedule: clip("flowers"),
  feelings: clip("butterflies"),
  countdown: clip("roots"),
} as const;
