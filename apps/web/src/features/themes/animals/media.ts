// The Animals theme's pictures, clips and 3D models, kept in the app
// (compressed, no sound). Each clip has a still picture shown until the
// person presses Play.

const at = (file: string) => new URL(`./media/${file}`, import.meta.url).href;

export interface AnimalClip {
  still: string;
  // No loop: the still picture only (with a gentle bob while playing).
  loop?: string;
}

const clip = (name: string, moves = true): AnimalClip => ({ still: at(`${name}.webp`), ...(moves ? { loop: at(`${name}.mp4`) } : {}) });

// Rusty the fox (3D) in an autumn forest, on the home page.
export const RUSTY_MODEL = at("rusty.glb");
export const ANIMALS_FOREST = clip("forest");

// The bee (3D, wings drawn in code from a photographed wing) and the
// flowers and soft lavender light of the tools page.
export const BEE_MODEL = at("bee.glb");
export const BEE_WING = at("wing.webp");
export const ANIMALS_LAVENDER = at("lavender.webp");
export const ANIMALS_VIOLET = at("violet.webp");
export const ANIMALS_FLOWERS = {
  cosmos: at("cosmos.webp"),
  hanging: at("hanging.webp"),
  iris: at("iris.webp"),
  passion: at("passion.webp"),
} as const;

// One animal per tool card.
export const ANIMALS_CARD_CLIPS = {
  focus: clip("frog"),
  schedule: clip("hippo", false),
  feelings: clip("cat"),
  countdown: clip("bear"),
} as const;

// The polar bear cub dancing, behind the closing words.
export const ANIMALS_DANCE = clip("dance");
