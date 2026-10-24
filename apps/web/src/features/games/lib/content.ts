// Typed access to the shared game content in packages/game-content. The same
// JSON files are copied to apps/mobile/assets/games so web and mobile show the
// same puzzles; apps/web/tests/games.test.mts checks the copies match.
import catalogJson from "../../../../../../packages/game-content/catalog.json";
import symbolsJson from "../../../../../../packages/game-content/symbols.json";
import memoryJson from "../../../../../../packages/game-content/memory-match.json";
import patternJson from "../../../../../../packages/game-content/pattern-quest.json";
import feelingsJson from "../../../../../../packages/game-content/feelings-detective.json";
import imagineJson from "../../../../../../packages/game-content/imagine-create.json";
import mazeJson from "../../../../../../packages/game-content/maze-explorer.json";

export const GAME_IDS = ["memory-match", "pattern-quest", "feelings-detective", "imagine-create", "maze-explorer"] as const;
export type GameId = (typeof GAME_IDS)[number];
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type Strings = Record<string, Record<string, string>>;

export interface CatalogGame {
  id: GameId;
  emoji: string;
  category: string;
  tier: "mvp" | "next" | "stretch";
  available: boolean;
  titleKey: string;
  blurbKey: string;
  skills: string[];
}

export interface PatternRound {
  id: string;
  kind: "shape" | "color" | "object" | "number";
  items: string[];
  options: string[];
  answer: string;
  rule?: { type: "add"; by: number } | { type: "double" } | { type: "fibonacci" };
  hintKey: string;
}

export type Fit = "strong" | "okay" | "unlikely";
export type StepFit = "helpful" | "okay" | "notHelpful";
export interface FeelingsScenario {
  id: string;
  character: string;
  name: string;
  sceneKey: string;
  clueKeys: string[];
  feelings: { id: string; fit: Fit }[];
  steps: { id: string; textKey: string; fit: StepFit }[];
}

export interface MazeDef {
  id: string;
  columns: number;
  rows: string[];
  start: [number, number];
  goal: [number, number];
}

export const catalog = catalogJson as unknown as {
  version: number;
  games: CatalogGame[];
  difficulties: Difficulty[];
  adaptation: { window: number; stepUpIfAtMostMistakes: number; stepUpIfAtMostHints: number; stepDownIfAtLeastMistakes: number };
  strings: Strings;
};
export const symbols = symbolsJson as unknown as Record<string, Record<string, string>>;

export const memoryContent = memoryJson as unknown as {
  difficulty: Record<Difficulty, { pairs: number; columns: number }>;
  themes: { id: string; titleKey: string; cards: string[] }[];
  timing: { flipBackMs: number; flipBackCalmMs: number };
  feedbackKeys: { match: string[]; miss: string[]; done: string[] };
  strings: Strings;
};
export const patternContent = patternJson as unknown as {
  roundsPerGame: number;
  rounds: Record<Difficulty, PatternRound[]>;
  feedbackKeys: { correct: string[]; retry: string[] };
  strings: Strings;
};
export const feelingsContent = feelingsJson as unknown as {
  roundsPerGame: number;
  feelings: Record<string, string>;
  scenarios: Record<Difficulty, FeelingsScenario[]>;
  strings: Strings;
};
export const imagineContent = imagineJson as unknown as {
  character: {
    bodies: string[];
    colors: { id: string; hex: string; nameKey: string }[];
    accessories: string[];
    powers: string[];
    minChoices: number;
  };
  scene: {
    backdrops: { id: string; emoji: string; from: string; to: string; nameKey: string }[];
    stickers: string[];
    grid: { columns: number; rows: number };
    minStickers: number;
  };
  story: {
    starters: { id: string; textKey: string; nextKeys: string[]; endKeys: string[] }[];
    maxOwnTextLength: number;
  };
  strings: Strings;
};
export const mazeContent = mazeJson as unknown as { mazes: Record<Difficulty, MazeDef[]>; strings: Strings };

// Every string table, merged per language. Later files never override earlier
// keys because every key is prefixed by its game.
const ALL_STRINGS: Strings[] = [
  catalog.strings,
  memoryContent.strings,
  patternContent.strings,
  feelingsContent.strings,
  imagineContent.strings,
  mazeContent.strings,
];

export const SUPPORTED_LANGUAGES = ["en"] as const;

/** The language games will use: the wanted one if we have it, else English. */
export function resolveLanguage(wanted: string | null | undefined): string {
  const base = (wanted ?? "en").toLowerCase().split("-")[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base) ? base : "en";
}

/** True when the wanted language is not available and English is used instead. */
export function usesFallbackLanguage(wanted: string | null | undefined): boolean {
  const base = (wanted ?? "en").toLowerCase().split("-")[0];
  return !(SUPPORTED_LANGUAGES as readonly string[]).includes(base);
}

/** Looks a key up in the language, then English, then returns the key itself. */
export function text(key: string, vars: Record<string, string> = {}, lang = "en"): string {
  let value: string | undefined;
  for (const table of ALL_STRINGS) {
    value = table[lang]?.[key] ?? value;
  }
  if (value === undefined) {
    for (const table of ALL_STRINGS) value = table.en?.[key] ?? value;
  }
  let out = value ?? key;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v);
  return out;
}

/** Spoken / screen-reader name of a picture. Numbers and unknown pictures read as themselves. */
export function symbolName(symbol: string, lang = "en"): string {
  return symbols[lang]?.[symbol] ?? symbols.en?.[symbol] ?? symbol;
}

export function feelingLabel(id: string, lang = "en"): string {
  return text(`feeling.${id}`, {}, lang);
}

export function isGameId(v: unknown): v is GameId {
  return typeof v === "string" && (GAME_IDS as readonly string[]).includes(v);
}
export function isDifficulty(v: unknown): v is Difficulty {
  return typeof v === "string" && (DIFFICULTIES as readonly string[]).includes(v);
}

export function allStringTables(): Strings[] {
  return ALL_STRINGS;
}
