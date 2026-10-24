// Local-only end-to-end test for the ADHD and autism tools' data (role-flow
// 8e) against the LOCAL Supabase stack, through the real api-client, RLS and
// the focus-tools and child-alerts Edge Functions:
//   - an Individual saves sessions, tasks, habits, stars, feelings and
//     settings, and can clear their feelings and focus history;
//   - a child does the same through focus-tools, can't delete feelings, and
//     only ever reaches their own rows;
//   - caregivers read a child's activity under the sharing rule (a 15+ child
//     who doesn't share: nothing) and set a child's star goal;
//   - "I want a grown-up" raises a feelings-cards alert caregivers see;
//   - a PIN reset ends the child's session for the tools too.
// Refuses any API URL that isn't localhost. Creates throwaway accounts;
// prints no credentials.
// Usage: pnpm test:local:focus-tools
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
  createCaregiverInvite,
  acceptCaregiverInvite,
  raiseHelpAlert,
  listAlerts,
  addFocusSession,
  listFocusSessions,
  clearMyFocusSessions,
  createFocusTask,
  updateFocusTask,
  listFocusTasks,
  addHabit,
  listHabits,
  setHabitCheck,
  archiveHabit,
  awardStars,
  getStars,
  claimStarGoal,
  setMyStarGoal,
  addEmotionChoice,
  listEmotionChoices,
  clearMyEmotionChoices,
  getToolSettings,
  saveMyToolSettings,
  getChildToolsOverview,
  getChildToolSetup,
  setChildStarGoal,
  setChildToolSettings,
} from "../../../packages/api-client/src/index.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};
const fails = async (p: Promise<unknown>) => { try { await p; return "no_error"; } catch (e) { return (e as Error).message; } };
const born = (years: number) => ({ birthYear: new Date().getUTCFullYear() - years, birthMonth: new Date().getUTCMonth() + 1 });
const today = new Date().toISOString().slice(0, 10);

