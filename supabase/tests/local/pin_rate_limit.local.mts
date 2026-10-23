// Local-only end-to-end test for the child PIN rate limit (migration
// 20261026100000 and verify-child-pin/handler.ts) against the LOCAL Supabase
// stack and functions server: concurrent wrong guesses can't exceed 5
// failures per family in 15 minutes, the correct PIN is then refused too,
// other families are unaffected, and clients can't touch the attempt log.
// Refuses any API URL that isn't localhost. Creates throwaway accounts;
// prints no credentials.
// Usage: pnpm test:local:pin
import { execSync } from "node:child_process";
import {
  initSafeSpaceClient,
  getSafeSpaceClient,
  signUpUser,
  logOut,
  addChild,
  getMyFamilyCode,
  verifyChildPin,
} from "../../../packages/api-client/src/index.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};
// A birth month/year giving this age today (role flow: children have birth dates).
const born = (years: number) => ({ birthYear: new Date().getUTCFullYear() - years, birthMonth: new Date().getUTCMonth() + 1 });

const out = execSync("npx -y supabase@2 status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const st = JSON.parse(out.slice(out.indexOf("{")));
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(st.API_URL)) {
  console.error(`Refusing to run: API_URL is not local (${st.API_URL}).`);
  process.exit(1);
}
initSafeSpaceClient({ supabaseUrl: st.API_URL, supabaseAnonKey: st.ANON_KEY });

async function newFamily(pin: string) {
  await logOut().catch(() => {});
  await signUpUser(`pin-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, crypto.randomUUID(), "caregiver");
  await addChild({ name: "Pin kid", ...born(7), pin, modules: [] });
  return getMyFamilyCode();
}
const attempt = async (family_code: string, pin: string) => {
  const res = await fetch(`${st.API_URL}/functions/v1/verify-child-pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: st.ANON_KEY, Authorization: `Bearer ${st.ANON_KEY}` },
    body: JSON.stringify({ family_code, pin }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
};

const famA = await newFamily("2741");
const famB = await newFamily("2741");

ok("correct PIN signs a child in", (await verifyChildPin(famA, "2741")).kind === "child");

// 12 wrong guesses at once.
const burst = await Promise.all(Array.from({ length: 12 }, (_, i) => attempt(famA, String(1000 + i))));
const count = (s: number) => burst.filter((r) => r.status === s).length;
ok(`12 concurrent wrong guesses: exactly 5 checked (401), the rest refused (429) [401=${count(401)}, 429=${count(429)}]`,
  count(401) === 5 && count(429) === 7);
ok("no token in any of those responses", burst.every((r) => !("child_session_token" in r.body)));

const after = await attempt(famA, "2741");
ok("the correct PIN is now refused too (429)", after.status === 429 && !("child_session_token" in after.body));
ok("a different family is unaffected", (await attempt(famB, "2741")).status === 200);
ok("bad input is 400 and doesn't count", (await attempt(famB, "12")).status === 400 && (await attempt(famB, "2741")).status === 200);

// Clients can't read the attempt log or call the attempt functions.
await logOut().catch(() => {});
const anonRead = await getSafeSpaceClient().from("pin_attempts").select("id");
const anonRpc = await getSafeSpaceClient().rpc("pin_attempt_begin", { p_family_code: famB });
await newFamily("3852");
const userRead = await getSafeSpaceClient().from("pin_attempts").select("id");
const userRpc = await getSafeSpaceClient().rpc("pin_attempt_begin", { p_family_code: famB });
ok("anon and signed-in users can't read pin_attempts or call pin_attempt_begin",
  !!anonRead.error && !!anonRpc.error && !!userRead.error && !!userRpc.error);
await logOut().catch(() => {});
process.exit(process.exitCode ?? 0);
