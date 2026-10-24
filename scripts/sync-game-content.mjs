// Copies the shared game content (packages/game-content/*.json) into the
// Flutter app's assets so web and mobile always show the same puzzles.
// Usage: node scripts/sync-game-content.mjs
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("../packages/game-content/", import.meta.url));
const dst = fileURLToPath(new URL("../apps/mobile/assets/games/", import.meta.url));
mkdirSync(dst, { recursive: true });
for (const f of readdirSync(src).filter((x) => x.endsWith(".json"))) {
  copyFileSync(src + f, dst + f);
  console.log("copied " + f);
}
