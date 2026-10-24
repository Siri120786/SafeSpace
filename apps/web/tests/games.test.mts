// Games Corner: shared content checks and the pure game rules (Memory Match,
// Pattern Quest, Feelings Detective, Imagine & Create, Maze Explorer), scoring,
// level suggestions, local-first progress and sound scripts.
// Usage: npx tsx apps/web/tests/games.test.mts
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as C from "../src/features/games/lib/content.ts";
import { mulberry32 } from "../src/features/games/lib/rng.ts";
import * as S from "../src/features/games/lib/scoring.ts";
import * as M from "../src/features/games/lib/memory.ts";
import * as P from "../src/features/games/lib/pattern.ts";
import * as F from "../src/features/games/lib/feelings.ts";
import * as Z from "../src/features/games/lib/maze.ts";
import * as I from "../src/features/games/lib/imagine.ts";
import * as G from "../src/features/games/lib/progress.ts";
import * as N from "../src/features/games/lib/soundScript.ts";
import { summarizeGameProgress } from "../src/features/games/lib/summary.ts";
import { GAME_IDS as SHARED_IDS, GAME_DIFFICULTIES } from "../../../packages/shared-types/src/index.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------
ok("game ids and difficulties match shared-types", JSON.stringify(C.GAME_IDS) === JSON.stringify(SHARED_IDS) &&
  JSON.stringify(C.DIFFICULTIES) === JSON.stringify(GAME_DIFFICULTIES));
ok("catalog lists every game once and all are available",
  C.catalog.games.map((g) => g.id).join() === C.GAME_IDS.join() && C.catalog.games.every((g) => g.available));
ok("three MVP games come first",
  C.catalog.games.filter((g) => g.tier === "mvp").map((g) => g.id).join() === "memory-match,pattern-quest,feelings-detective");

// Every text key used in content resolves to real English text.
const keysUsed = new Set<string>();
for (const g of C.catalog.games) { keysUsed.add(g.titleKey); keysUsed.add(g.blurbKey); }
for (const t of C.memoryContent.themes) keysUsed.add(t.titleKey);
Object.values(C.memoryContent.feedbackKeys).flat().forEach((k) => keysUsed.add(k));
Object.values(C.patternContent.rounds).flat().forEach((r) => keysUsed.add(r.hintKey));
Object.values(C.patternContent.feedbackKeys).flat().forEach((k) => keysUsed.add(k));
for (const s of Object.values(C.feelingsContent.scenarios).flat()) {
  keysUsed.add(s.sceneKey);
  s.clueKeys.forEach((k) => keysUsed.add(k));
  s.steps.forEach((x) => keysUsed.add(x.textKey));
  s.feelings.forEach((f) => keysUsed.add(`feeling.${f.id}`));
}
C.imagineContent.character.colors.forEach((c) => keysUsed.add(c.nameKey));
C.imagineContent.character.powers.forEach((k) => keysUsed.add(k));
C.imagineContent.scene.backdrops.forEach((b) => keysUsed.add(b.nameKey));
for (const st of C.imagineContent.story.starters) { keysUsed.add(st.textKey); st.nextKeys.forEach((k) => keysUsed.add(k)); st.endKeys.forEach((k) => keysUsed.add(k)); }
const missing = [...keysUsed].filter((k) => C.text(k) === k);
ok(`every content text key has English text (${keysUsed.size} keys)${missing.length ? " missing: " + missing.join(",") : ""}`, missing.length === 0);
ok("unknown language falls back to English; unknown key returns the key",
  C.text("ui.play", {}, "fr") === C.text("ui.play") && C.text("nope.key") === "nope.key" &&
  C.resolveLanguage("fr-CA") === "en" && C.usesFallbackLanguage("fr") && !C.usesFallbackLanguage("en-GB"));
ok("text fills {name}", C.text("fd.prompt.feeling", { name: "Bo" }) === "How might Bo be feeling?");

