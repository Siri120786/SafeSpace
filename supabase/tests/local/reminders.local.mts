// Local-only end-to-end test for Sprint 3 reminders (in-app) and the
// caregiver overview: drives the REAL @safespace/api-client against the LOCAL
// Supabase stack as adults, a caregiver and a child signed in by PIN.
// Refuses any API URL that isn't localhost. Creates throwaway accounts;
// prints no credentials.
// Note: the "23:59 isn't due yet" check assumes it isn't run during the
// last minute of the local day.
// Usage: pnpm test:local:reminders
import { execSync } from "node:child_process";
import {
  initSafeSpaceClient,
  getSafeSpaceClient,
  signUpUser,
  logInUser,
  logOut,
  getExistingSession,
  addChild,
  getMyFamilyCode,
  verifyChildPin,
  createRoutine,
  createMoodCheckin,
  createReminder,
  updateReminder,
  deleteReminder,
  listReminders,
  listChildReminders,
  getDueReminders,
  acknowledgeReminder,
  getChildOverview,
} from "../../../packages/api-client/src/index.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};
// A birth month/year giving this age today (role flow: children have birth dates).
const born = (years: number) => ({ birthYear: new Date().getUTCFullYear() - years, birthMonth: new Date().getUTCMonth() + 1 });
const errCode = async (p: Promise<unknown>) => {
  try {
    await p;
    return "no_error";
  } catch (e) {
    return (e as Error).message;
  }
};

const out = execSync("npx -y supabase@2 status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const st = JSON.parse(out.slice(out.indexOf("{")));
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(st.API_URL)) {
  console.error(`Refusing to run: API_URL is not local (${st.API_URL}).`);
  process.exit(1);
}
initSafeSpaceClient({ supabaseUrl: st.API_URL, supabaseAnonKey: st.ANON_KEY });

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const accounts: Record<string, { email: string; password: string }> = {};
async function becomeNew(key: string, role: "user" | "caregiver") {
  await logOut().catch(() => {});
  accounts[key] = { email: `reminders-${key}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, password: crypto.randomUUID() };
  await signUpUser(accounts[key].email, accounts[key].password, role);
  return getExistingSession();
}
async function become(key: string) {
  await logOut().catch(() => {});
  await logInUser(accounts[key].email, accounts[key].password);
  return getExistingSession();
}

// ---------------------------------------------------------------------------
// Adult
// ---------------------------------------------------------------------------
const a = await becomeNew("adult", "user");
const water = await createReminder({ kind: "self" }, { kind: "water", title: "Glass of water", timeOfDay: "00:00", timezone: TZ });
const later = await createReminder({ kind: "self" }, { kind: "wellness", title: "Evening stretch", timeOfDay: "23:59", timezone: TZ });
ok("adult creates reminders (owner derived from the session)", water.profileId !== null && water.childId === null && water.timeOfDay === "00:00");
let due = await getDueReminders(a);
ok("a 00:00 reminder is due now; a 23:59 one isn't yet",
  due.some((d) => d.reminder.id === water.id && !d.acknowledged) && !due.some((d) => d.reminder.id === later.id));
await acknowledgeReminder(a, water.id, due[0].occursOn);
await acknowledgeReminder(a, water.id, due[0].occursOn);
due = await getDueReminders(a);
ok("acknowledging marks today's occurrence (idempotent)", due.find((d) => d.reminder.id === water.id)?.acknowledged === true);
await updateReminder(water.id, { isEnabled: false });
ok("a disabled reminder is no longer due", !(await getDueReminders(a)).some((d) => d.reminder.id === water.id));
ok("invalid timezone, time and title rejected client-side",
  (await errCode(createReminder({ kind: "self" }, { kind: "water", title: "x", timeOfDay: "07:00", timezone: "Mars/Olympus" }))) === "invalid_input" &&
  (await errCode(createReminder({ kind: "self" }, { kind: "water", title: "x", timeOfDay: "7am", timezone: TZ }))) === "invalid_input" &&
  (await errCode(createReminder({ kind: "self" }, { kind: "water", title: "  ", timeOfDay: "07:00", timezone: TZ }))) === "invalid_input");
const routine = await createRoutine({ kind: "self" }, { title: "Morning", steps: [{ label: "Stretch" }] });
const rr = await createReminder({ kind: "self" }, { kind: "routine", title: "Morning routine", routineId: routine.id, timeOfDay: "07:00", timezone: TZ });
ok("routine reminder links the adult's own routine", rr.routineId === routine.id);
ok("routine kind requires a routine", (await errCode(createReminder({ kind: "self" }, { kind: "routine", title: "x", timeOfDay: "07:00", timezone: TZ }))) === "invalid_input");

await becomeNew("adultB", "user");
const b = await getExistingSession();
ok("another adult sees none of A's reminders and can't edit or delete them",
  (await listReminders(b)).length === 0 &&
  (await errCode(updateReminder(water.id, { title: "x" }))) === "not_found" &&
  (await errCode(deleteReminder(water.id))) === "not_found");
ok("another adult can't link A's routine to their reminder",
  (await errCode(createReminder({ kind: "self" }, { kind: "routine", title: "x", routineId: routine.id, timeOfDay: "07:00", timezone: TZ }))) === "invalid_input");

// ---------------------------------------------------------------------------
// Caregiver, child, overview
// ---------------------------------------------------------------------------
await becomeNew("cg", "caregiver");
const childId = await addChild({ name: "Reminder kid", ...born(8), pin: "3058", modules: ["autism"] });
const kidWater = await createReminder({ kind: "child", childId }, { kind: "water", title: "Water bottle", timeOfDay: "00:00", timezone: TZ });
await createReminder({ kind: "child", childId }, { kind: "wellness", title: "Breathing", timeOfDay: "00:01", timezone: TZ });
ok("caregiver creates reminders for their child", kidWater.childId === childId && (await listChildReminders(childId)).length === 2);

let overview = await getChildOverview(childId, 7);
ok("overview: child profile, summary and 2 due reminders",
  overview.child.id === childId && overview.child.name === "Reminder kid" && overview.child.assignedModules.includes("autism") &&
  overview.summary?.periodDays === 7 && overview.dueRemindersToday === 2);

const child = await verifyChildPin(await getMyFamilyCode(), "3058");
ok("child lists their reminders through the Edge Function", (await listReminders(child)).length === 2);
const childDue = await getDueReminders(child);
ok("child sees both as due", childDue.length === 2 && childDue.every((d) => !d.acknowledged));
await acknowledgeReminder(child, kidWater.id, childDue.find((d) => d.reminder.id === kidWater.id)!.occursOn);
await createMoodCheckin(child, { mood: "happy" });
ok("child can't acknowledge the adult's reminder (not_found)",
  (await errCode(acknowledgeReminder(child, rr.id, childDue[0].occursOn))) === "not_found");

await become("cg");
overview = await getChildOverview(childId, 7);
ok("after the child acknowledges one, the overview shows 1 due; the summary has the new check-in",
  overview.dueRemindersToday === 1 && overview.summary?.mood.checkins === 1);

await becomeNew("cg2", "caregiver");
ok("another caregiver can't get this child's overview (not_found)", (await errCode(getChildOverview(childId, 7))) === "not_found");
ok("another caregiver sees none of the child's reminders", (await listChildReminders(childId)).length === 0);

await logOut().catch(() => {});
const anon = await getSafeSpaceClient().from("reminders").select("id");
ok("anonymous REST read of reminders is refused", !!anon.error && anon.error.code === "42501");
process.exit(process.exitCode ?? 0);
