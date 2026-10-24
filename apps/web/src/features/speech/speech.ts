// Pure helpers for reading aloud (speech synthesis) and dictation (speech
// recognition), both built into the browser and free. No React here, so
// apps/web/tests/speech.test.mts can check them with fakes.
import type { DueReminder, LanguageCode, RoutineWithSteps } from "@safespace/shared-types";

// AI Companion language codes to BCP 47 tags for voices and recognition.
export const LANG_TAGS: Record<LanguageCode, string> = {
  en: "en-IN",
  hi: "hi-IN",
  te: "te-IN",
  ta: "ta-IN",
  kn: "kn-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  ur: "ur-IN",
};

export function langTag(code: LanguageCode | null | undefined): string {
  return (code && LANG_TAGS[code]) || LANG_TAGS.en;
}

// The bits of the Web Speech API used here; injectable for tests.
export interface VoiceInfo {
  name: string;
  lang: string;        // e.g. "en-IN"
  localService?: boolean;
}
export interface Utterance {
  text: string;
  lang?: string;
  rate?: number;
  pitch?: number;
  voice?: VoiceInfo | null;
  onend?: (() => void) | null;
  onerror?: (() => void) | null;
  onboundary?: (() => void) | null; // fires at each word, where the browser supports it
}

// A warm, calm reading voice: slightly slower than normal, a touch above a
// neutral pitch (mid, not high).
export const WARM_RATE = 0.9;
export const WARM_PITCH = 1.05;

// Female voices known on Edge, Windows, Chrome, macOS/iOS and Android, by
// language. The newer "Natural"/"Online" voices sound far warmer.
const FEMALE = [
  // English
  "neerja", "aria", "jenny", "sonia", "libby", "natasha", "clara", "emma", "ava", "michelle",
  "samantha", "karen", "moira", "tessa", "veena", "heera", "zira", "uk english female", "us english",
  // Indian languages
  "swara", "kalpana", "lekha", "shruti", "pallavi", "sapna", "aarohi", "tanishaa", "uzma", "gul",
  "google हिन्दी", "google भारत",
];
const MALE = [
  "prabhat", "madhur", "mohan", "valluvar", "gagan", "manohar", "bashkar", "asad", "salman",
  "guy", "ryan", "christopher", "eric", "davis", "david", "mark", "ravi", "hemant", "rishi",
  "daniel", "alex", "fred", "thomas", "george",
];