// Every picture has a spoken name.
const pics = new Set<string>();
C.memoryContent.themes.forEach((t) => t.cards.forEach((c) => pics.add(c)));
Object.values(C.patternContent.rounds).flat().forEach((r) => [...r.items, ...r.options].forEach((x) => x !== "?" && !/^\d+$/.test(x) && pics.add(x)));
C.imagineContent.character.bodies.forEach((x) => pics.add(x));
C.imagineContent.character.accessories.forEach((x) => pics.add(x));
C.imagineContent.scene.stickers.forEach((x) => pics.add(x));
C.imagineContent.scene.backdrops.forEach((b) => pics.add(b.emoji));
Object.values(C.feelingsContent.scenarios).flat().forEach((s) => pics.add(s.character));
const unnamed = [...pics].filter((p) => C.symbolName(p) === p);
ok(`every picture has a spoken name${unnamed.length ? " missing: " + unnamed.join(" ") : ""}`, unnamed.length === 0);

// ---------------------------------------------------------------------------
// Scoring and suggestions
// ---------------------------------------------------------------------------
ok("stars: at least one for everyone who finishes", S.starsFor(0) === 1 && S.starsFor(60) === 2 && S.starsFor(95) === 3 && S.starsFor(null) === 3);
ok("memory score: perfect = 100, mistakes and hints lower it, never below 0",
  S.memoryScore(4, 0, 0) === 100 && S.memoryScore(4, 4, 0) === 50 && S.memoryScore(3, 0, 2) === 90 && S.memoryScore(3, 100, 99) === 0);
ok("question credit: first try full, second half, hint caps at 0.75",
  S.questionCredit(1, false) === 1 && S.questionCredit(2, false) === 0.5 && S.questionCredit(5, false) === 0.25 && S.questionCredit(1, true) === 0.75);
ok("maze score: shortest route = 100", S.mazeScore(20, 20, 0) === 100 && S.mazeScore(20, 40, 0) === 50 && S.mazeScore(20, 20, 2) === 90);
const smooth = (d: C.Difficulty) => ({ difficulty: d, mistakes: 0, hints: 0 });
const rough = (d: C.Difficulty) => ({ difficulty: d, mistakes: 6, hints: 2 });
ok("suggestion: three smooth rounds suggest up; not at hard; needs a full window",
  S.suggestDifficulty("easy", [smooth("easy"), smooth("easy"), smooth("easy")]) === "up" &&
  S.suggestDifficulty("hard", [smooth("hard"), smooth("hard"), smooth("hard")]) === "same" &&
  S.suggestDifficulty("easy", [smooth("easy"), smooth("easy")]) === "same");
ok("suggestion: a run of hard rounds suggests down; never below easy; other levels ignored",
  S.suggestDifficulty("medium", [rough("medium"), rough("medium"), rough("medium")]) === "down" &&
  S.suggestDifficulty("easy", [rough("easy"), rough("easy"), rough("easy")]) === "same" &&
  S.suggestDifficulty("medium", [smooth("easy"), smooth("easy"), smooth("medium")]) === "same");
ok("nextDifficulty steps once and stops at the ends",
  S.nextDifficulty("easy", "up") === "medium" && S.nextDifficulty("hard", "up") === "hard" && S.nextDifficulty("easy", "down") === "easy");

