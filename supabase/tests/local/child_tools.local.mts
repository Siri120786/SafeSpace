// Local-only end-to-end test for the child's tool pages (role-flow step 5b)
// against the LOCAL Supabase stack, through the real api-client and Edge
// Functions: journal (write, read back, gratitude, no delete for children),
// routines on an earlier day, and today's reminders list. Refuses any API URL
// that isn't localhost. Creates throwaway accounts; prints no credentials.
// Usage: pnpm test:local:child-tools
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
  createJournalEntry,
  listMyJournalEntries,
  deleteJournalEntry,
  listReminders,
  getDueReminders,
  listChildJournalEntries,
} from "../../../packages/api-client/src/index.ts";
import { laterToday, recentDays } from "../../../apps/web/src/features/my-tools/toolsLogic.ts";

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

const email = `childtools-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
const password = crypto.randomUUID();
await signUpUser(email, password, "caregiver");
const kidId = await addChild({ name: "Kid", ...born(10), pin: "8410", modules: ["anxiety"] });
const family = await getMyFamilyCode();
await createRoutine({ kind: "child", childId: kidId }, { title: "Daily", steps: [{ label: "Water plants", icon: "outdoor" }] });
await createReminder({ kind: "child", childId: kidId }, { kind: "custom", title: "Late one", timeOfDay: "23:59", timezone: "UTC" });
await logOut();

const kid = await verifyChildPin(family, "8410");

// Journal.
await createJournalEntry(kid, { content: "I drew a dragon" });
await createJournalEntry(kid, { content: "My dog", entryType: "gratitude" });
const mine = await listMyJournalEntries(kid, { limit: 30 });
ok("the child reads back their entries, newest first, with their kind",
  mine.length === 2 && mine[0].content === "My dog" && mine[0].entryType === "gratitude" && mine[1].entryType === "journal");
ok("children can't delete entries (adults only)", (await errCode(deleteJournalEntry(kid, mine[0].id))) === "unsupported_session");

// Routines on an earlier day.
const [today, yesterday] = recentDays(new Date());
const step = (await listMyRoutines(kid, { date: yesterday.date }))[0].steps[0];
await setRoutineStepCompleted(kid, step.id, yesterday.date, true);
ok("a step can be ticked for yesterday", (await listMyRoutines(kid, { date: yesterday.date }))[0].steps[0].completedOnDate === true);
ok("and today's tick is separate", (await listMyRoutines(kid, { date: today.date }))[0].steps[0].completedOnDate === false);
const longAgo = recentDays(new Date(), 9)[8].date;
ok("eight days back is refused", (await errCode(setRoutineStepCompleted(kid, step.id, longAgo, true))) === "invalid_input");

// Reminders.
const all = await listReminders(kid);
ok("the child lists their reminders", all.length === 1 && all[0].title === "Late one");
const now = new Date();
if (now.getUTCHours() < 23 || now.getUTCMinutes() < 59) {
  ok("a reminder later today shows under Later today", laterToday(all, await getDueReminders(kid), now).length === 1);
}

// The caregiver reads the journal (under 15).
await logInUser(email, password);
ok("the caregiver sees the child's journal", (await listChildJournalEntries(kidId)).length === 2);
await logOut();
