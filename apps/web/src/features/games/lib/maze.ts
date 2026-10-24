// Maze Explorer rules: movement, shortest path (for hints and scoring) and undo.
import { mazeContent, type Difficulty, type MazeDef } from "./content";
import { shuffle, type Rng } from "./rng";

export type Dir = "up" | "down" | "left" | "right";
export type Pos = [number, number]; // [x, y]
const DELTA: Record<Dir, Pos> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export interface MazeState {
  maze: MazeDef;
  pos: Pos;
  /** Where the explorer has been, oldest first, for undo. Does not include `pos`. */
  history: Pos[];
  steps: number;
  hints: number;
  /** Bumps into walls, only used to give kind feedback. */
  bumps: number;
  status: "playing" | "won";
  lastEvent: "none" | "move" | "bump" | "undo" | "won";
}

export function pickMaze(difficulty: Difficulty, rng: Rng): MazeDef {
  return shuffle(mazeContent.mazes[difficulty], rng)[0];
}

export function newMazeGame(maze: MazeDef): MazeState {
  return { maze, pos: [...maze.start] as Pos, history: [], steps: 0, hints: 0, bumps: 0, status: "playing", lastEvent: "none" };
}

export const isOpen = (maze: MazeDef, x: number, y: number) =>
  y >= 0 && y < maze.rows.length && x >= 0 && x < maze.columns && maze.rows[y][x] === ".";

const same = (a: Pos, b: Pos) => a[0] === b[0] && a[1] === b[1];

export function move(state: MazeState, dir: Dir): MazeState {
  if (state.status === "won") return state;
  const [dx, dy] = DELTA[dir];
  const nx = state.pos[0] + dx;
  const ny = state.pos[1] + dy;
  if (!isOpen(state.maze, nx, ny)) return { ...state, bumps: state.bumps + 1, lastEvent: "bump" };
  const pos: Pos = [nx, ny];
  const won = same(pos, state.maze.goal);
  return {
    ...state,
    pos,
    history: [...state.history, state.pos],
    steps: state.steps + 1,
    status: won ? "won" : "playing",
    lastEvent: won ? "won" : "move",
  };
}

/** Direction of an adjacent square from the explorer, or null if it isn't adjacent. */
export function dirTo(from: Pos, to: Pos): Dir | null {
  for (const d of Object.keys(DELTA) as Dir[]) {
    if (from[0] + DELTA[d][0] === to[0] && from[1] + DELTA[d][1] === to[1]) return d;
  }
  return null;
}

export function undo(state: MazeState): MazeState {
  if (state.status === "won" || state.history.length === 0) return state;
  const history = state.history.slice(0, -1);
  // Taking a step back also takes the step off the count: undo is never a penalty.
  return { ...state, pos: state.history[state.history.length - 1], history, steps: state.steps - 1, lastEvent: "undo" };
}

/** Shortest route from `from` to the goal, including both ends; null if there is none. */
export function shortestPath(maze: MazeDef, from: Pos): Pos[] | null {
  const key = (p: Pos) => `${p[0]},${p[1]}`;
  const prev = new Map<string, Pos | null>([[key(from), null]]);
  const queue: Pos[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (same(cur, maze.goal)) {
      const path: Pos[] = [];
      for (let p: Pos | null = cur; p; p = prev.get(key(p)) ?? null) path.unshift(p);
      return path;
    }
    for (const d of Object.keys(DELTA) as Dir[]) {
      const n: Pos = [cur[0] + DELTA[d][0], cur[1] + DELTA[d][1]];
      if (isOpen(maze, n[0], n[1]) && !prev.has(key(n))) {
        prev.set(key(n), cur);
        queue.push(n);
      }
    }
  }
  return null;
}

export const optimalSteps = (maze: MazeDef) => (shortestPath(maze, maze.start)?.length ?? 1) - 1;

/** The next square on the best route from where the explorer is. Costs a hint. */
export function hint(state: MazeState): { state: MazeState; next: Pos | null; dir: Dir | null } {
  if (state.status === "won") return { state, next: null, dir: null };
  const path = shortestPath(state.maze, state.pos);
  const next = path && path.length > 1 ? path[1] : null;
  if (!next) return { state, next: null, dir: null };
  return { state: { ...state, hints: state.hints + 1 }, next, dir: dirTo(state.pos, next) };
}
