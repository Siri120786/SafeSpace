// The music library (role-flow 9a/9b): four playlists of calm sounds and one
// of rhymes. Most tracks are made in the browser (ambience.ts, rhymes.ts), so
// nothing is downloaded and nothing needs a licence. Hosted songs (9b) are
// files in the public "music" bucket, each with its source and licence
// recorded here and shown on the Credits page. A song only goes in once its
// licence has been checked and approved. Hosted tracks join in 9b, each with
// its source and licence recorded here. No React here, so
// apps/web/tests/music.test.mts can check it.

import { RHYMES, rhymeTimeline } from "./rhymes";

export type Mood = "relax" | "calm" | "cheer" | "focus" | "sing";

export const MOODS: { key: Mood; label: string; when: string }[] = [
  { key: "relax", label: "Relax", when: "Bedtime and rest" },
  { key: "calm", label: "Calm", when: "When things feel busy" },
  { key: "cheer", label: "Cheer up", when: "When you feel low" },
  { key: "focus", label: "Focus", when: "Homework and reading" },
  { key: "sing", label: "Sing along", when: "Rhymes to sing together" },
];

// The sounds ambience.ts can make.
export type AmbienceKey =
  | "starlight_hum"
  | "night_breeze"
  | "soft_rain"
  | "gentle_waves"
  | "deep_sea"
  | "music_box"
  | "happy_box"
  | "sunny_marimba"
  | "bubble_pop"
  | "space_hum"
  | "slow_chimes"
  | "pink_rain";

// Where a hosted song came from and the terms it's used under.
export interface Credit {
  artist: string;
  sourceUrl: string;
  licence: string;      // e.g. "CC BY 4.0", "CC0 1.0", "Public domain", "Paid licence (Shop name)"
  licenceUrl: string;
  // The line to show, when the licence asks for particular wording.
  attribution?: string;
}

export interface Track {
  id: string;
  title: string;
  // How long it plays before the next one. The sounds don't run out, so for
  // them this is a choice; a rhyme lasts as long as its tune, a song as long
  // as its file.
  durationSec: number;
  source:
    | { kind: "generated"; sound: AmbienceKey }
    | { kind: "rhyme"; rhymeId: string }
    | { kind: "file"; path: string; sung: boolean; credit: Credit };
}

// Licences a hosted song may have. Anything else needs a decision first.
export const ALLOWED_LICENCES = [/^CC0 1\.0$/, /^Public domain$/, /^CC BY [34]\.0$/, /^Paid licence \(.+\)$/];

export interface Playlist {
  id: string;
  title: string;
  emoji: string;
  // "mine" is the person's own favorites, not a mood of the library.
  mood: Mood | "mine";
  blurb: string;
  // Soft colours for the playlist's card, readable with dark text.
  colors: { from: string; to: string };
  tracks: Track[];
}

const gen = (id: string, title: string, minutes: number, sound: AmbienceKey): Track => ({
  id,
  title,
  durationSec: minutes * 60,
  source: { kind: "generated", sound },
});

// A rhyme plays through once, with two quiet seconds after it.
const rhymeTrack = (id: string, title: string, totalSec: number): Track => ({
  id: `rhyme-${id}`,
  title,
  durationSec: Math.ceil(totalSec) + 2,
  source: { kind: "rhyme", rhymeId: id },
});

