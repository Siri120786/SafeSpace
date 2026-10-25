// The Calm theme's pictures and clips. The meadow (a boy and his puppy on a
// sunny hill) and the painted scenes are the landing page's own; the moonlit
// camp (a husky by a campfire) is kept in the app (compressed, no sound).
// Each clip has a still picture shown until the person presses Play.

import { EXPLORE_CARDS, SCENE_PLATE, SCENE_VIDEO } from "../../landing/hero/heroScene";

const at = (file: string) => new URL(`./media/${file}`, import.meta.url).href;

export interface CalmClip {
  still: string;
  // No loop: the still picture only.
  loop?: string;
}

export const CALM_MEADOW: CalmClip = { still: SCENE_PLATE, loop: SCENE_VIDEO };
export const CALM_CAMP: CalmClip = { still: at("camp.webp"), loop: at("camp.mp4") };

// One painted scene per tool card.
export const CALM_CARD_PICTURES = {
  focus: EXPLORE_CARDS[0].image, // a boy and his dog on a hill path
  schedule: EXPLORE_CARDS[1].image, // a vegetable garden by a cottage
  feelings: EXPLORE_CARDS[2].image, // a girl flying a kite
  countdown: SCENE_PLATE, // the boy and his puppy on the meadow
} as const;
