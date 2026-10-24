// One-time generator for maze-explorer.json (mazes are fixed so the web and
// mobile apps always show the same ones). Not run by the apps.
// Usage: npx tsx packages/game-content/build-mazes.mts
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Recursive-backtracker maze on an n x n cell grid, drawn as a (2n+1) x (2n+1)
// character grid where '#' is a wall and '.' is open floor.
function makeMaze(n: number, seed: number): string[] {
  const rnd = mulberry32(seed);
  const size = 2 * n + 1;
  const g = Array.from({ length: size }, () => Array(size).fill("#"));
  const seen = Array.from({ length: n }, () => Array(n).fill(false));
  const stack: [number, number][] = [[0, 0]];
  seen[0][0] = true;
  g[1][1] = ".";
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const next = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][])
      .map(([dx, dy]) => [cx + dx, cy + dy, dx, dy] as const)
      .filter(([x, y]) => x >= 0 && y >= 0 && x < n && y < n && !seen[y][x]);
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [nx, ny, dx, dy] = next[Math.floor(rnd() * next.length)];
    seen[ny][nx] = true;
    g[2 * cy + 1 + dy][2 * cx + 1 + dx] = ".";
    g[2 * ny + 1][2 * nx + 1] = ".";
    stack.push([nx, ny]);
  }
  return g.map((r) => r.join(""));
}

const levels = { easy: { n: 4, seeds: [11, 23, 37] }, medium: { n: 6, seeds: [41, 53, 67] }, hard: { n: 8, seeds: [71, 83, 97] } };
const mazes: Record<string, unknown[]> = {};
for (const [d, { n, seeds }] of Object.entries(levels)) {
  mazes[d] = seeds.map((seed, i) => {
    const rows = makeMaze(n, seed);
    const size = 2 * n + 1;
    return { id: `mz-${d[0]}${i + 1}`, columns: size, rows, start: [1, 1], goal: [size - 2, size - 2] };
  });
}

const out = {
  gameId: "maze-explorer",
  version: 1,
  mazes,
  strings: {
    en: {
      "mz.how": "Guide the explorer to the finish flag. Use the arrow buttons, the arrow keys, or tap a square next to the explorer. Hint shows the next step. Undo takes a step back.",
      "mz.prompt": "Find the way to the flag.",
      "mz.moves": "steps",
      "mz.hint.text": "Try going this way.",
      "mz.stuck": "That way is blocked. Try another direction.",
      "mz.done1": "You found the way!",
      "mz.done2": "The explorer made it to the flag!",
      "mz.up": "Up", "mz.down": "Down", "mz.left": "Left", "mz.right": "Right",
    },
  },
};
writeFileSync(fileURLToPath(new URL("./maze-explorer.json", import.meta.url)), JSON.stringify(out, null, 1) + "\n");
console.log("wrote maze-explorer.json");
