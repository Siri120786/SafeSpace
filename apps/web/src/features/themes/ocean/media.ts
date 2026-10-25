// The Ocean theme's clips, kept in the app (compressed, no sound): one sea
// cave with a shaft of light, orange fish swimming in it, cut five ways.
// Each clip has a still picture shown until the person presses Play. The
// jellyfish on the home page are Aurelia, the same as in Calm Space.

const at = (file: string) => new URL(`./media/${file}`, import.meta.url).href;

export interface OceanClip {
  still: string;
  loop: string;
}

const clip = (name: string): OceanClip => ({ still: at(`${name}.webp`), loop: at(`${name}.mp4`) });

// The whole cave, behind the tools page's greeting.
export const OCEAN_CAVE = clip("cave");

// One view of the cave per tool card.
export const OCEAN_CARD_CLIPS = {
  focus: clip("fish"),
  schedule: clip("light"),
  feelings: clip("floor"),
  countdown: clip("shaft"),
} as const;

// The sunlit floor, behind the closing words.
export const OCEAN_SUNFLOOR = clip("sunfloor");
