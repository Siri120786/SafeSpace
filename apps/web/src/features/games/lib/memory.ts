// Memory Match rules. Pure and immutable: every move returns a new state.
import { memoryContent, type Difficulty } from "./content";
import { shuffle, type Rng } from "./rng";

export interface MemoryCard {
  index: number;
  pairId: string;
  face: string;
  state: "down" | "up" | "matched";
}

export interface MemoryState {
  cards: MemoryCard[];
  columns: number;
  totalPairs: number;
  matchedPairs: number;
  mistakes: number;
  flips: number;
  hints: number;
  /** True while two unmatched cards are showing; flip back with resolveMismatch(). */
  locked: boolean;
  status: "playing" | "won";
  /** What the last flip did, for feedback and sound. */
  lastEvent: "none" | "flip" | "match" | "miss" | "won";
}

export function newMemoryGame(difficulty: Difficulty, rng: Rng, themeId?: string): MemoryState {
  const { pairs, columns } = memoryContent.difficulty[difficulty];
  const theme = memoryContent.themes.find((t) => t.id === themeId) ?? memoryContent.themes[Math.floor(rng() * memoryContent.themes.length)];
  const faces = shuffle(theme.cards, rng).slice(0, pairs);
  const deck = shuffle(faces.flatMap((face) => [face, face]), rng);
  return {
    cards: deck.map((face, index) => ({ index, pairId: face, face, state: "down" })),
    columns,
    totalPairs: pairs,
    matchedPairs: 0,
    mistakes: 0,
    flips: 0,
    hints: 0,
    locked: false,
    status: "playing",
    lastEvent: "none",
  };
}

const faceUp = (s: MemoryState) => s.cards.filter((c) => c.state === "up");

/** Flips one card. Ignored while locked, finished, or for a card already showing. */
export function flipCard(state: MemoryState, index: number): MemoryState {
  const card = state.cards[index];
  if (!card || state.locked || state.status === "won" || card.state !== "down") return state;

  const cards = state.cards.map((c) => (c.index === index ? { ...c, state: "up" as const } : c));
  const next: MemoryState = { ...state, cards, flips: state.flips + 1, lastEvent: "flip" };
  const open = faceUp(next);
  if (open.length < 2) return next;

  const [a, b] = open;
  if (a.pairId === b.pairId) {
    const matched = cards.map((c) => (c.index === a.index || c.index === b.index ? { ...c, state: "matched" as const } : c));
    const matchedPairs = state.matchedPairs + 1;
    const won = matchedPairs === state.totalPairs;
    return { ...next, cards: matched, matchedPairs, status: won ? "won" : "playing", lastEvent: won ? "won" : "match" };
  }
  return { ...next, mistakes: state.mistakes + 1, locked: true, lastEvent: "miss" };
}

/** Turns the two showing cards back over after a miss. */
export function resolveMismatch(state: MemoryState): MemoryState {
  if (!state.locked) return state;
  return { ...state, cards: state.cards.map((c) => (c.state === "up" ? { ...c, state: "down" as const } : c)), locked: false };
}

/** Two card positions that match, to point at. Costs a hint. Prefers a pair of which one card is already showing. */
export function hintPair(state: MemoryState): { state: MemoryState; pair: [number, number] | null } {
  if (state.locked || state.status === "won") return { state, pair: null };
  const hidden = state.cards.filter((c) => c.state === "down");
  const showing = faceUp(state)[0];
  let pair: [number, number] | null = null;
  if (showing) {
    const mate = hidden.find((c) => c.pairId === showing.pairId);
    if (mate) pair = [showing.index, mate.index];
  }
  if (!pair) {
    const first = hidden[0];
    const mate = first && hidden.find((c) => c.pairId === first.pairId && c.index !== first.index);
    if (first && mate) pair = [first.index, mate.index];
  }
  return pair ? { state: { ...state, hints: state.hints + 1 }, pair } : { state, pair: null };
}

export function pairsLeft(state: MemoryState): number {
  return state.totalPairs - state.matchedPairs;
}
