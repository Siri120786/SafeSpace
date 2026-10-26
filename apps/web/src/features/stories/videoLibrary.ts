// Video stories built into the app: short animated social stories with
// narration, watched in a plain video player (no autoplay). They sit beside
// the drawn, read-aloud stories in the library (./library). Children watch
// them on their Stories page; caregivers see the same list on theirs.
//
// Re-encoded for the web at 720p from the original recordings, with the
// video generator's corner mark blurred out (no on-screen credits).

export interface VideoStory {
  id: string;            // "video-…", so it never clashes with a drawn story's id
  title: string;
  summary: string;
  minutes: number;       // rounded running time
  video: string;
  poster: string;
}

// One literal URL per file, so the bundler always picks each file up.
const KAI_JAYA = new URL("./library/videos/kai-jaya-sharing.mp4", import.meta.url).href;
const KAI_JAYA_POSTER = new URL("./library/videos/kai-jaya-sharing.webp", import.meta.url).href;
const KAI_EMOTIONS = new URL("./library/videos/kai-emotions.mp4", import.meta.url).href;
const KAI_EMOTIONS_POSTER = new URL("./library/videos/kai-emotions.webp", import.meta.url).href;
const DENTIST = new URL("./library/videos/dentist-visit.mp4", import.meta.url).href;
const DENTIST_POSTER = new URL("./library/videos/dentist-visit.webp", import.meta.url).href;

export const VIDEO_STORIES: readonly VideoStory[] = [
  {
    id: "video-kai-and-jaya-sharing",
    title: "Kai and Jaya share",
    summary: "Kai and his friend Jaya learn to take turns and share their toys.",
    minutes: 2,
    video: KAI_JAYA,
    poster: KAI_JAYA_POSTER,
  },
  {
    id: "video-kai-learns-emotions",
    title: "Kai learns about feelings",
    summary: "Kai notices his feelings, names them and finds ways to feel calm.",
    minutes: 3,
    video: KAI_EMOTIONS,
    poster: KAI_EMOTIONS_POSTER,
  },
  {
    id: "video-visit-to-the-dentist",
    title: "A visit to the dentist",
    summary: "Watch Kai's trip to the dentist, from the waiting room to the big chair.",
    minutes: 3,
    video: DENTIST,
    poster: DENTIST_POSTER,
  },
];

export function findVideoStory(id: string): VideoStory | null {
  return VIDEO_STORIES.find((s) => s.id === id) ?? null;
}
