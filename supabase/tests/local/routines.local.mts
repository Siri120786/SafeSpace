// Local-only end-to-end test for Sprint 3 routines: drives the REAL
// @safespace/api-client functions against the LOCAL Supabase stack
// (`supabase start` + `supabase functions serve`), as an adult, a second
// adult, a caregiver, and children signed in by PIN. Refuses any API URL that
// isn't localhost. Creates throwaway accounts; prints no credentials.
// Usage: pnpm test:local:routines
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
  updateRoutine,
  deleteRoutine,
  addRoutineStep,
  updateRoutineStep,
  reorderRoutineSteps,
  deleteRoutineStep,
  listMyRoutines,
  listChildRoutines,
  setRoutineStepCompleted,
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

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const TODAY = localDate(0);
const todayDow = new Date().getDay();

const accounts: Record<string, { email: string; password: string }> = {};
async function becomeNew(key: string, role: "user" | "caregiver") {
  await logOut().catch(() => {});
  accounts[key] = { email: `routines-${key}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, password: crypto.randomUUID() };
  await signUpUser(accounts[key].email, accounts[key].password, role);
  return getExistingSession();
}
async function become(key: string) {
  await logOut().catch(() => {});
  await logInUser(accounts[key].email, accounts[key].password);
  return getExistingSession();
}

// ---------------------------------------------------------------------------
// Adult A: full lifecycle
// ---------------------------------------------------------------------------
const adultA = await becomeNew("adultA", "user");
const r = await createRoutine({ kind: "self" }, {
  title: "  Morning reset  ", moduleKey: "adhd", daysOfWeek: [],
  steps: [{ label: "Glass of water" }, { label: "Stretch", scheduledTime: "07:30" }],
});
ok("adult creates a routine with steps (trimmed title, ordered steps, HH:MM time)",
  r.title === "Morning reset" && r.profileId !== null && r.childId === null &&
  r.steps.map((s) => s.label).join("|") === "Glass of water|Stretch" && r.steps[1].scheduledTime === "07:30");

let list = await listMyRoutines(adultA, { date: TODAY });
ok("adult lists today's routines with progress", list.length === 1 && list[0].steps.every((s) => !s.completedOnDate));

await setRoutineStepCompleted(adultA, r.steps[0].id, TODAY, true);
await setRoutineStepCompleted(adultA, r.steps[0].id, TODAY, true);
list = await listMyRoutines(adultA, { date: TODAY });
const yesterday = await listMyRoutines(adultA, { date: localDate(-1) });
ok("completing is idempotent and per-day (done today, not yesterday)",
  list[0].steps[0].completedOnDate && !list[0].steps[1].completedOnDate && !yesterday[0].steps[0].completedOnDate);
ok("future-date completion is rejected by the client",
  (await errCode(setRoutineStepCompleted(adultA, r.steps[1].id, localDate(1), true))) === "invalid_input");
await setRoutineStepCompleted(adultA, r.steps[0].id, TODAY, false);
list = await listMyRoutines(adultA, { date: TODAY });
ok("un-completing works", !list[0].steps[0].completedOnDate);

const added = await addRoutineStep(r.id, { label: "Breakfast" });
await updateRoutineStep(r.steps[0].id, { label: "Big glass of water" });
await reorderRoutineSteps(r.id, [added.id, r.steps[0].id, r.steps[1].id]);
list = await listMyRoutines(adultA, { date: TODAY });
ok("add, rename and reorder steps",
  list[0].steps.map((s) => s.label).join("|") === "Breakfast|Big glass of water|Stretch" && added.orderIndex === 2);
await deleteRoutineStep(r.steps[1].id);
ok("delete a step", (await listMyRoutines(adultA, { date: TODAY }))[0].steps.length === 2);
ok("invalid input is rejected client-side (blank title, bad weekday, bad time)",
  (await errCode(createRoutine({ kind: "self" }, { title: "  ", steps: [] }))) === "invalid_input" &&
  (await errCode(createRoutine({ kind: "self" }, { title: "x", daysOfWeek: [7], steps: [] }))) === "invalid_input" &&
  (await errCode(createRoutine({ kind: "self" }, { title: "x", steps: [{ label: "a", scheduledTime: "7:30pm" }] }))) === "invalid_input");

const notToday = await createRoutine({ kind: "self" }, { title: "Not today", daysOfWeek: [(todayDow + 1) % 7], steps: [{ label: "x" }] });
ok("routines not scheduled today are left out of today's list",
  !(await listMyRoutines(adultA, { date: TODAY })).some((x) => x.id === notToday.id));
await updateRoutine(r.id, { isActive: false });
ok("paused (inactive) routines are left out", (await listMyRoutines(adultA, { date: TODAY })).length === 0);
await updateRoutine(r.id, { isActive: true, title: "Morning" });

// ---------------------------------------------------------------------------
// Adult B: isolation
// ---------------------------------------------------------------------------
const adultB = await becomeNew("adultB", "user");
ok("another adult sees none of A's routines", (await listMyRoutines(adultB, { date: TODAY })).length === 0);
ok("another adult can't edit, delete or extend A's routine (not_found)",
  (await errCode(updateRoutine(r.id, { title: "hacked" }))) === "not_found" &&
  (await errCode(deleteRoutine(r.id))) === "not_found" &&
  (await errCode(addRoutineStep(r.id, { label: "x" }))) === "not_found");
ok("another adult can't tick A's steps",
  (await errCode(setRoutineStepCompleted(adultB, added.id, TODAY, true))) === "not_found");

// ---------------------------------------------------------------------------
// Caregiver + child via PIN
// ---------------------------------------------------------------------------
await becomeNew("cg", "caregiver");
const childId = await addChild({ name: "Routine kid", ...born(8), pin: "4719", modules: ["autism"] });
const familyCode = await getMyFamilyCode();
const cr = await createRoutine({ kind: "child", childId }, {
  title: "After school", moduleKey: "autism", steps: [{ label: "Snack" }, { label: "Homework" }],
});
ok("caregiver creates a routine for their child", cr.childId === childId && cr.profileId === null && cr.steps.length === 2);

const child = await verifyChildPin(familyCode, "4719");
const childList = await listMyRoutines(child, { date: TODAY });
ok("child (PIN session) lists their routine through the Edge Function",
  childList.length === 1 && childList[0].title === "After school" && childList[0].steps[0].completedOnDate === false);
await setRoutineStepCompleted(child, cr.steps[0].id, TODAY, true);
ok("child ticks a step", (await listMyRoutines(child, { date: TODAY }))[0].steps[0].completedOnDate);

await become("cg");
const cgView = await listChildRoutines(childId, { date: TODAY });
ok("caregiver sees the child's progress", cgView.length === 1 && cgView[0].steps[0].completedOnDate && !cgView[0].steps[1].completedOnDate);
ok("caregiver can't see adult A's routines", (await listMyRoutines(await getExistingSession(), { date: TODAY })).length === 0);

ok("the child can't touch adult A's step (not_found)",
  (await errCode(setRoutineStepCompleted(child, added.id, TODAY, true))) === "not_found");

// Another family's child can't tick this child's step.
await becomeNew("cg2", "caregiver");
await addChild({ name: "Other kid", ...born(9), pin: "8350", modules: [] });
const otherChild = await verifyChildPin(await getMyFamilyCode(), "8350");
ok("another family's child sees nothing and can't tick this child's step",
  (await listMyRoutines(otherChild, { date: TODAY })).length === 0 &&
  (await errCode(setRoutineStepCompleted(otherChild, cr.steps[1].id, TODAY, true))) === "not_found");

// ---------------------------------------------------------------------------
// Anonymous access
// ---------------------------------------------------------------------------
await logOut().catch(() => {});
const anon = await getSafeSpaceClient().from("routines").select("id");
ok("anonymous REST read of routines is refused", !!anon.error && anon.error.code === "42501");

// ---------------------------------------------------------------------------
// Cleanup of A's routines (cascade)
// ---------------------------------------------------------------------------
await become("adultA");
await deleteRoutine(r.id);
await deleteRoutine(notToday.id);
ok("adult deletes their routines", (await listMyRoutines(await getExistingSession(), { date: TODAY })).length === 0);
await logOut().catch(() => {});
process.exit(process.exitCode ?? 0);
