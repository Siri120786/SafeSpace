// The hillside scene behind the landing and login pages: one painted 9:8
// plate (2160x1920) and a 5-second looping video of the same plate (960x960,
// rendered from the plate mirror-padded 120/1920 at the top and bottom, so it
// sits at 100% width, 112.5% height, top -6.25%). Nothing in the scene is
// drawn or animated in code. Sources as given in the design brief.

export const SCENE_PLATE =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/3ca5d10d-ea2f-4907-876f-33bde169469e.jpg";
export const SCENE_VIDEO =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/d2cb5bef-f92b-4e91-ae93-8dc6555e56ac.mp4";

export interface ExploreCard {
  title: string;
  text: string;
  image: string;
  alt: string;
  // Where the card leads on the page (a section id).
  href: string;
}

// "Explore SafeSpace": three parts of the app, each with a painted scene.
export const EXPLORE_CARDS: ExploreCard[] = [
  {
    title: "Feel & reflect",
    text: "Mood check-ins, a private journal and feelings cards.",
    image: "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/48f5b97e-c27c-4afd-9427-eb35aebd1751.webp",
    alt: "A boy and his dog on a hill path among sheep, above the sea",
    href: "#features",
  },
  {
    title: "Routines & reminders",
    text: "Your day, one small step at a time.",
    image: "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/cd2d844f-ae3f-4fa9-8067-b077530b6e71.webp",
    alt: "A vegetable garden with tomato stakes beside a cottage",
    href: "#features",
  },
  {
    title: "Calm & play",
    text: "Breathing, music, stories and games.",
    image: "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/cde5384e-ce4d-423f-925a-451b779066e0.webp",
    alt: "A girl in a straw hat flying a kite on a breezy hill",
    href: "#features",
  },
];

// True when the visitor asked for less motion: no video, no transitions.
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
