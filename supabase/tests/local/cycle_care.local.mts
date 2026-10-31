// Local-only end-to-end test for Cycle Care in the account (migration
// 20261029300000) against the LOCAL Supabase stack, through the real
// api-client and RLS: a person saves and reads back their parts, someone else
// (another adult, a caregiver) can't see them, and "delete" removes them.
// Refuses any API URL that isn't localhost. Creates throwaway accounts;
// prints no credentials.
// Usage: pnpm test:local:cycle-care
import { execSync } from "node:child_process";
import {
  initSafeSpaceClient,
  getSafeSpaceClient,
  signUpUser,
  logOut,
  getExistingSession,
  getCycleCareData,
  saveCycleCareParts,
  deleteCycleCareData,
} from "../../../packages/api-client/src/index.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};
const fails = async (p: Promise<unknown>) => { try { await p; return "no_error"; } catch (e) { return (e as Error).message; } };

const out = execSync("npx -y supabase@2 status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const st = JSON.parse(out.slice(out.indexOf("{")));
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(st.API_URL)) {
  console.error(`Refusing to run: API_URL is not local (${st.API_URL}).`);
  process.exit(1);
}
initSafeSpaceClient({ supabaseUrl: st.API_URL, supabaseAnonKey: st.ANON_KEY });
const mk = (p: string) => ({ email: `${p}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, password: crypto.randomUUID() });

const a = mk("cycle-a");
await signUpUser(a.email, a.password, "user");
const me = await getExistingSession();
const myId = me?.kind === "auth_user" ? me.profile.id : "";
const empty = await getCycleCareData(me);
ok("someone new has nothing saved", empty.condition === null && empty.diet === null);
await saveCycleCareParts(me, { condition: "pcod" });
await saveCycleCareParts(me, { diet: { plan: { breakfast: ["Oats"] } } });
await saveCycleCareParts(me, { exercise: { log: [{ date: "2026-10-24", type: "walk", minutes: 20 }] } });
await saveCycleCareParts(me, { tracker: { periods: [{ start: "2026-10-01", end: "2026-10-05" }], days: [], questions: ["Which tests do I need?"] } });
const mine = await getCycleCareData(me);
ok("parts save one at a time and the others stay",
  mine.condition === "pcod" && (mine.diet as { plan: { breakfast: string[] } }).plan.breakfast[0] === "Oats" && !!mine.exercise);
ok("the tracker saves and reads back",
  (mine.tracker as { questions: string[] }).questions[0] === "Which tests do I need?");
ok("bad parts are refused",
  (await fails(saveCycleCareParts(me, { condition: "other" }))) !== "no_error" &&
  (await fails(saveCycleCareParts(me, { diet: [1, 2] }))) !== "no_error");
await logOut();

const b = mk("cycle-b");
await signUpUser(b.email, b.password, "user");
const { data: seenByOther } = await getSafeSpaceClient().from("cycle_care_data").select("profile_id").eq("profile_id", myId);
ok("another adult can't see it", (seenByOther ?? []).length === 0);
await logOut();

const c = mk("cycle-carer");
await signUpUser(c.email, c.password, "caregiver");
const { data: seenByCarer } = await getSafeSpaceClient().from("cycle_care_data").select("profile_id");
ok("a caregiver can't see anyone's", (seenByCarer ?? []).length === 0);
await logOut();

await getSafeSpaceClient().auth.signInWithPassword(a);
const again = await getExistingSession();
ok("signing in again (any device) brings it back", (await getCycleCareData(again)).condition === "pcod");
await deleteCycleCareData(again);
ok("delete removes all of it", (await getCycleCareData(again)).condition === null);
await logOut();