const out = execSync("npx -y supabase@2 status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const st = JSON.parse(out.slice(out.indexOf("{")));
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(st.API_URL)) {
  console.error(`Refusing to run: API_URL is not local (${st.API_URL}).`);
  process.exit(1);
}
initSafeSpaceClient({ supabaseUrl: st.API_URL, supabaseAnonKey: st.ANON_KEY });

const mk = (p: string) => ({ email: `${p}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, password: crypto.randomUUID() });

// ---------------------------------------------------------------------------
// An Individual
// ---------------------------------------------------------------------------
const indi = mk("tools-indi");
await signUpUser(indi.email, indi.password, "user");
let me = await getExistingSession();
await addFocusSession(me, { durationSeconds: 900, mode: "simple", activityLabel: "Reading" });
const task = await createFocusTask(me, "Tidy desk", [{ id: "s1", label: "Clear papers", isComplete: false, orderIndex: 0 }]);
await updateFocusTask(me, { ...task, steps: [{ ...task.steps[0], isComplete: true }] });
const h = await addHabit(me, "Drink water", "💧");
await setHabitCheck(me, h.id, today, true);
await setHabitCheck(me, h.id, today, true);
const a1 = await awardStars(me, `task_step:s1:${today}`);
const a2 = await awardStars(me, `task_step:s1:${today}`);
await setMyStarGoal(me, { title: "Movie night", targetStars: 1, icon: "🎬" });
await addEmotionChoice(me, "calm");
await saveMyToolSettings(me, { transitionPreset: { activity: "Lunch", totalSeconds: 300 } });
const habits = await listHabits(me);
ok("an Individual's tools save to their account",
  (await listFocusSessions(me)).length === 1 && (await listFocusTasks(me))[0].steps[0].isComplete &&
  habits.checks.length === 1 && (await listEmotionChoices(me))[0].cardId === "calm" &&
  (await getToolSettings(me)).transitionPreset?.activity === "Lunch");
ok("stars: each event once; the goal can be claimed", a1.awarded && !a2.awarded && (await getStars(me)).goal?.targetStars === 1 &&
  (await claimStarGoal(me)).claimed && (await getStars(me)).currentStars === 0);
await clearMyEmotionChoices(me);
await clearMyFocusSessions(me);
ok("an Individual can clear their feelings and focus history", (await listEmotionChoices(me)).length === 0 && (await listFocusSessions(me)).length === 0);
await logOut();

// ---------------------------------------------------------------------------
// A family: primary, co-caregiver, a 9-year-old and a 16-year-old
// ---------------------------------------------------------------------------
const primary = mk("tools-primary");
const co = mk("tools-co");
await signUpUser(primary.email, primary.password, "caregiver");
const kidId = await addChild({ name: "Kid", ...born(9), pin: "4826", modules: ["adhd"] });
const teenId = await addChild({ name: "Teen", ...born(16), pin: "5937", modules: ["autism"] });
const family = await getMyFamilyCode();
const invite = await createCaregiverInvite(kidId);
await logOut();
await signUpUser(co.email, co.password, "caregiver");
await acceptCaregiverInvite(invite.code);
await logOut();

let kid = await verifyChildPin(family, "4826");
const teen = await verifyChildPin(family, "5937");
await setMySharing(teen, false);
for (const child of [kid, teen]) {
  await addFocusSession(child, { durationSeconds: 1500, mode: "pomodoro", phase: "focus" });
  await createFocusTask(child, "Pack bag", [{ id: "s1", label: "Books", isComplete: false, orderIndex: 0 }]);
  const ch = await addHabit(child, "Brush teeth", "🪥");
  await setHabitCheck(child, ch.id, today, true);
  await awardStars(child, `habit_day:${ch.id}:${today}`);
  await addEmotionChoice(child, "overwhelmed");
}
ok("a child's tools save through focus-tools",
  (await listFocusSessions(kid)).length === 1 && (await listFocusTasks(kid)).length === 1 &&
  (await listHabits(kid)).checks.length === 1 && (await getStars(kid)).currentStars === 1 &&
  (await listEmotionChoices(kid))[0].cardId === "overwhelmed");
ok("a child can't clear feelings or focus history, or set their own goal",
  (await fails(clearMyEmotionChoices(kid))) === "unsupported_session" &&
  (await fails(clearMyFocusSessions(kid))) === "unsupported_session" &&
  (await fails(setMyStarGoal(kid, { title: "x", targetStars: 1, icon: null }))) === "unsupported_session");
const kidHabit = (await listHabits(kid)).habits[0];
ok("a child can't reach their sibling's rows", (await fails(setHabitCheck(teen, kidHabit.id, today, false))) === "not_found" &&
  (await fails(archiveHabit(teen, kidHabit.id))) === "not_found");
ok("bad input is refused clearly", (await fails(addEmotionChoice(kid, "furious"))) === "invalid_input" &&
  (await fails(addFocusSession(kid, { durationSeconds: 0, mode: "simple" }))) === "invalid_input");

// "I want a grown-up"
const alertId = await raiseHelpAlert(kid, "feelings_cards");

// ---------------------------------------------------------------------------
// Caregivers
// ---------------------------------------------------------------------------
const db = () => getSafeSpaceClient();
const visible = async (childId: string) => {
  let n = 0;
  for (const t of ["focus_sessions", "focus_tasks", "habits", "star_events", "emotion_choices"]) {
    const { data } = await db().from(t).select("id").eq("child_id", childId);
    n += (data ?? []).length;
  }
  return n;
};
for (const [who, acct] of [["primary", primary], ["co-caregiver", co]] as const) {
  await logInUser(acct.email, acct.password);
  ok(`the ${who} sees the 9-year-old's tool activity`, (await visible(kidId)) === 5);
  const alerts = await listAlerts({ unreviewedOnly: true });
  ok(`the ${who} sees the feelings-cards alert`, alerts.some((a) => a.id === alertId && a.source === "feelings_card"));
  await logOut();
}
await logInUser(primary.email, primary.password);
ok("the 16-year-old chose not to share: the caregiver sees none of it", (await visible(teenId)) === 0);
const { error: goalError } = await db().from("star_goals").insert({ child_id: kidId, title: "Park trip", target_stars: 1, icon: "🛝" });
ok("a caregiver sets the child's star goal", !goalError);
const { error: writeError } = await db().from("emotion_choices").insert({ child_id: kidId, card_id: "happy" });
ok("…but can't write the child's activity", !!writeError);
await resetChildPin(kidId, "1357");
await logOut();

ok("a goal set for one child isn't another's", (await getStars(teen)).goal === null);
ok("a PIN reset ends the child's session for the tools too", (await fails(listFocusSessions(kid))) === "invalid_session");
kid = await verifyChildPin(family, "1357");
ok("after signing in again: goal set by the caregiver, claimable", (await getStars(kid)).goal?.title === "Park trip" && (await claimStarGoal(kid)).claimed);

// ---------------------------------------------------------------------------
// The caregiver's view and setup (role-flow 8f)
// ---------------------------------------------------------------------------
await logInUser(co.email, co.password);
const view = await getChildToolsOverview(kidId);
ok("a co-caregiver sees the 9-year-old's tools at a glance",
  view.sessions.length === 1 && view.tasks.length === 1 && view.habits.length === 1 && view.checks.length === 1 &&
  view.feelings[0]?.cardId === "overwhelmed" && view.stars.goal?.title === "Park trip");
await setChildStarGoal(kidId, { title: "Ice cream", targetStars: 3, icon: "🍦" });
await setChildToolSettings(kidId, { transitionPreset: { activity: "Bath time", totalSeconds: 120 } });
await setChildToolSettings(kidId, { aacLabels: { play: "Lego" } });
const setup = await getChildToolSetup(kidId);
ok("any caregiver sets the goal, countdown and words (each save keeps the others)",
  setup.goal?.title === "Ice cream" && setup.settings.transitionPreset?.activity === "Bath time" && setup.settings.aacLabels.play === "Lego");
ok("bad setup is refused", (await fails(setChildToolSettings(kidId, { transitionPreset: { activity: "x", totalSeconds: 5 } }))) === "invalid_input");
await logOut();
await logInUser(primary.email, primary.password);
const teenView = await getChildToolsOverview(teenId);
ok("a 15+ child who doesn't share: the overview is empty", teenView.sessions.length + teenView.tasks.length + teenView.feelings.length === 0);
ok("…but the teen's setup is still the caregiver's to set", (await fails(setChildStarGoal(teenId, { title: "Cinema", targetStars: 5, icon: null }))) === "no_error");
await logOut();
const kidSettings = await getToolSettings(kid);
ok("the child gets the caregiver's countdown and words", kidSettings.transitionPreset?.totalSeconds === 120 && kidSettings.aacLabels.play === "Lego");
ok("…and the new goal", (await getStars(kid)).goal?.title === "Ice cream");

