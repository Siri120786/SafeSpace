// Local-only end-to-end test for the age-15 sharing rule (role-flow M2)
// against the LOCAL Supabase stack, through the real api-client and Edge
// Functions: a 16-year-old's settings, choosing not to share, what caregivers
// then see, changing their mind, the under-15 refusal, and editing a child.
// Refuses any API URL that isn't localhost. Creates throwaway accounts; prints
// no credentials.
// Usage: pnpm test:local:sharing
import { execSync } from "node:child_process";
import {
  initSafeSpaceClient,
  signUpUser,
  logOut,
  logInUser,
  addChild,
  listMyChildren,
  getChildOverview,
  getMyFamilyCode,
  verifyChildPin,
  getMyChildProfile,
  getMyChildSettings,
  setMySharing,
  createMoodCheckin,
  createJournalEntry,
  listChildMoodCheckins,
  listChildJournalEntries,
  createReminder,
  listChildReminders,
  updateChild,
  setChildModules,
  createCaregiverInvite,
  acceptCaregiverInvite,
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

const accounts: Record<string, { email: string; password: string }> = {};
async function becomeNew(key: string) {
  await logOut().catch(() => {});
  accounts[key] = { email: `share-${key}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, password: crypto.randomUUID() };
  await signUpUser(accounts[key].email, accounts[key].password, "caregiver");
}
async function become(key: string) {
  await logOut().catch(() => {});
  await logInUser(accounts[key].email, accounts[key].password);
}

await becomeNew("primary");
const teenId = await addChild({ name: "Teen", ...born(16), pin: "7316", modules: ["anxiety"] });
const kidId = await addChild({ name: "Kid", ...born(10), pin: "7317", modules: [] });
const family = await getMyFamilyCode();
const invite = await createCaregiverInvite(teenId);
await createReminder({ kind: "child", childId: teenId }, { kind: "water", title: "Water", timeOfDay: "08:00", timezone: "UTC" });
await becomeNew("co");
await acceptCaregiverInvite(invite.code);

// The young people sign in.
const teen = await verifyChildPin(family, "7316");
const kid = await verifyChildPin(family, "7317");
const profile = await getMyChildProfile(teen as any);
ok("the teen's profile has their age and sharing status", profile.ageYears === 16 && profile.sharing === "not_asked");
const s0 = await getMyChildSettings(teen);
ok("a 16-year-old who hasn't chosen yet: not_asked, and they can change it", s0.sharing === "not_asked" && s0.canChangeSharing);
ok("a 10-year-old can't set the choice", (await errCode(setMySharing(kid, false))) === "sharing_not_available_under_15" &&
  (await getMyChildSettings(kid)).sharing === "under_15");
await createMoodCheckin(teen, { mood: "sad" });
await createJournalEntry(teen, { content: "Rough day" });

await become("primary");
let overview = await getChildOverview(teenId, 7);
ok("not asked yet counts as shared: the caregiver sees the teen's week",
  overview.activity.visible && overview.summary?.mood.checkins === 1 && overview.summary?.journal.entries === 1);

const s1 = await setMySharing(teen, false);
ok("the teen chooses not to share", s1.sharing === "not_shared" && !!s1.sharingDecidedAt);

overview = await getChildOverview(teenId, 7);
ok("the caregiver's card now says activity is hidden, with no counts",
  !overview.activity.visible && overview.activity.reason === "not_shared" && overview.summary === null && overview.dueRemindersToday === null);
ok("their moods and journal are hidden from the primary",
  (await listChildMoodCheckins(teenId)).length === 0 && (await listChildJournalEntries(teenId)).length === 0);
ok("the child, the choice and the reminders the caregiver set up stay visible",
  (await listMyChildren()).find((c) => c.id === teenId)?.sharing === "not_shared" &&
  (await listChildReminders(teenId)).length === 1);

await become("co");
ok("the co-caregiver sees the same: no activity",
  (await listChildMoodCheckins(teenId)).length === 0 && !(await getChildOverview(teenId, 7)).activity.visible);
ok("a co-caregiver can't rename the teen or change the birth date",
  (await errCode(updateChild(teenId, { name: "x" }))) === "not_primary_caregiver");
await updateChild(teenId, { theme: "space", lowSensoryDefault: true });
await setChildModules(teenId, ["anxiety", "adhd"]);
const asCo = (await listMyChildren()).find((c) => c.id === teenId);
ok("a co-caregiver sets the theme, low-sensory default and modules",
  asCo?.theme === "space" && asCo.lowSensoryDefault && [...asCo.assignedModules].sort().join() === "adhd,anxiety" && asCo.myRole === "co_caregiver");

const s2 = await setMySharing(teen, true);
ok("the teen changes their mind: shared again, and caregivers see their week again",
  s2.sharing === "shared" && (await listChildMoodCheckins(teenId)).length === 1);

await become("primary");
await updateChild(kidId, { name: "Kid Renamed", ...born(11) });
const k = (await listMyChildren()).find((c) => c.id === kidId);
ok("the primary renames a child and corrects the birth date", k?.name === "Kid Renamed" && k.ageYears === 11 && k.myRole === "primary");
ok("a birth date outside ages 4 to 17 is refused", (await errCode(updateChild(kidId, born(19)))) === "invalid_input");

await logOut().catch(() => {});
process.exit(process.exitCode ?? 0);
