// Local-only end-to-end test for the talk board's "I need help" (role-flow
// step 5c) against the LOCAL Supabase stack, through the real api-client and
// child-alerts Edge Function: the alert reaches the primary and a
// co-caregiver, even when a 16-year-old chose not to share (D10); a second
// tap within 2 minutes is the same alert; an ended session gets
// invalid_session, which the board turns into "find a grown-up near you".
// Refuses any API URL that isn't localhost. Creates throwaway accounts;
// prints no credentials.
// Usage: pnpm test:local:child-talk
import { execSync } from "node:child_process";
import {
  initSafeSpaceClient,
  signUpUser,
  logOut,
  logInUser,
  addChild,
  getMyFamilyCode,
  verifyChildPin,
  setMySharing,
  raiseHelpAlert,
  listAlerts,
  getChildDetail,
  resetChildPin,
  createCaregiverInvite,
  acceptCaregiverInvite,
} from "../../../packages/api-client/src/index.ts";
import { helpFailed, helpMessage } from "../../../apps/web/src/features/child-space/talkBoard.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};
const born = (years: number) => ({ birthYear: new Date().getUTCFullYear() - years, birthMonth: new Date().getUTCMonth() + 1 });

const out = execSync("npx -y supabase@2 status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const st = JSON.parse(out.slice(out.indexOf("{")));
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(st.API_URL)) {
  console.error(`Refusing to run: API_URL is not local (${st.API_URL}).`);
  process.exit(1);
}
initSafeSpaceClient({ supabaseUrl: st.API_URL, supabaseAnonKey: st.ANON_KEY });

const mk = () => ({ email: `talk-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, password: crypto.randomUUID() });
const primary = mk();
const co = mk();
await signUpUser(primary.email, primary.password, "caregiver");
const teenId = await addChild({ name: "Teen", ...born(16), pin: "9416", modules: [] });
const family = await getMyFamilyCode();
const invite = await createCaregiverInvite(teenId);
await logOut();
await signUpUser(co.email, co.password, "caregiver");
await acceptCaregiverInvite(invite.code);
await logOut();

// The teen chooses not to share, then presses "I need help" twice.
let teen = await verifyChildPin(family, "9416");
await setMySharing(teen, false);
const first = await raiseHelpAlert(teen);
const again = await raiseHelpAlert(teen);
ok("a second tap within 2 minutes is the same alert", first === again);

for (const [who, acct] of [["primary", primary], ["co-caregiver", co]] as const) {
  await logInUser(acct.email, acct.password);
  const alerts = await listAlerts({ unreviewedOnly: true });
  ok(`the ${who} sees exactly one unreviewed help alert`, alerts.length === 1 && alerts[0].id === first && alerts[0].source === "aac_tap");
  const d = await getChildDetail(teenId, 7);
  ok(`the ${who} sees it although the teen chose not to share`, !d.activity.visible && d.unreviewedAlerts === 1);
  await logOut();
}

// The session ends (PIN reset); pressing help now fails with invalid_session.
await logInUser(primary.email, primary.password);
await resetChildPin(teenId, "9417");
await logOut();
let failure: unknown = null;
try { await raiseHelpAlert(teen); } catch (e) { failure = e; }
ok("an ended session gets invalid_session", failure instanceof Error && failure.message === "invalid_session");
const msg = helpMessage(helpFailed(failure));
ok("and the board tells them to find a grown-up and sign in again", !!msg && /Find a grown-up near you now/.test(msg) && /sign in again/.test(msg));
teen = await verifyChildPin(family, "9417");
ok("after signing in again, help works (still the same alert within 2 minutes)", (await raiseHelpAlert(teen)) === first);