// ---------------------------------------------------------------------------
// Memory Match
// ---------------------------------------------------------------------------
for (const d of C.DIFFICULTIES) {
  const g = M.newMemoryGame(d, mulberry32(7));
  const counts = new Map<string, number>();
  g.cards.forEach((c) => counts.set(c.face, (counts.get(c.face) ?? 0) + 1));
  ok(`memory ${d}: ${g.totalPairs} pairs, every face exactly twice`, g.cards.length === g.totalPairs * 2 && [...counts.values()].every((n) => n === 2));
}
ok("memory: pair counts 3 / 6 / 8", [3, 6, 8].every((n, i) => M.newMemoryGame(C.DIFFICULTIES[i], mulberry32(1)).totalPairs === n));
ok("memory: same seed gives the same deck",
  JSON.stringify(M.newMemoryGame("medium", mulberry32(5))) === JSON.stringify(M.newMemoryGame("medium", mulberry32(5))));
{
  let g = M.newMemoryGame("easy", mulberry32(3));
  const face = g.cards[0].face;
  const mate = g.cards.find((c) => c.face === face && c.index !== 0)!.index;
  const other = g.cards.find((c) => c.face !== face)!.index;
  g = M.flipCard(g, 0);
  ok("memory: first flip shows the card", g.cards[0].state === "up" && g.flips === 1 && !g.locked);
  const same = M.flipCard(g, 0);
  ok("memory: tapping an open card again is ignored", same === g);
  const miss = M.flipCard(g, other);
  ok("memory: a mismatch locks the board and counts one mistake", miss.locked && miss.mistakes === 1 && miss.lastEvent === "miss");
  const ignored = M.flipCard(miss, mate);
  ok("memory: repeated taps while locked do nothing", ignored === miss);
  const back = M.resolveMismatch(miss);
  ok("memory: flipping back turns both cards down and unlocks", !back.locked && back.cards.every((c) => c.state === "down"));
  const hit = M.flipCard(g, mate);
  ok("memory: a match stays open and counts a pair", hit.cards[0].state === "matched" && hit.cards[mate].state === "matched" && hit.matchedPairs === 1 && hit.lastEvent === "match");
}
{
  let g = M.newMemoryGame("easy", mulberry32(9));
  const h = M.hintPair(g);
  ok("memory: hint points at two matching cards and costs a hint",
    !!h.pair && g.cards[h.pair[0]].face === g.cards[h.pair[1]].face && h.state.hints === 1);
  for (let guard = 0; g.status === "playing" && guard < 20; guard++) {
    const { pair } = M.hintPair(g);
    g = M.flipCard(M.flipCard(g, pair![0]), pair![1]);
  }
  ok("memory: matching every pair wins with no mistakes", g.status === "won" && g.mistakes === 0 && M.pairsLeft(g) === 0 && g.lastEvent === "won");
  ok("memory: moves after winning are ignored", M.flipCard(g, 0) === g);
}

// ---------------------------------------------------------------------------
// Pattern Quest
// ---------------------------------------------------------------------------
for (const d of C.DIFFICULTIES) {
  const rounds = C.patternContent.rounds[d];
  const ids = new Set(rounds.map((r) => r.id));
  ok(`pattern ${d}: ${rounds.length} rounds, unique ids, answer is an option, options are distinct`,
    ids.size === rounds.length && rounds.every((r) => r.options.includes(r.answer) && new Set(r.options).size === r.options.length));
  ok(`pattern ${d}: numeric rules hold`, rounds.every(P.followsRule));
}
ok("pattern: every difficulty has at least a full game of rounds",
  C.DIFFICULTIES.every((d) => C.patternContent.rounds[d].length >= C.patternContent.roundsPerGame));
{
  const game = P.buildPatternGame("easy", mulberry32(2));
  ok("pattern: a game has the right number of rounds and keeps the answer among the options",
    game.length === C.patternContent.roundsPerGame && game.every((r) => r.options.includes(r.answer)));
  const gap = C.patternContent.rounds.medium.find((r) => r.items.includes("?"))!;
  ok("pattern: a gap round shows the gap in place; a next round adds a trailing ?",
    P.gapIndex(gap) >= 0 && P.displayItems(gap).join() === gap.items.join() &&
    P.displayItems(C.patternContent.rounds.easy[0]).slice(-1)[0] === "?");
  ok("pattern: solved row fills the gap or continues the row",
    !P.solvedItems(gap).includes("?") && P.solvedItems(C.patternContent.rounds.easy[0]).length === C.patternContent.rounds.easy[0].items.length + 1);
  ok("pattern: correct and wrong choices", P.isCorrect(C.patternContent.rounds.easy[0], "🔴") && !P.isCorrect(C.patternContent.rounds.easy[0], "🟢"));
  ok("pattern: equal pictures get equal notes, new ones step up", P.noteIndexes(["a", "b", "a", "c", "b"]).join() === "0,1,0,2,1");
  ok("pattern score uses first-try credit", P.patternScore({ attempts: [1, 1, 2, 1], hinted: [false, false, false, false] }) === 88);
}

