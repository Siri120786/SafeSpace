// Local-only end-to-end test for the child's home (role-flow step 5a) against
// the LOCAL Supabase stack, through the real api-client and Edge Functions:
// today's routines with icons for Now / Next, ticking a step and the caregiver
// seeing it, a reminder in its heads-up, the 15+ sharing question, and the
// invalid_session code after a PIN reset (so the app can send them to the PIN
// page). Refuses any API URL that isn't localhost. Creates throwaway
// accounts; prints no credentials.
// Usage: pnpm test:local:child-home
import { execSync } from "node:child_process";
import {
  initSafeSpaceClient,
  signUpUser,
  logOut,
  logInUser,
  addChild,
  getMyFamilyCode,
  verifyChildPin,
  createRoutine,
  createReminder,
  listMyRoutines,
  setRoutineStepCompleted,
  getDueReminders,
  acknowledgeReminder,
  getMyChildProfile,
  getMyChildSettings,
  setMySharing,
  resetChildPin,
  getChildDetail,
} from "../../../packages/api-client/src/index.ts";
import { needsSharingQuestion, nowNext, localDate } from "../../../apps/web/src/features/child-space/childHome.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};
const errCode = async (p: Promise<unknown>) => {
  try { await p; return "no_error"; } catch (e) { return (e as Error).message; }
};
const born = (years: number) => ({ birthYear: new Date().getUTCFullYear() - years, birthMonth: new Date().getUTCMonth() + 1 });
const hhmmUtc = (d: Date) => `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;

const out = execSync("npx -y supabase@2 status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const st = JSON.parse(out.slice(out.indexOf("{")));
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(st.API_URL)) {
  console.error(`Refusing to run: API_URL is not local (${st.API_URL}).`);
  process.exit(1);
}
initSafeSpaceClient({ supabaseUrl: st.API_URL, supabaseAnonKey: st.ANON_KEY });

const email = `childhome-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
const password = crypto.randomUUID();
await signUpUser(email, password, "caregiver");
const kidId = await addChild({ name: "Kid", ...born(9), pin: "7409", modules: [] });
const teenId = await addChild({ name: "Teen", ...born(16), pin: "7416", modules: [] });
const family = await getMyFamilyCode();
await createRoutine({ kind: "child", childId: kidId }, {
  title: "Day",
  steps: [{ label: "Wake up", scheduledTime: "00:00", icon: "wake" }, { label: "Teeth", icon: "brush_teeth" }, { label: "Bed", scheduledTime: "23:59", icon: "bed" }],
});
// A reminder 5 minutes from now with a 10-minute heads-up: due now.
const soon = new Date(Date.now() + 5 * 60_000);
const sameDay = soon.getUTCDate() === new Date().getUTCDate();
const rem = await createReminder({ kind: "child", childId: kidId }, {
  kind: "water", title: "Water", timeOfDay: hhmmUtc(soon), timezone: "UTC", leadMinutes: 10,
});
await logOut();

// The child signs in and loads home.
let kid = await verifyChildPin(family, "7409");
const today = localDate(new Date());
const routines = await listMyRoutines(kid, { date: today });
const plan = nowNext(routines, new Date());
ok("today's steps come with icons for the cards", plan.steps.map((s) => s.icon).join(",") === "wake,brush_teeth,bed");
ok("Now is the first step whose time has come", plan.now?.label === "Wake up" && plan.next?.label === "Teeth");

await setRoutineStepCompleted(kid, plan.now!.stepId, today, true);
const after = nowNext(await listMyRoutines(kid, { date: today }), new Date());
ok("ticking Now moves on to the next step", after.now?.label === "Teeth");

if (sameDay) {
  const due = await getDueReminders(kid);
  const w = due.find((d) => d.reminder.id === rem.id);
  ok("a reminder in its heads-up is listed before its time", !!w && !w.acknowledged && new Date(w.occursAt) > new Date());
  await acknowledgeReminder(kid, rem.id, w!.occursOn);
  ok("Done marks it acknowledged", (await getDueReminders(kid)).find((d) => d.reminder.id === rem.id)?.acknowledged === true);
} else {
  console.log("SKIP heads-up checks (run crosses UTC midnight)");
}

const kidSettings = await getMyChildSettings(kid);
ok("a 9-year-old is never asked the sharing question", !needsSharingQuestion(kidSettings));

// The caregiver sees the tick.
await logInUser(email, password);
const detail = await getChildDetail(kidId, 7);
ok("the caregiver sees the ticked step", detail.routines[0].steps.find((s) => s.label === "Wake up")?.completedOnDate === true);

// A PIN reset ends the child's session with a code the app can act on.
await resetChildPin(kidId, "7410");
await logOut();
ok("after a PIN reset the old session gets invalid_session from the profile", (await errCode(getMyChildProfile(kid as any))) === "invalid_session");
ok("and from the routines function", (await errCode(listMyRoutines(kid, { date: today }))) === "invalid_session");
kid = await verifyChildPin(family, "7410");
ok("the new PIN signs them back in", (await getMyChildProfile(kid as any)).id === kidId);

// The 15+ question.
const teen = await verifyChildPin(family, "7416");
ok("a 16-year-old who hasn't answered is asked", needsSharingQuestion(await getMyChildSettings(teen)));
const answered = await setMySharing(teen, true);
ok("once they answer, they aren't asked again", !needsSharingQuestion(answered) && !needsSharingQuestion(await getMyChildSettings(teen)));
void teenId;
