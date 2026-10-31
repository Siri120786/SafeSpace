// Dino World's pictures and clips, kept in the app (compressed, no sound).
// Every dinosaur is an original, gentle plant-eater. Each clip has a still
// picture shown until the person presses Play.

const at = (file: string) => new URL(`./media/${file}`, import.meta.url).href;

export interface DinoClip {
  still: string;
  loop: string;
}

const clip = (name: string): DinoClip => ({ still: at(`${name}.webp`), loop: at(`${name}.mp4`) });

// Home: Arlo and the babies in a sunny valley with a waterfall and a little
// bridge; the closing: all of them asleep in their nest at sunset.
export const DINO_VALLEY = clip("valley");
export const DINO_SUNSET = clip("sunset");

// Tools page: a quiet fern forest, a little blue dinosaur waiting by the path.
export const DINO_FOREST = clip("forest");

// One baby dinosaur per tool.
export const DINO_CARD_CLIPS = {
  focus: clip("pebbles"), // Sunny stacking pebbles
  schedule: clip("tiles"), // Pip with a picture board
  feelings: clip("stones"), // Lulu holding feeling stones
  countdown: clip("sleepy"), // a sleepy little one curling up
} as const;

// The dino friends on the home page.
export const DINO_FRIENDS = [
  { name: "Arlo", picture: at("arlo.webp"), colour: "#8fb87a" },
  { name: "Pip", picture: at("pip.webp"), colour: "#f2a26b" },
  { name: "Sunny", picture: at("sunny.webp"), colour: "#ecd36a" },
  { name: "Lulu", picture: at("lulu.webp"), colour: "#b9a2df" },
] as const;