// ---------------------------------------------------------------------------
// Feelings Detective
// ---------------------------------------------------------------------------
for (const d of C.DIFFICULTIES) {
  const list = C.feelingsContent.scenarios[d];
  ok(`feelings ${d}: ${list.length} scenarios, at least two accepted feelings, a helpful step and a not-helpful step`,
    list.length >= C.feelingsContent.roundsPerGame &&
    list.every((s) => s.feelings.filter((f) => f.fit !== "unlikely").length >= 2 &&
      s.steps.some((x) => x.fit === "helpful") && s.steps.some((x) => x.fit === "notHelpful") &&
      s.feelings.every((f) => f.id in C.feelingsContent.feelings)));
}
{
  const s = C.feelingsContent.scenarios.easy[0];
  ok("feelings: strong and okay feelings are accepted; unlikely is gently redirected",
    F.judgeFeeling(s, "sad").accepted && F.judgeFeeling(s, "sad").feedbackKey === "fd.fb.strong" &&
    !F.judgeFeeling(s, "excited").accepted && F.judgeFeeling(s, "excited").feedbackKey === "fd.fb.unlikely" &&
    !F.judgeFeeling(s, "not-a-feeling").accepted);
  ok("feelings: a kind step is accepted, an unkind one is not", F.judgeStep(s, "a").accepted && !F.judgeStep(s, "c").accepted);
  const multi = C.feelingsContent.scenarios.hard[0];
  ok("feelings: several interpretations are accepted where the situation is mixed",
    ["disappointed", "worried", "relieved", "angry"].every((id) => F.judgeFeeling(multi, id).accepted));
  const g = F.buildFeelingsGame("medium", mulberry32(4));
  ok("feelings: a game has the right number of scenarios", g.length === C.feelingsContent.roundsPerGame);
}

// ---------------------------------------------------------------------------
// Maze Explorer
// ---------------------------------------------------------------------------
for (const d of C.DIFFICULTIES) {
  const all = C.mazeContent.mazes[d];
  ok(`maze ${d}: ${all.length} mazes, rectangular, start and goal open, solvable`,
    all.length >= 3 && all.every((m) => m.rows.every((r) => r.length === m.columns) &&
      Z.isOpen(m, m.start[0], m.start[1]) && Z.isOpen(m, m.goal[0], m.goal[1]) && Z.shortestPath(m, m.start) !== null));
}
{
  const m = C.mazeContent.mazes.easy[0];
  let s = Z.newMazeGame(m);
  const path = Z.shortestPath(m, m.start)!;
  ok("maze: optimal steps equals path length minus one", Z.optimalSteps(m) === path.length - 1);
  const walled = (["up", "left"] as Z.Dir[]).find((d) => Z.move(s, d).bumps === 1)!;
  ok("maze: walking into a wall changes nothing but the bump count", Z.move(s, walled).pos.join() === s.pos.join() && Z.move(s, walled).steps === 0);
  const h = Z.hint(s);
  ok("maze: a hint names a legal direction and costs a hint", !!h.dir && Z.move(s, h.dir).steps === 1 && h.state.hints === 1);
  s = Z.move(s, h.dir!);
  const u = Z.undo(s);
  ok("maze: undo returns to the previous square and is not counted as a step", u.pos.join() === m.start.join() && u.history.length === 0 && u.steps === 0);
  ok("maze: undo with nothing to undo is a no-op", Z.undo(Z.newMazeGame(m)).pos.join() === m.start.join());
  let play = Z.newMazeGame(m);
  for (let i = 1; i < path.length; i++) play = Z.move(play, Z.dirTo(play.pos, path[i])!);
  ok("maze: following the route reaches the goal and wins", play.status === "won" && play.steps === Z.optimalSteps(m));
  ok("maze: moves after winning are ignored", Z.move(play, "up") === play);
}

