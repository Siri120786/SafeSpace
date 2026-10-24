// Local-only end-to-end test for caregiver-made stories (role-flow 6b)
// against the LOCAL Supabase stack, through the real api-client and the
// stories and story-writer Edge Functions: save, edit, publish to one child,
// a co-caregiver sees it, the child plays it, take it back, delete; clients
// can't write the tables; the writer refuses unsuitable prompts. If
// STORIES_GEMINI_API_KEY isn't set for `functions serve`, the writer answers
// ai_unavailable, which is checked instead of a real draft.
// Refuses any API URL that isn't localhost. Creates throwaway accounts;
// prints no credentials.
// Usage: pnpm test:local:stories
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
  createCaregiverInvite,
  acceptCaregiverInvite,
  listStories,
  getStory,
  saveStory,
  publishStory,
  deleteStory,
  draftStoryWithAi,
  listMyStories,
} from "../../../packages/api-client/src/index.ts";
import { DENTIST_STORY } from "../../../apps/web/src/features/stories/library/dentist.ts";
import { validateStory, type Story } from "../../functions/_shared/storyScript.ts";

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

const mk = () => ({ email: `stories-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, password: crypto.randomUUID() });
const primary = mk();
const co = mk();
const stranger = mk();
await signUpUser(primary.email, primary.password, "caregiver");
const kidId = await addChild({ name: "Kid", ...born(7), pin: "5824", modules: [] });
const otherKidId = await addChild({ name: "Sib", ...born(9), pin: "7316", modules: [] });
const family = await getMyFamilyCode();
const invite = await createCaregiverInvite(kidId);
await logOut();
await signUpUser(co.email, co.password, "caregiver");
await acceptCaregiverInvite(invite.code);
await logOut();
await signUpUser(stranger.email, stranger.password, "caregiver");
await logOut();

await logInUser(primary.email, primary.password);
const storyId = await saveStory({ script: DENTIST_STORY, source: "template", templateKey: "dentist" });
ok("a caregiver saves a story", typeof storyId === "string");
const edited: Story = JSON.parse(JSON.stringify(DENTIST_STORY));
edited.title.en = "Kai's dentist day";
await saveStory({ storyId, script: edited, source: "template", templateKey: "dentist", teluguChecked: true });
let mine = await listStories();
ok("they edit it, and it's a draft (no children yet)",
  mine.length === 1 && mine[0].title === "Kai's dentist day" && mine[0].teluguChecked && mine[0].childIds.length === 0 && mine[0].mine);
const bad: Story = JSON.parse(JSON.stringify(DENTIST_STORY));
bad.scenes[0].cast[0].slot = "upstairs" as never;
ok("an invalid script is refused", (await fails(saveStory({ script: bad, source: "manual" }))) === "invalid_script");

const db = getSafeSpaceClient();
const ins = await db.from("stories").insert({ author_id: "00000000-0000-0000-0000-000000000000", title: "x", script: {}, source: "manual" });
const upd = await db.from("stories").update({ title: "hacked" }).eq("id", storyId).select();
const pub = await db.from("story_children").insert({ story_id: storyId, child_id: kidId });
ok("clients can't write stories or publish directly",
  !!ins.error && (!!upd.error || (upd.data ?? []).length === 0) && !!pub.error &&
  (await listStories())[0].title === "Kai's dentist day");

await publishStory(storyId, [kidId]);
ok("published to one child", (await listStories())[0].childIds.join() === kidId);
await logOut();

await logInUser(co.email, co.password);
mine = await listStories();
ok("the co-caregiver sees it (not theirs) and can open it",
  mine.length === 1 && !mine[0].mine && validateStory((await getStory<Story>(storyId)).script).length === 0);
ok("the co-caregiver can't publish, edit or delete it",
  (await fails(publishStory(storyId, []))) === "not_found" &&
  (await fails(saveStory({ storyId, script: DENTIST_STORY, source: "manual" }))) === "not_found" &&
  (await fails(deleteStory(storyId))) === "not_found");
await logOut();

await logInUser(stranger.email, stranger.password);
ok("a stranger sees nothing and can't publish to someone else's child",
  (await listStories()).length === 0 && (await fails(getStory(storyId))) === "not_found");
const strangerStory = await saveStory({ script: DENTIST_STORY, source: "manual" });
ok("…nor to a child they don't care for", (await fails(publishStory(strangerStory, [kidId]))) === "not_found");
ok("the stranger's prompt that trips the crisis screen is refused",
  (await fails(draftStoryWithAi("A story about wanting to kill myself"))) === "not_suitable");
const drafted = await fails(draftStoryWithAi<Story>("Kai is going to get a haircut at the barber for the first time."));
ok("the writer either drafts a valid story or says ai_unavailable (no key configured)",
  drafted === "no_error" || drafted === "ai_unavailable");
await logOut();

let kid = await verifyChildPin(family, "5824");
let kidStories = await listMyStories<Story>(kid);
ok("the child gets the published story with a playable script",
  kidStories.length === 1 && kidStories[0].id === storyId && validateStory(kidStories[0]).length === 0);
const sib = await verifyChildPin(family, "7316");
ok("their sibling doesn't", (await listMyStories(sib)).length === 0);

await logInUser(primary.email, primary.password);
await publishStory(storyId, []);
kidStories = await listMyStories<Story>(kid);
ok("taking it back removes it from the child", kidStories.length === 0);
await publishStory(storyId, [kidId, otherKidId]);
await deleteStory(storyId);
ok("deleting removes it everywhere",
  (await listStories()).length === 0 && (await listMyStories(kid)).length === 0 && (await listMyStories(sib)).length === 0);
await logOut();