// Picks the warmest female voice for a language tag, or null to let the
// device decide (no voice for that language at all).
export function pickWarmVoice<V extends VoiceInfo>(voices: readonly V[], tag: string): V | null {
  const want = tag.toLowerCase();
  const base = want.split("-")[0];
  let best: V | null = null;
  let bestScore = -Infinity;
  for (const v of voices) {
    const lang = v.lang.toLowerCase().replace("_", "-");
    if (lang.split("-")[0] !== base) continue;
    const name = v.name.toLowerCase();
    let score = lang === want ? 30 : 10;
    if (FEMALE.some((f) => name.includes(f))) score += 100;
    // "female" contains "male", so check the word on its own.
    if (MALE.some((m) => name.includes(m)) || /(^|[^e])male/.test(name)) score -= 200;
    if (name.includes("natural") || name.includes("online") || name.includes("neural")) score += 50;
    if (name.includes("google")) score += 15;  // Chrome's online voices beat the old desktop ones
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

// A character's voice: which kind of voice to look for, which one of those
// (so two characters can sound different when the device has several), and
// pitch and speed. On a device with a single voice, pitch and speed still
// tell the characters apart.
export interface VoiceProfile {
  gender: "female" | "male";
  pick: number;   // 0 = the best match, 1 = the next one, ...
  pitch: number;  // 0 to 2; 1 is normal
  rate: number;   // 0.1 to 10; 1 is normal
}

const isNatural = (name: string) => name.includes("natural") || name.includes("online") || name.includes("neural");
const isFemale = (name: string) => FEMALE.some((f) => name.includes(f));
const isMale = (name: string) => MALE.some((m) => name.includes(m)) || /(^|[^e])male/.test(name);

// The device's voices for a language, best first for the wanted gender:
// that gender's voices, then unknown ones, then the other gender.
export function rankVoices<V extends VoiceInfo>(voices: readonly V[], tag: string, gender: "female" | "male"): V[] {
  const want = tag.toLowerCase();
  const base = want.split("-")[0];
  const scored: { v: V; score: number }[] = [];
  for (const v of voices) {
    const lang = v.lang.toLowerCase().replace("_", "-");
    if (lang.split("-")[0] !== base) continue;
    const name = v.name.toLowerCase();
    const female = isFemale(name);
    const male = !female && isMale(name);
    let score = lang === want ? 30 : 10;
    if (gender === "female") score += female ? 100 : male ? -200 : 0;
    else score += male ? 100 : female ? -200 : 0;
    if (isNatural(name)) score += 50;
    if (name.includes("google")) score += 15;
    scored.push({ v, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.v);
}

// The voice for a profile, and whether it really is the wanted gender (when
// it isn't, the caller shifts the pitch instead). Characters keep the story's
// accent: voices for the exact language (en-IN) come first, and another
// accent (en-US) is only used when the exact one has none of that gender.
export function pickProfileVoice<V extends VoiceInfo>(
  voices: readonly V[],
  tag: string,
  profile: VoiceProfile,
): { voice: V | null; matched: boolean } {
  const ranked = rankVoices(voices, tag, profile.gender);
  if (!ranked.length) return { voice: null, matched: false };
  const same = ranked.filter((v) => {
    const n = v.name.toLowerCase();
    return profile.gender === "female" ? isFemale(n) : !isFemale(n) && isMale(n);
  });
  const exact = same.filter((v) => v.lang.toLowerCase().replace("_", "-") === tag.toLowerCase());
  const accent = exact.length ? exact : same;
  // Don't mix a natural voice with the old robotic ones: when the device has
  // natural voices (Edge, newer Windows/Android), the characters use only those.
  const natural = accent.filter((v) => isNatural(v.name.toLowerCase()));
  const pool = natural.length ? natural : accent;
  if (pool.length) return { voice: pool[profile.pick % pool.length], matched: true };
  return { voice: ranked[0], matched: false };
}

// Pitch and speed for a profile, given whether its voice matched. A male
// character read by a female voice (or the other way round) moves the pitch
// further, within what browsers allow.
export function profileTone(profile: VoiceProfile, matched: boolean): { pitch: number; rate: number } {
  const shift = matched ? 0 : profile.gender === "male" ? -0.3 : 0.2;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return { pitch: clamp(profile.pitch + shift, 0.1, 2), rate: clamp(profile.rate, 0.5, 1.5) };
}

export interface Speaker {
  cancel(): void;
  speak(u: Utterance): void;
}

// Stops anything already speaking, then says `text`. Returns false when the
// device can't speak or there's nothing to say.
export function speakText(
  text: string,
  speaker: Speaker | null,
  makeUtterance: (t: string) => Utterance,
  options: { lang?: string; rate?: number; pitch?: number; voice?: VoiceInfo | null; onEnd?: () => void; onWord?: () => void } = {},
): boolean {
  const clean = text.trim();
  if (!speaker || !clean) return false;
  try {
    speaker.cancel();
    const u = makeUtterance(clean);
    if (options.voice) {
      u.voice = options.voice;
      u.lang = options.voice.lang;
    } else if (options.lang) u.lang = options.lang;
    u.rate = options.rate ?? WARM_RATE;
    u.pitch = options.pitch ?? WARM_PITCH;
    u.onend = options.onEnd ?? null;
    u.onerror = options.onEnd ?? null;
    u.onboundary = options.onWord ?? null;
    speaker.speak(u);
    return true;
  } catch {
    return false;
  }
}

// Adds dictated words to what's already typed: a space between them, and a
// capital letter at the start of a sentence. Never goes past `max`.
export function appendTranscript(existing: string, spoken: string, max: number): string {
  const add = spoken.trim();
  if (!add) return existing;
  const before = existing.replace(/\s+$/, "");
  const startsSentence = before === "" || /[.!?]$/.test(before);
  const piece = startsSentence ? add.charAt(0).toUpperCase() + add.slice(1) : add;
  return (before ? `${before} ${piece}` : piece).slice(0, max);
}

// The browser's speech recognition constructor, if it has one.
export function recognitionCtor(win: unknown): (new () => unknown) | null {
  const w = win as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown } | null;
  return w?.SpeechRecognition ?? w?.webkitSpeechRecognition ?? null;
}

// What dictation errors mean to the person using it; null when there's nothing to say.
export function dictationErrorText(code: string): string | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "The microphone is blocked. Allow it in your browser settings to speak instead of typing.";
    case "audio-capture":
      return "No microphone was found.";
    case "network":
      return "Couldn't turn speech into text just now. Try again, or type instead.";
    case "no-speech":
    case "aborted":
      return null;
    default:
      return "Couldn't hear that. Try again, or type instead.";
  }
}

// "Morning. Wake up at 07:00. Then brush teeth." Unticked steps only, unless all are done.
export function routineSpeech(routine: Pick<RoutineWithSteps, "title" | "steps">): string {
  const open = routine.steps.filter((s) => !s.completedOnDate);
  if (routine.steps.length > 0 && open.length === 0) return `${routine.title}. All done!`;
  const parts = open.map((s, i) => {
    const words = `${s.label}${s.scheduledTime ? ` at ${s.scheduledTime}` : ""}`;
    return i === 0 ? words : `Then ${words.charAt(0).toLowerCase()}${words.slice(1)}`;
  });
  return [routine.title, ...parts].map((p) => (/[.!?]$/.test(p) ? p : `${p}.`)).join(" ");
}

export function reminderSpeech(d: Pick<DueReminder, "reminder">): string {
  return `Reminder: ${d.reminder.title}.`;
}
