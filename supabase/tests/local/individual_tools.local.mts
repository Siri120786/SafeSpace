// Local-only end-to-end test for an Individual's own routines, reminders and
// journal (role-flow step 7) against the LOCAL Supabase stack, through the
// real api-client: set up routines with icons, pause one, tick steps; a
// routine reminder with a heads-up; write and delete journal entries; and
// another Individual sees and changes none of it. Refuses any API URL that
// isn't localhost. Creates throwaway accounts; prints no credentials.
// Usage: pnpm test:local:individual-tools
import { execSync } from "node:child_process";
import {
  initSafeSpaceClient,
  signUpUser,
  logOut,
  logInUser,
  getExistingSession,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  addRoutineStep,
  listMyRoutineSetup,
  listMyRoutines,
  setRoutineStepCompleted,
  createReminder,
  listReminders,
  getDueReminders,
  createJournalEntry,
  listMyJournalEntries,
  deleteJournalEntry,
} from "../../../packages/api-client/src/index.ts";
import { todaySummary, recentDays } from "../../../apps/web/src/features/my-tools/toolsLogic.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};
const errCode = async (p: Promise<unknown>) => {
  try { await p; return "no_error"; } catch (e) { return (e as Error).message; }
};

const out = execSync("npx -y supabase@2 status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const st = JSON.parse(out.slice(out.indexOf("{")));
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(st.API_URL)) {
  console.error(`Refusing to run: API_URL is not local (${st.API_URL}).`);
  process.exit(1);
}
initSafeSpaceClient({ supabaseUrl: st.API_URL, supabaseAnonKey: st.ANON_KEY });

const mk = () => ({ email: `indiv-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, password: crypto.randomUUID() });
const me = mk();
const other = mk();
await signUpUser(other.email, other.password, "user");
await logOut();
await signUpUser(me.email, me.password, "user");
let session = (await getExistingSession())!;
const today = recentDays(new Date())[0].date;

// Routines.
const morning = await createRoutine({ kind: "self" }, {
  title: "Morning", steps: [{ label: "Stretch", scheduledTime: "00:00", icon: "exercise" }, { label: "Water", icon: "water" }],
});
const evening = await createRoutine({ kind: "self" }, { title: "Evening", steps: [{ label: "Read", icon: "reading" }] });
await addRoutineStep(morning.id, { label: "Breakfast", icon: "breakfast" });
await updateRoutine(evening.id, { isActive: false });
const setup = await listMyRoutineSetup(session);
ok("the setup list has both routines, the paused one included",
  setup.length === 2 && setup.some((r) => r.id === evening.id && !r.isActive));
ok("steps keep their icons and order", setup.find((r) => r.id === morning.id)!.steps.map((s) => s.icon).join(",") === "exercise,water,breakfast");
const day = await listMyRoutines(session, { date: today });
ok("a paused routine isn't on today's list", day.length === 1 && day[0].id === morning.id);
await setRoutineStepCompleted(session, day[0].steps[0].id, today, true);
const summary = todaySummary(await listMyRoutines(session, { date: today }), await getDueReminders(session), new Date());
ok("the dashboard summary moves on to the next step", summary.current?.label === "Water" && summary.stepsLeft === 2);

// Reminders.
await createReminder({ kind: "self" }, {
  kind: "routine", routineId: morning.id, title: "Morning routine", timeOfDay: "07:30", timezone: "Asia/Kolkata", leadMinutes: 15,
});
const rems = await listReminders(session);
ok("a routine reminder with a heads-up is saved", rems.length === 1 && rems[0].routineId === morning.id && rems[0].leadMinutes === 15);

// Journal.
const entry = await createJournalEntry(session, { content: "First entry" });
await createJournalEntry(session, { content: "Grateful for tea", entryType: "gratitude" });
await deleteJournalEntry(session, entry.id);
const left = await listMyJournalEntries(session, { limit: 30 });
ok("an Individual can delete their own entry", left.length === 1 && left[0].content === "Grateful for tea");

// Another Individual.
await logInUser(other.email, other.password);
const them = (await getExistingSession())!;
ok("another Individual sees none of these routines", (await listMyRoutineSetup(them)).length === 0);
ok("or reminders, or journal entries",
  (await listReminders(them)).length === 0 && (await listMyJournalEntries(them, { limit: 30 })).length === 0);
ok("and can't change or delete them",
  (await errCode(updateRoutine(morning.id, { title: "Hijacked" }))) === "not_found" &&
  (await errCode(deleteRoutine(morning.id))) === "not_found");
await logInUser(me.email, me.password);
session = (await getExistingSession())!;
ok("the routine is unchanged", (await listMyRoutineSetup(session)).find((r) => r.id === morning.id)?.title === "Morning");

ok("the setup list is for signed-in adults only",
  (await errCode(listMyRoutineSetup({ kind: "child", childSessionToken: "x", childId: "y" } as any))) === "unsupported_session");
await logOut();
