// Rhymes to sing along with (role-flow 9a): traditional English, Hindi and
// Telugu rhymes, all public domain. Each line carries its own notes, so the
// words on screen always move with the tune. The tunes are played in the
// browser (ambience.ts), so nothing is downloaded.
//
// The English tunes are the traditional ones. The Hindi and Telugu tunes are
// our own simple melodies (families sing these differently), and their words
// need a native speaker's check: see docs/content-needing-review.md.
//
// Notes are written "C4 D4:2 R:1 F#4:0.5": a note name and octave (C4 is
// middle C), then how many beats it lasts (1 if left out). R is a rest.
// No React here, so apps/web/tests/music.test.mts can check it.

export type RhymeLang = "en" | "hi" | "te";

export const RHYME_LANG_LABELS: Record<RhymeLang, string> = { en: "English", hi: "Hindi", te: "Telugu" };

export interface RhymeLine {
  text: string;
  // The line in English letters, for Hindi and Telugu.
  roman?: string;
  notes: string;
}

export interface Rhyme {
  id: string;
  title: string;
  lang: RhymeLang;
  bpm: number;
  voice: "music_box" | "marimba";
  lines: RhymeLine[];
}

const L = (text: string, notes: string, roman?: string): RhymeLine => ({ text, notes, roman });

const TWINKLE_1 = "C4 C4 G4 G4 A4 A4 G4:2";
const TWINKLE_2 = "F4 F4 E4 E4 D4 D4 C4:2";
const TWINKLE_3 = "G4 G4 F4 F4 E4 E4 D4:2";
const EIEIO = "B4 B4 A4 A4 G4:3 R:1";
const LONDON = "G4:1.5 A4:0.5 G4 F4 E4 F4 G4:2";
// Chandamama Raave: two phrases taking turns, the last line coming home.
const CHANDA_A = "E4 G4 A4 G4 E4 D4 E4:2";
const CHANDA_B = "D4 E4 G4 E4 D4 C4 D4:2";
const CHANDA_END = "D4 E4 G4 E4 D4 D4 C4:2";

