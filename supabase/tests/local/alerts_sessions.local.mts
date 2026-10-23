// Local-only end-to-end test for role-flow M3 against the LOCAL Supabase stack,
// through the real api-client and Edge Functions: the talk board's "I need
// help" reaching every caregiver (even when a 15+ child doesn't share),
// marking alerts reviewed, PIN reset signing the child out, and reminder
// heads-ups. Refuses any API URL that isn't localhost. Creates throwaway
// accounts; prints no credentials.
// Usage: pnpm test:local:alerts
import { execSync } from "node:child_process";
import {
  initSafeSpaceClient,
  signUpUser,
  logOut,
  logInUser,
  addChild,
  getMyFamilyCode,
  verifyChildPin,
  getMyChildSettings,
  setMySharing,
  raiseHelpAlert,
  listAlerts,
  markAlertReviewed,
  getChildOverview,
  resetChildPin,
  createCaregiverInvite,
  acceptCaregiverInvite,
  createReminder,
  getDueReminders,
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
  accounts[key] = { email: `alerts-${key}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, password: crypto.randomUUID() };
  await signUpUser(accounts[key].email, accounts[key].password, "caregiver");
}
async function become(key: string) {
  await logOut().catch(() => {});
  await logInUser(accounts[key].email, accounts[key].password);
}

await becomeNew("primary");
const kidId = await addChild({ name: "Kid", ...born(9), pin: "8461", modules: [] });
const teenId = await addChild({ name: "Teen", ...born(16), pin: "8462", modules: [] });
const family = await getMyFamilyCode();
const inviteKid = await createCaregiverInvite(kidId);
const inviteTeen = await createCaregiverInvite(teenId);
await becomeNew("co");
await acceptCaregiverInvite(inviteKid.code);
await acceptCaregiverInvite(inviteTeen.code);

// ---------------------------------------------------------------------------
// "I need help"
// ---------------------------------------------------------------------------
const kid = await verifyChildPin(family, "8461");
const teen = await verifyChildPin(family, "8462");
await setMySharing(teen, false);
const a1 = await raiseHelpAlert(kid);
const a2 = await raiseHelpAlert(kid);
ok("'I need help' raises one alert; a second tap returns the same one", !!a1 && a1 === a2);
const t1 = await raiseHelpAlert(teen);

await become("primary");
let alerts = await listAlerts();
ok("the primary sees both children's alerts, with names", alerts.length === 2 &&
  alerts.some((a) => a.id === a1 && a.childName === "Kid" && a.source === "aac_tap" && a.reviewedAt === null) &&
  alerts.some((a) => a.id === t1 && a.childName === "Teen"));
const teenOverview = await getChildOverview(teenId, 7);
ok("a teen who doesn't share still shows their alert on the caregiver's card",
  !teenOverview.activity.visible && teenOverview.unreviewedAlerts === 1);

await become("co");
ok("the co-caregiver sees the same alerts", (await listAlerts()).length === 2);
await markAlertReviewed(a1);
ok("the co-caregiver marks one reviewed", (await listAlerts({ unreviewedOnly: true })).map((a) => a.id).join() === t1);

await become("primary");
const reviewed = (await listAlerts()).find((a) => a.id === a1);
ok("the primary sees it reviewed, and by whom", !!reviewed?.reviewedAt && !!reviewed.reviewedBy && reviewed.reviewedBy !== null);
ok("the kid's card now shows no unreviewed alerts", (await getChildOverview(kidId, 7)).unreviewedAlerts === 0);

// ---------------------------------------------------------------------------
// Reminder heads-up
// ---------------------------------------------------------------------------
const soon = new Date(Date.now() + 10 * 60_000);
const hhmm = `${String(soon.getUTCHours()).padStart(2, "0")}:${String(soon.getUTCMinutes()).padStart(2, "0")}`;
const crossesMidnight = soon.getUTCDate() !== new Date().getUTCDate();
await createReminder({ kind: "child", childId: kidId }, { kind: "wellness", title: "Get ready", timeOfDay: hhmm, timezone: "UTC", leadMinutes: 15 });
const dueNow = (await getDueReminders(kid)).find((d) => d.reminder.title === "Get ready");
ok("a reminder 10 minutes away with a 15-minute heads-up is already due for the child",
  crossesMidnight || (!!dueNow && dueNow.reminder.leadMinutes === 15 && Date.parse(dueNow.occursAt) - Date.parse(dueNow.dueAt) === 15 * 60_000));

// ---------------------------------------------------------------------------
// PIN reset
// ---------------------------------------------------------------------------
ok("the child's session works before the reset", (await getMyChildSettings(kid)).ageYears === 9);
ok("the new PIN can't be a sibling's", (await errCode(resetChildPin(kidId, "8462"))) === "pin_already_used_in_family");
await resetChildPin(kidId, "8471");
ok("after the reset the child's old session is signed out", (await errCode(getMyChildSettings(kid))) === "invalid_session");
ok("the old PIN no longer works", (await errCode(verifyChildPin(family, "8461"))) !== "no_error");
const kidAgain = await verifyChildPin(family, "8471");
ok("the new PIN signs the child in", (await getMyChildSettings(kidAgain)).ageYears === 9);
ok("other children's sessions are unaffected", (await getMyChildSettings(teen)).sharing === "not_shared");

await become("co");
ok("a co-caregiver can't reset the PIN", (await errCode(resetChildPin(kidId, "8472"))) === "not_primary_caregiver");

await logOut().catch(() => {});
process.exit(process.exitCode ?? 0);