// ---------------------------------------------------------------------------
// Imagine & Create
// ---------------------------------------------------------------------------
{
  const c = I.emptyCharacter();
  ok("create: an empty character is not finished", !I.characterIsComplete(c));
  ok("create: a body plus one more choice is enough", I.characterIsComplete({ ...c, body: "🦄", colorId: "mint" }) && !I.characterIsComplete({ ...c, colorId: "mint", accessory: "👑" }));
  let sc = I.emptyScene();
  sc = I.placeSticker(I.placeSticker(I.placeSticker({ ...sc, backdropId: "forest" }, 0, "🌳"), 5, "🌸"), 7, "🦋");
  ok("create: a scene needs a backdrop and three stickers", I.sceneIsComplete(sc) && !I.sceneIsComplete(I.placeSticker(sc, 7, null)));
  ok("create: placing outside the grid is ignored", I.placeSticker(sc, 999, "🌳") === sc);
  const st = { ...I.emptyStory(), starterId: "s1", nextKey: "ic.story.s1.n1" };
  ok("create: a story needs a starter and a middle and an ending, or the player's own words",
    !I.storyIsComplete(st) && I.storyIsComplete({ ...st, endKey: "ic.story.s1.e1" }) && I.storyIsComplete({ ...I.emptyStory(), starterId: "s1", ownText: "They flew away." }));
  ok("create: own text is tidied and limited", I.cleanOwnText("  hello \n\n  world  ") === "hello world" && I.cleanOwnText("x".repeat(500)).length === C.imagineContent.story.maxOwnTextLength);
  ok("create: composed story keeps the order", I.composeStory({ starterId: "s1", nextKey: "ic.story.s1.n1", endKey: "ic.story.s1.e1", ownText: "Then lunch." }).includes("Then lunch.") &&
    I.composeStory({ starterId: "s1", nextKey: "ic.story.s1.n1", endKey: "ic.story.s1.e1", ownText: "" }).startsWith("One morning"));
  ok("create: a character introduces itself, with or without a name",
    I.characterIntro({ ...c, name: "Zed", powerKey: "ic.power.fly" }) === "Meet Zed! Zed can fly." && I.characterIntro(c).startsWith("Meet your new friend"));
  const many = Array.from({ length: 20 }, (_, i) => ({ id: String(i), kind: "scene" as const, createdAt: "x" }));
  ok("create: kept creations are capped, newest first", many.reduce((l, x) => I.keepCreation(l, x), [] as I.Creation[]).length === I.MAX_CREATIONS &&
    I.keepCreation(many.slice(0, 3), many[2])[0].id === "2");
}

