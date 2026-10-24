// Local-only end-to-end test for Games Corner (Sprint 4, steps 10b-10d)
// against the LOCAL Supabase stack, through the real api-client, RLS and the
// games Edge Function:
//   - an Individual's rounds, settings and creations;
//   - a child's through the games function, never reaching a sibling's;
//   - caregivers see a child's rounds under the sharing rule (under 15 always,
//     15+ only when sharing) and never a child's creations;
//   - a PIN reset ends the child's session for games too.
// Refuses any API URL that isn't localhost. Creates throwaway accounts;
// prints no credentials.
// Usage: pnpm test:local:games
import { execSync } from "node:child_process";
import {
  initSafeSpaceClient,
  getSafeSpaceClient,
  signUpUser,
  logOut,
  logInUser,
  addChild,
  getMyFamilyCode,
  verifyChildPin,
  setMySharing,
  resetChildPin,
  getExistingSession,
  getGameState,
  recordGameRound,
  saveGamePreferences,
  getChildGameSummary,
  listGameCreations,
  saveGameCreation,
  deleteGameCreation,
} from "../../../packages/api-client/src/index.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};
const fails = async (p: Promise<unknown>) => { try { await p; return "no_error"; } catch (e) { return (e as Error).message; } };
const born = (years: number) => ({ birthYear: new Date().getUTCFullYear() - years, birthMonth: new Date().getUTCMonth() + 1 });

const out = execSync("npx -y supabase@2 status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const st = JSON.parse(out.slice(out.indexOf("{")));
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(st.API_URL)) {
  console.error(`Refusing to run: API_URL is not local (${st.API_URL}).`);
  process.exit(1);
}
initSafeSpaceClient({ supabaseUrl: st.API_URL, supabaseAnonKey: st.ANON_KEY });
const mk = (p: string) => ({ email: `${p}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, password: crypto.randomUUID() });

const story = (id: string, ownText: string) => ({
  id, kind: "story" as const, content: { story: { starterId: "s1", nextKey: "ic.story.s1.n1", endKey: "ic.story.s1.e1", ownText } },
});

// ---------------------------------------------------------------------------
// An Individual
// ---------------------------------------------------------------------------
const indi = mk("games-indi");
await signUpUser(indi.email, indi.password, "user");
const me = await getExistingSession();
await recordGameRound(me, { gameId: "memory-match", difficulty: "easy", score: 70 });
await recordGameRound(me, { gameId: "memory-match", difficulty: "easy", score: 90 });
await saveGamePreferences(me, { difficulty: "medium", reducedMotion: true, soundEnabled: false, voiceEnabled: false });
const mine = await getGameState(me);
ok("an Individual's rounds and settings save to their account",
  mine.progress[0]?.roundsCompleted === 2 && mine.progress[0]?.bestScore === 90 && mine.preferences?.difficulty === "medium");
await saveGameCreation(me, story("story-100", "A dragon who loved tea."));
await saveGameCreation(me, story("story-100", "kept twice"));
const kept = await listGameCreations(me);
ok("an Individual keeps a creation (twice is fine)",
  kept.length === 1 && (kept[0].story as { ownText: string }).ownText === "A dragon who loved tea.");
ok("bad creations are refused", (await fails(saveGameCreation(me, story("story-101", "x".repeat(241))))) !== "no_error" &&
  (await fails(saveGameCreation(me, { ...story("Bad Id", "x") }))) === "invalid_input");
await deleteGameCreation(me, "story-100");
ok("and removes it", (await listGameCreations(me)).length === 0);
await logOut();

// ---------------------------------------------------------------------------
// A family: a caregiver, a 9-year-old and a 16-year-old who doesn't share
// ---------------------------------------------------------------------------
const carer = mk("games-carer");
await signUpUser(carer.email, carer.password, "caregiver");
const kidId = await addChild({ name: "Kid", ...born(9), pin: "4826", modules: [] });
const teenId = await addChild({ name: "Teen", ...born(16), pin: "5937", modules: [] });
const family = await getMyFamilyCode();
await logOut();

const kid = await verifyChildPin(family, "4826");
const teen = await verifyChildPin(family, "5937");
await setMySharing(teen, false);
for (const child of [kid, teen]) {
  await recordGameRound(child, { gameId: "maze-explorer", difficulty: "easy", score: 50 });
  await saveGameCreation(child, story("story-200", "My cat can fly."));
}
await saveGamePreferences(kid, { difficulty: "easy", reducedMotion: false, soundEnabled: true, voiceEnabled: true });
const kidState = await getGameState(kid);
ok("a child's rounds and settings save through the games function",
  kidState.progress[0]?.gameId === "maze-explorer" && kidState.preferences?.voiceEnabled === true);
ok("a child keeps and lists their creations", (await listGameCreations(kid)).map((c) => c.id).join() === "story-200");
await deleteGameCreation(teen, "story-200");
ok("a child removes only their own", (await listGameCreations(kid)).length === 1 && (await listGameCreations(teen)).length === 0);

await logInUser(carer.email, carer.password);
ok("a caregiver sees an under-15's rounds", (await getChildGameSummary(kidId)).length === 1);
ok("but not a 15+'s who doesn't share", (await getChildGameSummary(teenId)).length === 0);
const { data: seen } = await getSafeSpaceClient().from("game_creations").select("id");
ok("and never a child's creations", (seen ?? []).length === 0);
await resetChildPin(kidId, "1357");
await logOut();

ok("a PIN reset ends the child's session for games",
  (await fails(getGameState(kid))) === "invalid_session" && (await fails(listGameCreations(kid))) === "invalid_session");
