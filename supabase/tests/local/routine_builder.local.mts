// Local-only end-to-end test for the caregiver routine and reminder builders
// (role-flow step 4c) against the LOCAL Supabase stack, through the real
// api-client and the routines Edge Function: step icons from caregiver to
// child, editing and reordering by a co-caregiver, paused routines in the
// setup list but not on the child's day, reminders with a heads-up.
// Refuses any API URL that isn't localhost. Creates throwaway accounts; prints
// no credentials.
// Usage: pnpm test:local:routine-builder
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
  updateRoutine,
  addRoutineStep,
  updateRoutineStep,
  reorderRoutineSteps,
  deleteRoutineStep,
  listChildRoutineSetup,
  listMyRoutines,
  createReminder,
  updateReminder,
  listChildReminders,
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
const today = (() => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

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
  accounts[key] = { email: `builder-${key}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, password: crypto.randomUUID() };
  await signUpUser(accounts[key].email, accounts[key].password, "caregiver");
}
async function become(key: string) {
  await logOut().catch(() => {});
  await logInUser(accounts[key].email, accounts[key].password);
}

await becomeNew("primary");
const kidId = await addChild({ name: "Kid", ...born(8), pin: "6408", modules: [] });
const family = await getMyFamilyCode();
const invite = await createCaregiverInvite(kidId);

const morning = await createRoutine({ kind: "child", childId: kidId }, {
  title: "Morning",
  steps: [
    { label: "Wake up", scheduledTime: "07:00", icon: "wake" },
    { label: "Brush teeth", icon: "brush_teeth" },
    { label: "Shoes on" },
  ],
});
ok("a routine is created with step icons", morning.steps[0].icon === "wake" && morning.steps[1].icon === "brush_teeth" && morning.steps[2].icon === null);
ok("an unknown icon is refused before it's sent",
  (await errCode(createRoutine({ kind: "child", childId: kidId }, { title: "x", steps: [{ label: "a", icon: "rocket" as any }] }))) === "invalid_input");
const bedtime = await createRoutine({ kind: "child", childId: kidId }, { title: "Bedtime", steps: [{ label: "Bath", icon: "bath" }] });
await updateRoutine(bedtime.id, { isActive: false });

// The co-caregiver edits.
await becomeNew("co");
await acceptCaregiverInvite(invite.code);
const step = await addRoutineStep(morning.id, { label: "Breakfast", scheduledTime: "07:30", icon: "breakfast" });
ok("a co-caregiver adds a step with an icon", step.icon === "breakfast");
const changed = await updateRoutineStep(morning.steps[2].id, { icon: "dress" });
ok("a co-caregiver sets an icon on an existing step", changed.icon === "dress" && changed.label === "Shoes on");
const cleared = await updateRoutineStep(morning.steps[1].id, { icon: null });
ok("an icon can be cleared", cleared.icon === null);
const setup = await listChildRoutineSetup(kidId);
const m = setup.find((r) => r.id === morning.id)!;
await reorderRoutineSteps(morning.id, [m.steps[1].id, m.steps[0].id, ...m.steps.slice(2).map((s) => s.id)]);
await deleteRoutineStep(m.steps[2].id);
const after = (await listChildRoutineSetup(kidId)).find((r) => r.id === morning.id)!;
ok("reorder and delete apply", after.steps.map((s) => s.label).join(",") === "Brush teeth,Wake up,Breakfast");
ok("the setup list includes paused routines", setup.some((r) => r.id === bedtime.id && !r.isActive));

// Reminders with a heads-up.
const rem = await createReminder({ kind: "child", childId: kidId }, {
  kind: "routine", routineId: morning.id, title: "Morning routine", timeOfDay: "07:00", timezone: "Asia/Kolkata", leadMinutes: 10,
});
await updateReminder(rem.id, { leadMinutes: 15, daysOfWeek: [1, 2, 3, 4, 5] });
const rems = await listChildReminders(kidId);
ok("a reminder keeps its routine, heads-up and days", rems.length === 1 && rems[0].routineId === morning.id &&
  rems[0].leadMinutes === 15 && rems[0].daysOfWeek.join() === "1,2,3,4,5");

// The child sees icons, and not the paused routine.
await logOut().catch(() => {});
const kid = await verifyChildPin(family, "6408");
const mine = await listMyRoutines(kid, { date: today });
const km = mine.find((r) => r.title === "Morning");
ok("the child's routines come with icons, in the new order",
  !!km && km.steps.map((s) => s.icon).join(",") === ",wake,breakfast");
ok("a paused routine isn't on the child's day", !mine.some((r) => r.title === "Bedtime"));

await become("primary");
await logOut().catch(() => {});