// ---------------------------------------------------------------------------
// Local-first progress
// ---------------------------------------------------------------------------
{
  const t0 = new Date("2026-10-24T10:00:00Z");
  let st = G.emptyState();
  st = G.applyRound(st, { gameId: "memory-match", difficulty: "easy", score: 70, mistakes: 1, hints: 0 }, t0);
  st = G.applyRound(st, { gameId: "memory-match", difficulty: "easy", score: 90, mistakes: 0, hints: 0 }, t0);
  st = G.applyRound(st, { gameId: "memory-match", difficulty: "easy", score: 60, mistakes: 2, hints: 0 }, t0);
  ok("progress: rounds add up and the best score is kept", st.progress.length === 1 && st.progress[0].roundsCompleted === 3 && st.progress[0].bestScore === 90);
  st = G.applyRound(st, { gameId: "imagine-create", difficulty: "easy", score: null, mistakes: 0, hints: 0 }, t0);
  ok("progress: open-ended games have no score", st.progress.find((r) => r.gameId === "imagine-create")!.bestScore === null);
  ok("progress: totals and per-game rounds", G.totalRounds(st.progress) === 4 && G.roundsFor(st.progress, "memory-match") === 3);
  ok("progress: every round is queued for saving", st.pending.length === 4);
  const capped = Array.from({ length: 80 }).reduce<G.LocalGameState>((s) => G.applyRound(s, { gameId: "maze-explorer", difficulty: "hard", score: 50, mistakes: 0, hints: 0 }, t0), G.emptyState());
  ok("progress: queue and recent history are capped", capped.pending.length === G.MAX_PENDING && (capped.recent["maze-explorer"]?.length ?? 0) === G.MAX_RECENT);
  ok("progress: scores are clamped to 0-100", G.applyRound(G.emptyState(), { gameId: "maze-explorer", difficulty: "easy", score: 250, mistakes: 0, hints: 0 }, t0).progress[0].bestScore === 100);

  // Account copy: nothing is lost either way.
  const merged = G.mergeRemote(st, {
    progress: [
      { gameId: "memory-match", difficulty: "easy", roundsCompleted: 5, bestScore: 80, lastPlayedAt: "2026-10-20T00:00:00Z" },
      { gameId: "pattern-quest", difficulty: "hard", roundsCompleted: 2, bestScore: 40, lastPlayedAt: "2026-10-21T00:00:00Z" },
    ],
    prefs: { difficulty: "medium", reducedMotion: false, soundEnabled: true, voiceEnabled: false },
  });
  const mm = merged.progress.find((r) => r.gameId === "memory-match")!;
  ok("merge: larger counts and best scores win; new rows are added; newer play time kept",
    mm.roundsCompleted === 5 && mm.bestScore === 90 && mm.lastPlayedAt === t0.toISOString() && merged.progress.length === 3);
  ok("merge: account preferences are used only when none are saved here",
    merged.prefs?.difficulty === "medium" && G.mergeRemote({ ...st, prefs: G.defaultPrefs(false) }, { progress: [], prefs: merged.prefs }).prefs?.difficulty === "easy");
  ok("defaults: calm mode starts with sound off and reduced motion on; otherwise sound on, voice off",
    G.defaultPrefs(true).soundEnabled === false && G.defaultPrefs(true).reducedMotion === true &&
    G.defaultPrefs(false).soundEnabled === true && G.defaultPrefs(false).voiceEnabled === false);

  // Offline: flushing stops at the first failure and keeps the rest, in order.
  let calls = 0;
  const flaky: G.GameBackend = {
    fetch: async () => ({ progress: [], prefs: null }),
    savePrefs: async () => {},
    record: async () => { if (++calls === 3) throw new Error("offline"); },
  };
  const first = await G.flushPending(st, flaky);
  ok("offline: a failed save keeps this and later rounds queued", !first.ok && first.state.pending.length === 2 && st.pending.length === 4);
  const second = await G.flushPending(first.state, flaky);
  ok("retry: the queue drains once the network is back", second.ok && second.state.pending.length === 0);

  // Device storage
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  ok("storage: saved state comes back after a restart", G.saveState("kid1", st, store) && JSON.stringify(G.loadState("kid1", store)) === JSON.stringify(st));
  ok("storage: each player has their own record (cross-user isolation)", G.loadState("kid2", store).progress.length === 0);
  mem.set(G.storageKey("bad"), "{not json");
  ok("storage: damaged or missing data becomes a fresh start", G.loadState("bad", store).progress.length === 0 && G.loadState("x", null).progress.length === 0);
  mem.set(G.storageKey("old"), JSON.stringify({ v: 99, progress: [1] }));
  ok("storage: an unknown version is ignored", G.loadState("old", store).progress.length === 0);
  ok("storage: a blocked device reports failure instead of throwing",
    G.saveState("k", st, { getItem: () => null, setItem: () => { throw new Error("quota"); } }) === false && G.saveState("k", st, null) === false);
}