export const PLAYLISTS: Playlist[] = [
  {
    id: "sleepy-stars",
    title: "Sleepy Stars",
    emoji: "🌙",
    mood: "relax",
    blurb: "Slow, soft sounds for bedtime.",
    colors: { from: "#E4E1F7", to: "#F4F1FB" },
    tracks: [
      gen("starlight-hum", "Starlight hum", 10, "starlight_hum"),
      gen("music-box-lullaby", "Music box lullaby", 8, "music_box"),
      gen("night-breeze", "Night breeze", 10, "night_breeze"),
      gen("soft-rain", "Soft rain", 15, "soft_rain"),
    ],
  },
  {
    id: "ocean-calm",
    title: "Ocean Calm",
    emoji: "🌊",
    mood: "calm",
    blurb: "Waves, rain and the deep blue sea.",
    colors: { from: "#D8EEF2", to: "#EFF8F9" },
    tracks: [
      gen("gentle-waves", "Gentle waves", 10, "gentle_waves"),
      gen("deep-sea", "Deep sea", 10, "deep_sea"),
      gen("rain-on-the-sea", "Rain on the sea", 10, "soft_rain"),
    ],
  },
  {
    id: "happy-beats",
    title: "Happy Beats",
    emoji: "☀️",
    mood: "cheer",
    blurb: "Bright, bouncy tunes to lift your mood.",
    colors: { from: "#FBEBC8", to: "#FDF6E6" },
    tracks: [
      gen("sunny-marimba", "Sunny marimba", 5, "sunny_marimba"),
      gen("bubble-pop", "Bubble pop", 5, "bubble_pop"),
      gen("happy-music-box", "Happy music box", 5, "happy_box"),
    ],
  },
  {
    id: "focus-galaxy",
    title: "Focus Galaxy",
    emoji: "🪐",
    mood: "focus",
    blurb: "Steady sounds that help you think.",
    colors: { from: "#DCE6F5", to: "#F0F4FA" },
    tracks: [
      gen("space-hum", "Space hum", 25, "space_hum"),
      gen("steady-rain", "Steady rain", 25, "pink_rain"),
      gen("slow-chimes", "Slow chimes", 25, "slow_chimes"),
    ],
  },
  {
    id: "rhyme-time",
    title: "Rhyme Time",
    emoji: "🎶",
    mood: "sing",
    blurb: "Rhymes in English, Hindi and Telugu, with the words to sing along.",
    colors: { from: "#FCE1E6", to: "#FDF1F3" },
    tracks: RHYMES.map((r) => rhymeTrack(r.id, r.title, rhymeTimeline(r).totalSec)),
  },
];

// What's missing or wrong in a hosted song's entry (empty when it's fine): a
// file in the bucket ("folder/name.mp3"), who made it, where it came from and
// an allowed licence, with links that work.
export function songProblems(t: Track): string[] {
  if (t.source.kind !== "file") return [];
  const { path, credit } = t.source;
  const problems: string[] = [];
  if (!/^[a-z0-9-]+\/[a-z0-9-]+\.(mp3|ogg|m4a)$/.test(path)) problems.push("path should look like folder/name.mp3");
  if (!credit.artist.trim()) problems.push("who made it");
  if (!/^https:\/\//.test(credit.sourceUrl)) problems.push("where it came from (an https link)");
  if (!/^https:\/\//.test(credit.licenceUrl)) problems.push("a link to the licence");
  if (!ALLOWED_LICENCES.some((re) => re.test(credit.licence))) problems.push(`an allowed licence (not "${credit.licence}")`);
  if (!(t.durationSec > 0 && t.durationSec <= 15 * 60)) problems.push("its length, up to 15 minutes");
  return problems;
}

// Every hosted song, for the Credits page.
export function hostedTracks(): (Track & { source: { kind: "file" } })[] {
  return PLAYLISTS.flatMap((p) => p.tracks).filter((t): t is Track & { source: { kind: "file" } } => t.source.kind === "file");
}

// Every track, by id (for favorites).
export function findTrack(id: string): { track: Track; playlist: Playlist } | null {
  for (const playlist of PLAYLISTS) {
    const track = playlist.tracks.find((t) => t.id === id);
    if (track) return { track, playlist };
  }
  return null;
}

export function findPlaylist(id: string | undefined): Playlist | null {
  return PLAYLISTS.find((p) => p.id === id) ?? null;
}

export function playlistsFor(mood: Mood | "all"): Playlist[] {
  return mood === "all" ? PLAYLISTS : PLAYLISTS.filter((p) => p.mood === mood);
}

export function moodLabel(mood: Mood | "mine"): string {
  if (mood === "mine") return "Mine";
  return MOODS.find((m) => m.key === mood)?.label ?? mood;
}

export const FAVORITES_ID = "favorites";

// The person's hearted tracks as a playlist, in the order given (newest
// first). Ids no longer in the library are left out.
export function favoritesPlaylist(trackIds: Iterable<string>): Playlist {
  const tracks = [...trackIds].map((id) => findTrack(id)?.track).filter((t): t is Track => !!t);
  return {
    id: FAVORITES_ID,
    title: "My favorites",
    emoji: "💖",
    mood: "mine",
    blurb: "The sounds, tunes and songs you've hearted.",
    colors: { from: "#FBE3EC", to: "#FDF2F6" },
    tracks,
  };
}

export function playlistMinutes(p: Playlist): number {
  return Math.round(p.tracks.reduce((s, t) => s + t.durationSec, 0) / 60);
}
