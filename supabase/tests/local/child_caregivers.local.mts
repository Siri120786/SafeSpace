// Local-only end-to-end test for several caregivers per child (role-flow M1)
// against the LOCAL Supabase stack, through the real api-client: invite,
// join, shared access, family code, removal. Refuses any API URL that isn't
// localhost. Creates throwaway accounts; prints no credentials or codes.
// Usage: pnpm test:local:caregivers
import { execSync } from "node:child_process";
import {
  initSafeSpaceClient,
  signUpUser,
  logOut,
  logInUser,
  getExistingSession,
  addChild,
  listMyChildren,
  getChildOverview,
  getMyFamilyCode,
  createRoutine,
  listChildRoutines,
  listChildCaregivers,
  createCaregiverInvite,
  acceptCaregiverInvite,
  removeChildCaregiver,
  getChildFamilyCode,
} from "../../../packages/api-client/src/index.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};
// A birth month/year giving this age today (role flow: children have birth dates).
const born = (years: number) => ({ birthYear: new Date().getUTCFullYear() - years, birthMonth: new Date().getUTCMonth() + 1 });
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

const accounts: Record<string, { email: string; password: string }> = {};
async function becomeNew(key: string, role: "user" | "caregiver") {
  await logOut().catch(() => {});
  accounts[key] = { email: `cg-${key}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, password: crypto.randomUUID() };
  await signUpUser(accounts[key].email, accounts[key].password, role);
  const s = await getExistingSession();
  return s?.kind === "auth_user" ? s.profile.id : "";
}
async function become(key: string) {
  await logOut().catch(() => {});
  await logInUser(accounts[key].email, accounts[key].password);
}

const primaryId = await becomeNew("primary", "caregiver");
const kid = await addChild({ name: "Shared kid", ...born(9), pin: "5163", modules: ["adhd"] });
const familyCode = await getMyFamilyCode();
const invite = await createCaregiverInvite(kid);
ok("the primary creates an invite code", invite.code.length === 8 && invite.childId === kid);

const coId = await becomeNew("co", "caregiver");
ok("before joining, the co-caregiver can't see the child", (await errCode(getChildOverview(kid, 7))) === "not_found");
ok("joining returns the child", (await acceptCaregiverInvite(` ${invite.code.toLowerCase()} `)) === kid);
ok("the co-caregiver now lists the child and its overview",
  (await listMyChildren()).some((c) => c.id === kid) && (await getChildOverview(kid, 7)).child.id === kid);
ok("they see the family code the child signs in with", (await getChildFamilyCode(kid)) === familyCode);
const routine = await createRoutine({ kind: "child", childId: kid }, { title: "Homework", steps: [{ label: "Maths" }] });
ok("the co-caregiver sets up a routine for the child", !!routine.id);
const people = await listChildCaregivers(kid);
ok("both caregivers are listed, primary first",
  people.length === 2 && people[0].caregiverId === primaryId && people[0].role === "primary" && people[1].caregiverId === coId);
ok("a co-caregiver can't create invites", (await errCode(createCaregiverInvite(kid))) === "not_primary_caregiver");
ok("a used code can't be reused", (await errCode(acceptCaregiverInvite(invite.code))) === "invite_invalid");

await becomeNew("individual", "user");
ok("an Individual can't join as a caregiver", (await errCode(acceptCaregiverInvite("ABCDEFGH"))) !== "no_error");

await become("primary");
ok("the primary sees the co-caregiver's routine", (await listChildRoutines(kid, { date: new Date().toISOString().slice(0, 10) })).some((r) => r.id === routine.id));
await removeChildCaregiver(kid, coId);
ok("the primary removes the co-caregiver", (await listChildCaregivers(kid)).length === 1);

await become("co");
ok("the removed caregiver loses access at once",
  (await errCode(getChildOverview(kid, 7))) === "not_found" && !(await listMyChildren()).some((c) => c.id === kid));

await logOut().catch(() => {});
process.exit(process.exitCode ?? 0);
