// Local-only end-to-end test for the Sprint 3 wellness summary: creates real
// mood check-ins, journal entries and routine progress through the REAL
// @safespace/api-client against the LOCAL Supabase stack, then checks the
// summaries an adult, a child (PIN) and a caregiver get. Refuses any API URL
// that isn't localhost. Creates throwaway accounts; prints no credentials.
// Usage: pnpm test:local:wellness
import { execSync } from "node:child_process";
import {
  initSafeSpaceClient,
  signUpUser,
  logInUser,
  logOut,
  getExistingSession,
  addChild,
  getMyFamilyCode,
  verifyChildPin,
  createMoodCheckin,
  createJournalEntry,
  createRoutine,
  setRoutineStepCompleted,
  getWellnessSummary,
  getChildWellnessSummary,
} from "../../../packages/api-client/src/index.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};
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
const d = new Date();
const TODAY = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const accounts: Record<string, { email: string; password: string }> = {};
async function becomeNew(key: string, role: "user" | "caregiver") {
  await logOut().catch(() => {});
  accounts[key] = { email: `wellness-${key}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, password: crypto.randomUUID() };
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
await createMoodCheckin(a, { mood: "stressed", intensity: 3 });
await createMoodCheckin(a, { mood: "happy" });
await createJournalEntry(a, { content: "Wrote down three good things" });
const routine = await createRoutine({ kind: "self" }, { title: "Evening", steps: [{ label: "Tidy desk" }, { label: "Read" }] });
await setRoutineStepCompleted(a, routine.steps[0].id, TODAY, true);

const s = await getWellnessSummary(a, 7);
ok("adult summary covers the last 7 local days ending today", s.periodDays === 7 && s.to === TODAY);
ok("adult summary counts mood check-ins by value, on one day",
  s.mood.checkins === 2 && s.mood.daysWithCheckin === 1 && s.mood.counts.stressed === 1 && s.mood.counts.happy === 1 &&
  s.mood.counts.sad === 0 && s.mood.latest?.mood === "happy");
ok("adult summary counts routine steps (2 scheduled today, 1 done) and journal entries (1)",
  s.routines.scheduledSteps === 2 && s.routines.completedSteps === 1 && s.journal.entries === 1);
ok("summary contains no journal text or labels",
  !JSON.stringify(s).includes("good things") && !/score|risk|depress|anxiety/i.test(JSON.stringify(s)));
ok("only 7 or 30 days accepted", (await errCode(getWellnessSummary(a, 14 as any))) === "invalid_input");

// ---------------------------------------------------------------------------
// Caregiver and a partial-tier child (age 10)
// ---------------------------------------------------------------------------
await becomeNew("cg", "caregiver");
const childId = await addChild({ name: "Summary kid", age: 10, pin: "6194", modules: [] });
const child = await verifyChildPin(await getMyFamilyCode(), "6194");
await createMoodCheckin(child, { mood: "happy" });
await createMoodCheckin(child, { mood: "overwhelmed", note: "private feelings", isPrivateNote: true });
await createJournalEntry(child, { content: "Shared entry" });
await createJournalEntry(child, { content: "Private entry", isPrivateNote: true });

const childOwn = await getWellnessSummary(child, 7);
ok("child's own summary (Edge Function) includes their private notes",
  childOwn.mood.checkins === 2 && childOwn.mood.counts.overwhelmed === 1 && childOwn.journal.entries === 2);

await become("cg");
const cgView = await getChildWellnessSummary(childId, 7);
ok("caregiver's summary of the child leaves out the private mood note and private journal entry",
  cgView.mood.checkins === 1 && cgView.mood.counts.overwhelmed === 0 && cgView.journal.entries === 1);
ok("caregiver's 30-day view works too", (await getChildWellnessSummary(childId, 30)).periodDays === 30);

// ---------------------------------------------------------------------------
// Isolation
// ---------------------------------------------------------------------------
await becomeNew("other", "user");
const otherOwn = await getWellnessSummary(await getExistingSession(), 7);
const otherOnChild = await getChildWellnessSummary(childId, 7);
ok("another adult's own summary is empty, and asking about someone else's child gives zeros",
  otherOwn.mood.checkins === 0 && otherOwn.journal.entries === 0 &&
  otherOnChild.mood.checkins === 0 && otherOnChild.journal.entries === 0 && otherOnChild.mood.latest === null);

await logOut().catch(() => {});
process.exit(process.exitCode ?? 0);