export const RHYMES: Rhyme[] = [
  {
    id: "twinkle-twinkle",
    title: "Twinkle, Twinkle, Little Star",
    lang: "en",
    bpm: 96,
    voice: "music_box",
    lines: [
      L("Twinkle, twinkle, little star,", TWINKLE_1),
      L("How I wonder what you are!", TWINKLE_2),
      L("Up above the world so high,", TWINKLE_3),
      L("Like a diamond in the sky.", TWINKLE_3),
      L("Twinkle, twinkle, little star,", TWINKLE_1),
      L("How I wonder what you are!", TWINKLE_2),
    ],
  },
  {
    id: "baa-baa-black-sheep",
    title: "Baa, Baa, Black Sheep",
    lang: "en",
    bpm: 100,
    voice: "marimba",
    lines: [
      L("Baa, baa, black sheep, have you any wool?", "C4 C4 G4 G4 A4:0.5 B4:0.5 C5:0.5 A4:0.5 G4:2"),
      L("Yes sir, yes sir, three bags full!", "F4 F4 E4 E4 D4 D4 C4:2"),
      L("One for the master, and one for the dame,", "G4 G4:0.5 G4:0.5 F4 F4 E4:0.5 E4:0.5 E4:0.5 E4:0.5 D4:2"),
      L("And one for the little boy who lives down the lane.", "G4:0.5 G4:0.5 G4:0.5 G4:0.5 F4:0.5 F4:0.5 F4 E4 E4 D4:0.5 D4:0.5 C4:2"),
    ],
  },
  {
    id: "row-your-boat",
    title: "Row, Row, Row Your Boat",
    lang: "en",
    bpm: 104,
    voice: "music_box",
    lines: [
      L("Row, row, row your boat,", "C4:1.5 C4:1.5 C4 D4:0.5 E4:1.5"),
      L("Gently down the stream.", "E4 D4:0.5 E4 F4:0.5 G4:3"),
      L("Merrily, merrily, merrily, merrily,", "C5:0.5 C5:0.5 C5:0.5 G4:0.5 G4:0.5 G4:0.5 E4:0.5 E4:0.5 E4:0.5 C4:0.5 C4:0.5 C4:0.5"),
      L("Life is but a dream.", "G4 F4:0.5 E4 D4:0.5 C4:3"),
    ],
  },
  {
    id: "mary-little-lamb",
    title: "Mary Had a Little Lamb",
    lang: "en",
    bpm: 108,
    voice: "marimba",
    lines: [
      L("Mary had a little lamb,", "E4 D4 C4 D4 E4 E4 E4:2"),
      L("Little lamb, little lamb,", "D4 D4 D4:2 E4 G4 G4:2"),
      L("Mary had a little lamb,", "E4 D4 C4 D4 E4 E4 E4"),
      L("Its fleece was white as snow.", "E4 D4 D4 E4 D4 C4:4"),
    ],
  },
  {
    id: "london-bridge",
    title: "London Bridge",
    lang: "en",
    bpm: 108,
    voice: "marimba",
    lines: [
      L("London Bridge is falling down,", LONDON),
      L("Falling down, falling down.", "D4 E4 F4:2 E4 F4 G4:2"),
      L("London Bridge is falling down,", LONDON),
      L("My fair lady.", "D4:2 G4:2 E4 C4:3"),
    ],
  },
  {
    id: "itsy-bitsy-spider",
    title: "Itsy Bitsy Spider",
    lang: "en",
    bpm: 104,
    voice: "music_box",
    lines: [
      L("The itsy bitsy spider climbed up the water spout.", "G3:0.5 C4 C4:0.5 C4 D4:0.5 E4:1.5 E4 E4:0.5 D4 C4:0.5 D4 E4:0.5 C4:1.5"),
      L("Down came the rain and washed the spider out.", "E4:1.5 E4 F4:0.5 G4:1.5 G4:1.5 F4 E4:0.5 F4 G4:0.5 E4:3"),
      L("Out came the sun and dried up all the rain,", "C4:1.5 C4 D4:0.5 E4:1.5 E4:1.5 D4 C4:0.5 D4 E4:0.5 C4:3"),
      L("And the itsy bitsy spider climbed up the spout again.", "G3:0.5 G3:0.5 C4 C4:0.5 C4 D4:0.5 E4:1.5 E4 E4:0.5 D4 C4:0.5 D4 E4:0.5 C4:1.5"),
    ],
  },
  {
    id: "old-macdonald",
    title: "Old MacDonald Had a Farm",
    lang: "en",
    bpm: 120,
    voice: "marimba",
    lines: [
      L("Old MacDonald had a farm,", "G4 G4 G4 D4 E4 E4 D4:2"),
      L("E-I-E-I-O!", EIEIO),
      L("And on that farm he had a cow,", "D4 G4 G4 G4 D4 E4 E4 D4:2"),
      L("E-I-E-I-O!", EIEIO),
      L("With a moo moo here, and a moo moo there,", "D4:0.5 D4:0.5 G4 G4 G4:2 D4:0.5 D4:0.5 G4 G4 G4:2"),
      L("Here a moo, there a moo, everywhere a moo moo,", "G4:0.5 G4:0.5 G4 G4:0.5 G4:0.5 G4 G4:0.5 G4:0.5 G4:0.5 G4:0.5 G4 G4"),
      L("Old MacDonald had a farm,", "G4 G4 G4 D4 E4 E4 D4:2"),
      L("E-I-E-I-O!", EIEIO),
    ],
  },
  {
    id: "machhli-jal-ki-rani",
    title: "मछली जल की रानी है",
    lang: "hi",
    bpm: 100,
    voice: "music_box",
    lines: [
      L("मछली जल की रानी है,", "C4 C4 E4 G4 G4 A4 G4:2", "Machhli jal ki rani hai,"),
      L("जीवन उसका पानी है।", "F4 F4 E4 E4 D4 D4 C4:2", "Jeevan uska paani hai."),
      L("हाथ लगाओ डर जाएगी,", "E4 E4 G4 G4 A4 A4 G4 E4:2", "Haath lagao dar jaayegi,"),
      L("बाहर निकालो मर जाएगी।", "D4 D4 E4 E4 D4 C4 D4 E4 C4:2", "Baahar nikaalo mar jaayegi."),
    ],
  },
  {
    id: "aloo-kachaloo",
    title: "आलू कचालू बेटा",
    lang: "hi",
    bpm: 112,
    voice: "marimba",
    lines: [
      L("आलू कचालू बेटा कहाँ गए थे?", "G4 G4 E4:0.5 E4:0.5 G4 E4 E4 D4 D4:0.5 E4:0.5 C4 D4:2", "Aaloo kachaaloo beta kahaan gaye the?"),
      L("बैंगन की टोकरी में सो रहे थे।", "G4 G4 E4 G4 G4 E4 D4 E4 D4 C4:2", "Baingan ki tokri mein so rahe the."),
      L("बैंगन ने लात मारी, रो रहे थे,", "E4 E4 D4 C4 D4 E4 D4 C4 D4 G3:2", "Baingan ne laat maari, ro rahe the,"),
      L("मम्मी ने प्यार किया, हँस रहे थे।", "G4 G4 E4 G4 A4 G4 E4 D4 E4 C4:2", "Mummy ne pyaar kiya, hans rahe the."),
    ],
  },
  {
    id: "chandamama-raave",
    title: "చందమామ రావే",
    lang: "te",
    bpm: 84,
    voice: "music_box",
    lines: [
      L("చందమామ రావే, జాబిల్లి రావే,", CHANDA_A, "Chandamama raave, jaabilli raave,"),
      L("కొండెక్కి రావే, గోగుపూలు తేవే,", CHANDA_B, "Kondekki raave, gogupoolu teve,"),
      L("బండెక్కి రావే, బంతిపూలు తేవే,", CHANDA_A, "Bandekki raave, bantipoolu teve,"),
      L("తేరు మీద రావే, తేనెపట్టు తేవే,", CHANDA_B, "Teru meeda raave, tenepattu teve,"),
      L("పల్లకీలో రావే, పాలు పెరుగు తేవే,", CHANDA_A, "Pallakeelo raave, paalu perugu teve,"),
      L("పరుగు పరుగున రావే, పనస పండు తేవే,", CHANDA_B, "Parugu paruguna raave, panasa pandu teve,"),
      L("నిచ్చెనెక్కి రావే, నిమ్మపండు తేవే,", CHANDA_A, "Nichchenekki raave, nimmapandu teve,"),
      L("అన్నిటినీ తేవే, మా పాపాయికివ్వవే.", CHANDA_END, "Annitinee teve, maa paapaayikivvave."),
    ],
  },
  {
    id: "chitti-chilakamma",
    title: "చిట్టి చిలకమ్మా",
    lang: "te",
    bpm: 112,
    voice: "marimba",
    lines: [
      L("చిట్టి చిలకమ్మా, అమ్మ కొట్టిందా?", "G4 G4 E4 G4 A4:2 G4 E4 D4 E4:2", "Chitti chilakamma, amma kottinda?"),
      L("తోటకెళ్ళావా, పండు తెచ్చావా?", "E4 G4 A4 G4:2 E4 D4 C4 D4:2", "Thotakellava, pandu techchava?"),
      L("గూట్లో పెట్టావా, గుటుక్కున మింగావా?", "G4 A4 G4 E4:2 D4 E4 D4 C4 D4 C4:2", "Gootlo pettava, gutukkuna mingava?"),
    ],
  },
];

