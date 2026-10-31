// The Space theme's pictures and clips, kept in the app (compressed, no
// sound). Each clip has a still picture shown until the person presses Play.

const at = (file: string) => new URL(`./media/${file}`, import.meta.url).href;

export const SPACE_PLATE = at("plate.webp");
export const SPACE_HELMET = at("helmet.webp");
export const NOVA_HEAD_CLIP = at("head-turn.mp4");

export interface SpaceClip {
  still: string;
  loop: string;
}

const clip = (name: string): SpaceClip => ({ still: at(`${name}.webp`), loop: at(`${name}.mp4`) });

// The little astronaut bouncing through a coral world, on the tools page.
export const SPACE_ASTRONAUT = clip("hero");

// The astronauts gathered together, behind the closing words.
export const SPACE_TOGETHER = clip("hello");

// One picture per tool card.
export const SPACE_CARD_CLIPS = {
  focus: clip("card1"),
  schedule: clip("card2"),
  feelings: clip("card3"),
  countdown: clip("hero"),
} as const;
