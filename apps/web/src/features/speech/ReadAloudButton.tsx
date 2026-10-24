import React, { useEffect, useState } from "react";
import {
  LANG_TAGS,
  pickProfileVoice,
  pickWarmVoice,
  profileTone,
  speakText,
  type Speaker,
  type Utterance,
  type VoiceInfo,
  type VoiceProfile,
} from "./speech";

// One thing speaks at a time across the whole page: starting a new read stops
// the last one, and every button shows whether it is the one speaking.
let currentId: string | null = null;
const listeners = new Set<(id: string | null) => void>();
const setCurrent = (id: string | null) => {
  currentId = id;
  listeners.forEach((l) => l(id));
};

const speaker = (): Speaker | null =>
  typeof window !== "undefined" && "speechSynthesis" in window ? (window.speechSynthesis as unknown as Speaker) : null;

export function canReadAloud(): boolean {
  return speaker() !== null && typeof SpeechSynthesisUtterance !== "undefined";
}

// The device's voices. Some browsers fill this list a moment after the page
// loads, so it is re-read when they announce it.
let voices: VoiceInfo[] = [];
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const load = () => {
    voices = window.speechSynthesis.getVoices();
  };
  load();
  window.speechSynthesis.addEventListener?.("voiceschanged", load);
}

// Whether the device has any voice for this language (e.g. many have no Telugu
// voice; reading Telugu text in an English voice would be gibberish).
export function hasVoiceFor(tag: string): boolean {
  if (!canReadAloud()) return false;
  if (voices.length === 0) voices = window.speechSynthesis.getVoices();
  return pickWarmVoice(voices, tag) !== null;
}

// Says `text` in the warmest female voice the device has for the language
// (calm pace, mid pitch). Used by every read-aloud button and the talk board.
export function speakWarm(text: string, lang?: string, onEnd?: () => void, onWord?: () => void): boolean {
  if (voices.length === 0 && canReadAloud()) voices = window.speechSynthesis.getVoices();
  const tag = lang ?? LANG_TAGS.en;
  return speakText(text, speaker(), (t) => new SpeechSynthesisUtterance(t) as unknown as Utterance, {
    lang: tag,
    voice: pickWarmVoice(voices, tag),
    onEnd,
    onWord,
  });
}

// Says `text` in a character's voice (story player): the device's voice that
// best fits the profile, with its pitch and speed.
export function speakAs(text: string, lang: string, profile: VoiceProfile, onEnd?: () => void, onWord?: () => void): boolean {
  if (voices.length === 0 && canReadAloud()) voices = window.speechSynthesis.getVoices();
  const { voice, matched } = pickProfileVoice(voices, lang, profile);
  const tone = profileTone(profile, matched);
  return speakText(text, speaker(), (t) => new SpeechSynthesisUtterance(t) as unknown as Utterance, {
    lang,
    voice,
    pitch: tone.pitch,
    rate: tone.rate,
    onEnd,
    onWord,
  });
}

export function stopReading() {
  speaker()?.cancel();
  setCurrent(null);
}

interface Props {
  text: string;
  lang?: string;
  label?: string;          // what is read, for screen readers: "Read this entry aloud"
  className?: string;
  tone?: "light" | "dark"; // dark = on a dark background
}

let nextId = 0;

// 🔊 Read aloud, or ⏹ Stop while it's speaking. Hidden where the device can't speak.
export const ReadAloudButton: React.FC<Props> = ({ text, lang, label = "Read aloud", className = "", tone = "light" }) => {
  const [id] = useState(() => `read-${nextId++}`);
  const [speaking, setSpeaking] = useState(currentId === id);

  useEffect(() => {
    const l = (cur: string | null) => setSpeaking(cur === id);
    listeners.add(l);
    return () => {
      listeners.delete(l);
      if (currentId === id) stopReading();
    };
  }, [id]);

  if (!canReadAloud() || !text.trim()) return null;

  function toggle() {
    if (speaking) return stopReading();
    const ok = speakWarm(text, lang, () => {
      if (currentId === id) setCurrent(null);
    });
    if (ok) setCurrent(id);
  }

  const colours = tone === "dark"
    ? "border-white/40 text-white hover:bg-white/10"
    : "border-black/10 bg-white text-charcoal hover:bg-black/5";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      aria-label={speaking ? "Stop reading" : label}
      title={speaking ? "Stop reading" : label}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-olive-500 ${colours} ${className}`}
    >
      <span aria-hidden="true">{speaking ? "⏹" : "🔊"}</span>
      <span>{speaking ? "Stop" : "Read"}</span>
    </button>
  );
};