export function findRhyme(id: string): Rhyme | null {
  return RHYMES.find((r) => r.id === id) ?? null;
}

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// "F#4:0.5" -> { midi: 66, beats: 0.5 }; "R:2" -> { midi: null, beats: 2 }.
export function parseNotes(notes: string): { midi: number | null; beats: number }[] {
  return notes.trim().split(/\s+/).map((token) => {
    const m = /^(?:(R)|([A-G])([#b]?)(\d))(?::(\d+(?:\.\d+)?))?$/.exec(token);
    if (!m) throw new Error(`Not a note: ${token}`);
    const beats = m[5] ? Number(m[5]) : 1;
    if (!(beats > 0)) throw new Error(`Not a length: ${token}`);
    if (m[1]) return { midi: null, beats };
    const shift = m[3] === "#" ? 1 : m[3] === "b" ? -1 : 0;
    return { midi: 12 * (Number(m[4]) + 1) + NOTE_INDEX[m[2]] + shift, beats };
  });
}

export interface RhymeTimeline {
  // Notes in seconds from the start (rests left out).
  notes: { midi: number; at: number; dur: number }[];
  // When each line starts and ends, in seconds.
  lines: { start: number; end: number }[];
  totalSec: number;
}

// A short breath between lines, so the words have room.
const LINE_GAP_BEATS = 0.5;

export function rhymeTimeline(r: Rhyme): RhymeTimeline {
  const sec = 60 / r.bpm;
  const notes: RhymeTimeline["notes"] = [];
  const lines: RhymeTimeline["lines"] = [];
  let beat = 0;
  for (const line of r.lines) {
    const start = beat * sec;
    for (const n of parseNotes(line.notes)) {
      if (n.midi !== null) notes.push({ midi: n.midi, at: beat * sec, dur: n.beats * sec });
      beat += n.beats;
    }
    lines.push({ start, end: beat * sec });
    beat += LINE_GAP_BEATS;
  }
  return { notes, lines, totalSec: beat * sec };
}

// The line being sung at `sec` (the last one stays lit through the pause
// after it), or -1 before the first.
export function lineAt(t: RhymeTimeline, sec: number): number {
  let current = -1;
  t.lines.forEach((l, i) => {
    if (sec >= l.start) current = i;
  });
  return current;
}

// All the words, for reading aloud.
export function rhymeWords(r: Rhyme): string {
  return r.lines.map((l) => l.text).join("\n");
}
