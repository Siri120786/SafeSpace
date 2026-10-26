// supabase/functions/_shared/journalAnalysis.ts
// Rule-based journal insights for the last 30 days. Pure: no Deno APIs, no
// AI, no network, so journal text never leaves SafeSpace. Runs under Node in
// supabase/tests/journal_analysis_handler.test.mts.
//
// What it returns: counts (entries, days written, gratitude entries and the
// current gratitude streak) and up to three everyday themes the person wrote
// about (sleep, school, friends...), found by plain word lists. Never a score,
// a mood label or anything diagnostic.
//
// Crisis words: entries that trip the AI Companion's existing crisis screen
// (screenForCrisis) are left out of the themes. The writer, if such an entry
// is from the last 7 days, gets that same fixed safety message (112,
// Tele-MANAS 14416) instead of themes. A caregiver's view never changes
// because of them. Nothing is raised, sent or stored: this adds no alert or
// escalation (crisis-detection scope is unchanged).

import { safetyMessage, screenForCrisis } from "./aiCompanion.ts";

export const PERIOD_DAYS = 30;
const SAFETY_WINDOW_DAYS = 7;
export const MAX_THEMES = 3;

export interface EntryRow {
  content: string;
  entry_type: string;      // "journal" | "gratitude"
  created_at: string;      // ISO timestamp
}

export interface Theme {
  key: string;
  label: string;
  emoji: string;
  entries: number;         // entries that mention it
}

export interface JournalInsights {
  periodDays: number;
  entries: number;
  daysWritten: number;
  gratitudeEntries: number;
  gratitudeStreakDays: number;   // consecutive days with a gratitude entry, ending today or yesterday
  themes: Theme[];
  safetyMessage: string | null;  // writer only: the fixed safety message
}

export type Viewer = "writer" | "caregiver";

// Everyday topics only. Whole words plus common endings ("friend" matches
// "friends", "walk" matches "walking"), so "cat" never matches "category".
const THEMES: { key: string; label: string; emoji: string; words: string[] }[] = [
  { key: "sleep", label: "Sleep", emoji: "😴", words: ["sleep", "slept", "tired", "nap", "bedtime", "dream", "woke"] },
  { key: "school", label: "School", emoji: "🏫", words: ["school", "class", "teacher", "homework", "exam", "test", "college", "study", "studied"] },
  { key: "work", label: "Work", emoji: "💼", words: ["work", "office", "job", "boss", "meeting", "deadline", "colleague"] },
  { key: "friends", label: "Friends", emoji: "🤝", words: ["friend", "buddy", "bestie", "classmate"] },
  { key: "family", label: "Family", emoji: "🏡", words: ["family", "mom", "mum", "mother", "dad", "father", "sister", "brother", "grandma", "grandpa", "parents", "amma", "appa", "nani", "dadi"] },
  { key: "food", label: "Food", emoji: "🍎", words: ["food", "ate", "eat", "lunch", "dinner", "breakfast", "snack", "cook"] },
  { key: "play", label: "Play & hobbies", emoji: "🎨", words: ["play", "game", "draw", "paint", "read", "book", "lego", "craft", "dance", "sing", "hobby"] },
  { key: "outdoors", label: "Outdoors", emoji: "🌳", words: ["park", "walk", "outside", "garden", "beach", "nature", "cycle", "cycling", "run", "ran"] },
  { key: "pets", label: "Pets", emoji: "🐾", words: ["dog", "puppy", "cat", "kitten", "pet", "bird", "fish"] },
  { key: "music", label: "Music", emoji: "🎵", words: ["music", "song", "guitar", "piano", "playlist"] },
];

const THEME_RES = THEMES.map((t) => ({
  ...t,
  re: new RegExp(`\\b(${t.words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(s|es|ed|ing|er|ers)?\\b`, "i"),
}));

// "YYYY-MM-DD" for an instant in the given IANA timezone.
export function localDay(iso: string | Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(typeof iso === "string" ? new Date(iso) : iso);
}

function previousDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function analyzeJournal(rows: EntryRow[], opts: { viewer: Viewer; timezone: string; now: Date }): JournalInsights {
  const { viewer, timezone, now } = opts;
  const since = now.getTime() - PERIOD_DAYS * 86_400_000;
  const recent = rows.filter((r) => {
    const t = Date.parse(r.created_at);
    return !Number.isNaN(t) && t >= since && t <= now.getTime() + 60_000;
  });

  const days = new Set(recent.map((r) => localDay(r.created_at, timezone)));
  const gratitude = recent.filter((r) => r.entry_type === "gratitude");
  const gratitudeDays = new Set(gratitude.map((r) => localDay(r.created_at, timezone)));
  let streak = 0;
  let day = localDay(now, timezone);
  if (!gratitudeDays.has(day)) day = previousDay(day);
  while (gratitudeDays.has(day)) {
    streak++;
    day = previousDay(day);
  }

  const flagged = recent.filter((r) => screenForCrisis(r.content));
  const safetyCutoff = now.getTime() - SAFETY_WINDOW_DAYS * 86_400_000;
  const showSafety = viewer === "writer" && flagged.some((r) => Date.parse(r.created_at) >= safetyCutoff);

  let themes: Theme[] = [];
  if (!showSafety) {
    const usable = recent.filter((r) => !flagged.includes(r));
    themes = THEME_RES
      .map(({ key, label, emoji, re }) => ({ key, label, emoji, entries: usable.filter((r) => re.test(r.content)).length }))
      .filter((t) => t.entries > 0)
      .sort((a, b) => b.entries - a.entries)
      .slice(0, MAX_THEMES);
  }

  return {
    periodDays: PERIOD_DAYS,
    entries: recent.length,
    daysWritten: days.size,
    gratitudeEntries: gratitude.length,
    gratitudeStreakDays: streak,
    themes,
    safetyMessage: showSafety ? safetyMessage("en") : null,
  };
}
