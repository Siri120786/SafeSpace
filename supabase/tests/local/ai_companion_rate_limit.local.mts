// Local-only integration test for the AI Companion rate limit (Step 3).
// Runs against the LOCAL Supabase stack (`supabase start` + `supabase functions
// serve`), never a hosted project: it refuses any API URL that isn't localhost.
// Creates throwaway test accounts; prints no keys or credentials.
//
// Requires GEMINI_API_KEY to be UNSET for the functions server, so every
// non-crisis message is a "model failure" (503 ai_unavailable). That is what
// lets this test prove failed model attempts still consume rate-limit slots.
//
// Usage: pnpm test:local:ai-companion
import { execSync } from "node:child_process";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const status = JSON.parse(
  (() => {
    const out = execSync("npx -y supabase@2 status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.slice(out.indexOf("{"));
  })(),
);
const API: string = status.API_URL;
const ANON: string = status.ANON_KEY;
const SERVICE: string = status.SERVICE_ROLE_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(API)) {
  console.error(`Refusing to run: API_URL is not local (${API}).`);
  process.exit(1);
}

const LIMIT = 10;
const CRISIS = "I want to hurt myself";
const NORMAL = "I feel a bit stressed today";

async function signup(role: "user" | "caregiver") {
  const res = await fetch(`${API}/auth/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({
      email: `ratelimit-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
      password: crypto.randomUUID(),
      data: { role, display_name: "Rate limit test" },
    }),
  }).then((r) => r.json());
  if (!res.access_token) throw new Error("local signup failed (is email confirmation off?)");
  return { token: res.access_token as string, id: res.user.id as string };
}

async function chat(auth: { token?: string; child?: string }, content: string) {
  const body: Record<string, unknown> = { action: "send_message", content, language: "en" };
  if (auth.child) body.child_session_token = auth.child;
  const res = await fetch(`${API}/functions/v1/ai-companion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, error: json.error as string | undefined };
}

const rpc = (key: string, args: Record<string, unknown>) =>
  fetch(`${API}/rest/v1/rpc/ai_companion_take_slot`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${key}` },
    body: JSON.stringify(args),
  });

const tally = (codes: number[]) =>
  codes.reduce<Record<number, number>>((acc, c) => ((acc[c] = (acc[c] ?? 0) + 1), acc), {});

// ---- precondition: model must be unavailable locally ----
const probeUser = await signup("user");
const probe = await chat({ token: probeUser.token }, NORMAL);
if (probe.status !== 503 || probe.error !== "ai_unavailable") {
  console.error(`Precondition failed: expected 503 ai_unavailable (GEMINI_API_KEY unset), got ${probe.status} ${probe.error}.`);
  process.exit(1);
}

// ---- 1. database function: atomic under real concurrency ----
const dbUser = await signup("user");
const dbResults = await Promise.all(
  Array.from({ length: 25 }, () =>
    rpc(SERVICE, { p_profile_id: dbUser.id, p_child_id: null, p_limit: LIMIT, p_window_seconds: 60 }).then((r) => r.json()),
  ),
);
ok(`25 concurrent take_slot calls record exactly ${LIMIT}`, dbResults.filter((v) => v === true).length === LIMIT);

// ---- 2. only the service role may call it ----
const anonCall = await rpc(ANON, { p_profile_id: dbUser.id, p_child_id: null, p_limit: LIMIT });
const userCall = await rpc(dbUser.token, { p_profile_id: dbUser.id, p_child_id: null, p_limit: LIMIT });
ok("anon key cannot call take_slot", !anonCall.ok);
ok("authenticated user cannot call take_slot", !userCall.ok);

// ---- 3. failed model attempts count toward the limit (adult) ----
const adult = await signup("user");
const seq: number[] = [];
for (let i = 0; i < LIMIT + 1; i++) seq.push((await chat({ token: adult.token }, NORMAL)).status);
ok(`adult: ${LIMIT} failed model attempts (503) then 429`,
  seq.slice(0, LIMIT).every((s) => s === 503) && seq[LIMIT] === 429);

// ---- 4. crisis-screen replies are exempt from the ordinary limit ----
const crisisWhileLimited = await chat({ token: adult.token }, CRISIS);
ok("adult: crisis-screen reply still delivered while rate-limited (200)", crisisWhileLimited.status === 200);

// ---- 5. concurrent HTTP requests cannot slip past the limit ----
const burstUser = await signup("user");
const burst = await Promise.all(Array.from({ length: 15 }, () => chat({ token: burstUser.token }, NORMAL)));
const burstTally = tally(burst.map((r) => r.status));
ok(`15 concurrent sends: exactly ${LIMIT} reach the model (503), 5 refused (429)`,
  burstTally[503] === LIMIT && burstTally[429] === 5 && burst.length === 15);

// ---- 6. separate identities: another adult is unaffected ----
const other = await signup("user");
ok("a different adult is not affected by another's limit",
  (await chat({ token: other.token }, NORMAL)).status === 503);

// ---- 7. child identity: own limit, crisis exemption ----
const caregiver = await signup("caregiver");
const created = await fetch(`${API}/functions/v1/create-child`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${caregiver.token}` },
  body: JSON.stringify({ name: "Test child", age: 10, pin: "4821", modules: [] }),
}).then((r) => r.json());
const fam = await fetch(`${API}/rest/v1/caregivers?select=family_code`, {
  headers: { apikey: ANON, Authorization: `Bearer ${caregiver.token}` },
}).then((r) => r.json());
const pinRes = await fetch(`${API}/functions/v1/verify-child-pin`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: ANON },
  body: JSON.stringify({ family_code: fam[0]?.family_code, pin: "4821" }),
}).then((r) => r.json());
const childToken: string | undefined = pinRes.child_session_token;
ok("child session obtained via create-child + verify-child-pin", !!created.child_id && !!childToken);

if (childToken) {
  const childSeq: number[] = [];
  for (let i = 0; i < LIMIT + 1; i++) childSeq.push((await chat({ child: childToken }, NORMAL)).status);
  ok(`child: ${LIMIT} failed model attempts (503) then 429`,
    childSeq.slice(0, LIMIT).every((s) => s === 503) && childSeq[LIMIT] === 429);
  ok("child: crisis-screen reply still delivered while rate-limited (200)",
    (await chat({ child: childToken }, CRISIS)).status === 200);
  ok("child limit does not affect the caregiver adult account",
    (await chat({ token: caregiver.token }, NORMAL)).status === 503);

  // ---- 8. a deleted child's session is refused ----
  // Delete the child (service role) while its signed token is still valid.
  // Since role flow M3 every child request checks the session against the
  // database, so the request is refused (401) before the rate limit or the
  // model. take_slot's own fail-closed path is covered by
  // ai_companion_handler.test.mts ("rate-limit check failure fails CLOSED").
  await fetch(`${API}/rest/v1/children?id=eq.${created.child_id}`, {
    method: "DELETE",
    headers: { apikey: ANON, Authorization: `Bearer ${SERVICE}` },
  });
  const afterDelete = await chat({ child: childToken }, NORMAL);
  ok("a deleted child's still-valid token is refused (401) before the rate limit or the model",
    afterDelete.status === 401);
}