// ---------------------------------------------------------------------------
// Caregiver summary
// ---------------------------------------------------------------------------
{
  const rows = [
    { gameId: "memory-match", difficulty: "easy", roundsCompleted: 2, bestScore: 90, lastPlayedAt: "2026-10-20T10:00:00Z" },
    { gameId: "memory-match", difficulty: "hard", roundsCompleted: 1, bestScore: 40, lastPlayedAt: "2026-10-22T10:00:00Z" },
    { gameId: "imagine-create", difficulty: "easy", roundsCompleted: 3, bestScore: null, lastPlayedAt: "2026-10-23T10:00:00Z" },
    { gameId: "maze-explorer", difficulty: "easy", roundsCompleted: 0, bestScore: null, lastPlayedAt: "2026-10-24T10:00:00Z" },
  ] as const;
  const sum = summarizeGameProgress(rows as any);
  ok("summary: totals per game, levels played, most recent first, games never finished left out",
    sum.length === 2 && sum[0].gameId === "imagine-create" && sum[1].rounds === 3 && sum[1].levels.join() === "easy,hard" &&
    sum[1].lastPlayedAt === "2026-10-22T10:00:00Z");
  ok("summary: stars only where the game has a score; best level counts", sum[0].bestStars === null && sum[1].bestStars === 3);
  ok("summary: no progress is an empty list", summarizeGameProgress([]).length === 0);
}

// ---------------------------------------------------------------------------
// Sound scripts
// ---------------------------------------------------------------------------
{
  const effects: N.Effect[] = ["tap", "flip", "match", "miss", "win", "hint", "step", "bump", "place", "undo", "cheer"];
  ok("sound: every effect is a short, quiet list of notes",
    effects.every((e) => { const s = N.effectScript(e); return s.length > 0 && N.scriptDuration(s) <= 1.2 && s.every((x) => x.gain > 0 && x.gain <= 1 && x.freq >= 150 && x.freq <= 1000); }));
  ok("sound: a miss is low and soft (never a buzzer)", N.effectScript("miss").every((n) => n.freq < 250 && n.gain <= 0.5));
  ok("sound: a pattern is heard one note per item", N.patternScript([0, 1, 0, 2]).length === 4 && N.patternScript([0, 1])[1].at > N.patternScript([0, 1])[0].at);
  ok("sound: equal pattern items play equal notes", (() => { const s = N.patternScript(P.noteIndexes(["a", "b", "a"])); return s[0].freq === s[2].freq && s[0].freq !== s[1].freq; })());
  ok("sound: each feeling family sounds different", N.feelingScript("happy")[0].freq !== N.feelingScript("sad")[0].freq);
  ok("sound: the scale wraps", N.scaleNote(0) === N.scaleNote(N.SCALE.length) && N.scaleNote(-1) === N.SCALE[N.SCALE.length - 1]);
}

// ---------------------------------------------------------------------------
// Mobile copy of the content stays identical
// ---------------------------------------------------------------------------
{
  const src = fileURLToPath(new URL("../../../packages/game-content/", import.meta.url));
  const dst = fileURLToPath(new URL("../../mobile/assets/games/", import.meta.url));
  let same = true;
  let count = 0;
  try {
    for (const f of readdirSync(src).filter((x) => x.endsWith(".json"))) {
      count++;
      if (readFileSync(src + f, "utf8") !== readFileSync(dst + f, "utf8")) { same = false; console.log("  differs: " + f); }
    }
  } catch { same = false; }
  ok(`mobile assets/games holds identical copies of the ${count} content files (run: node scripts/sync-game-content.mjs)`, same && count >= 7);
}
