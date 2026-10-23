// Local-only end-to-end test for the caregiver child detail page (role-flow
// step 4b) against the LOCAL Supabase stack, through the real api-client:
// what a primary and a co-caregiver see for a child under 15, what is hidden
// when a 16-year-old chooses not to share, read-only AI chats, and that other
// caregivers get not_found. AI chat rows are seeded with the local service key
// (the ai-companion function would call Gemini). Refuses any API URL that
// isn't localhost. Creates throwaway accounts; prints no credentials.
// Usage: pnpm test:local:child-detail
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
  createMoodCheckin,
  createJournalEntry,
  createRoutine,
  createReminder,
  createCaregiverInvite,
  acceptCaregiverInvite,
  raiseHelpAlert,
  getChildDetail,
  listChildAiConversations,
  getChildAiMessages,
} from "../../../packages/api-client/src/index.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};
const errCode = async (p: Promise<unknown>) => {
  try { await p; return "no_error"; } catch (e) { return (e as Error).message; }
};
const born = (years: number) => ({ birthYear: new Date().getUTCFullYear() - years, birthMonth: new Date().getUTCMonth() + 1 });

const out = execSync("npx -y supabase@2 status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const st = JSON.parse(out.slice(out.indexOf("{")));
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(st.API_URL)) {
  console.error(`Refusing to run: API_URL is not local (${st.API_URL}).`);
  process.exit(1);
}
initSafeSpaceClient({ supabaseUrl: st.API_URL, supabaseAnonKey: st.ANON_KEY });

// Service-role insert, local only: an AI conversation with two messages.
async function seedAiChat(childId: string, title: string): Promise<string> {
  const headers = {
    "Content-Type": "application/json",
    apikey: st.SERVICE_ROLE_KEY,
    Authorization: `Bearer ${st.SERVICE_ROLE_KEY}`,
    Prefer: "return=representation",
  };
  const [conv] = await fetch(`${st.API_URL}/rest/v1/ai_companion_conversations`, {
    method: "POST", headers, body: JSON.stringify({ child_id: childId, title }),
  }).then((r) => r.json());
  await fetch(`${st.API_URL}/rest/v1/ai_companion_messages`, {
    method: "POST", headers,
    body: JSON.stringify([
      { conversation_id: conv.id, sender: "user", content: "I had a hard day at school", created_at: "2026-10-23T10:00:00Z" },
      { conversation_id: conv.id, sender: "assistant", content: "That sounds tough. Want to tell me more?", created_at: "2026-10-23T10:00:05Z" },
    ]),
  });
  return conv.id;
}

const accounts: Record<string, { email: string; password: string }> = {};
async function becomeNew(key: string) {
  await logOut().catch(() => {});
  accounts[key] = { email: `detail-${key}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, password: crypto.randomUUID() };
  await signUpUser(accounts[key].email, accounts[key].password, "caregiver");
}
async function become(key: string) {
  await logOut().catch(() => {});
  await logInUser(accounts[key].email, accounts[key].password);
}

// Setup: a primary with a 10-year-old and a 16-year-old; a co-caregiver for both.
await becomeNew("primary");
const kidId = await addChild({ name: "Kid", ...born(10), pin: "5410", modules: [] });
const teenId = await addChild({ name: "Teen", ...born(16), pin: "5416", modules: [] });
const family = await getMyFamilyCode();
await createRoutine({ kind: "child", childId: kidId }, { title: "Morning", steps: [{ label: "Brush teeth", scheduledTime: "07:30" }] });
await createReminder({ kind: "child", childId: teenId }, { kind: "water", title: "Water", timeOfDay: "09:00", timezone: "UTC" });
const kidInvite = await createCaregiverInvite(kidId);
const teenInvite = await createCaregiverInvite(teenId);
await becomeNew("co");
await acceptCaregiverInvite(kidInvite.code);
await acceptCaregiverInvite(teenInvite.code);
await becomeNew("stranger");

// The children record activity; Kid asks for help.
const kid = await verifyChildPin(family, "5410");
const teen = await verifyChildPin(family, "5416");
await createMoodCheckin(kid, { mood: "happy" });
await createJournalEntry(kid, { content: "Played football" });
await createMoodCheckin(teen, { mood: "sad" });
await createJournalEntry(teen, { content: "Teen diary" });
await raiseHelpAlert(kid);
const kidChat = await seedAiChat(kidId, "School");
const teenChat = await seedAiChat(teenId, "Friends");

// Under 15: the primary sees everything.
await become("primary");
const d = await getChildDetail(kidId, 7);
ok("under 15: activity visible to the primary", d.activity.visible && d.sharing === "under_15" && d.myRole === "primary");
ok("under 15: summary, moods, journal and AI chats are there",
  d.summary !== null && d.recentMoods?.length === 1 && d.recentJournal?.length === 1 &&
  d.aiConversations?.length === 1 && d.aiConversations[0].title === "School");
ok("routines set up by caregivers are listed", d.routines.length === 1 && d.routines[0].title === "Morning");
ok("the unreviewed alert is counted", d.unreviewedAlerts === 1);
const msgs = await getChildAiMessages(kidId, kidChat);
ok("AI messages come oldest first, with sender", msgs.length === 2 && msgs[0].sender === "user" && msgs[1].sender === "assistant");
ok("a conversation of another child is not_found under this child", (await errCode(getChildAiMessages(kidId, teenChat))) === "not_found");
const { error: insertError } = await getSafeSpaceClient().from("ai_companion_messages")
  .insert({ conversation_id: kidChat, sender: "user", content: "written by a caregiver" });
ok("caregivers can't write into a child's AI chat", insertError !== null);
const { data: delRows } = await getSafeSpaceClient().from("ai_companion_conversations").delete().eq("id", kidChat).select("id");
ok("caregivers can't delete a child's AI chat", (delRows ?? []).length === 0 && (await getChildAiMessages(kidId, kidChat)).length === 2);

// The co-caregiver sees the same.
await become("co");
const dc = await getChildDetail(kidId, 7);
ok("a co-caregiver sees the same activity, as co_caregiver",
  dc.myRole === "co_caregiver" && dc.recentMoods?.length === 1 && dc.aiConversations?.length === 1);

// 16 and chose not to share: activity hidden for every caregiver.
await setMySharing(teen, false);
for (const who of ["primary", "co"]) {
  await become(who);
  const t = await getChildDetail(teenId, 7);
  ok(`${who}: not_shared hides summary, moods, journal and AI chats`,
    !t.activity.visible && t.sharing === "not_shared" && t.summary === null &&
    t.recentMoods === null && t.recentJournal === null && t.aiConversations === null);
  ok(`${who}: not_shared still lists the reminders caregivers set up`, t.reminders.length === 1);
  ok(`${who}: RLS hides the AI chats too, even read directly`,
    (await listChildAiConversations(teenId)).length === 0 &&
    (await errCode(getChildAiMessages(teenId, teenChat))) === "not_found");
}

// Changing their mind makes it visible again.
await setMySharing(teen, true);
await become("primary");
const t2 = await getChildDetail(teenId, 7);
ok("choosing to share shows the activity again", t2.activity.visible && t2.aiConversations?.length === 1 && t2.recentMoods?.length === 1);

// Someone else's child.
await become("stranger");
ok("another caregiver gets not_found for the detail", (await errCode(getChildDetail(kidId, 7))) === "not_found");
ok("another caregiver gets not_found for the AI messages", (await errCode(getChildAiMessages(kidId, kidChat))) === "not_found");
ok("another caregiver lists no AI chats", (await listChildAiConversations(kidId)).length === 0);

await logOut().catch(() => {});
