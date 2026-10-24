// Local-only end-to-end test for music (role-flow 9b/9c) against the LOCAL
// Supabase stack, through the real api-client, RLS, Storage and the
// focus-tools Edge Function:
//   - an Individual hearts and un-hearts tracks;
//   - a child does the same through focus-tools, and only sees their own;
//   - their caregiver can't see the child's favorites, but sets the child's
//     music controls, which reach the child;
//   - the "music" bucket serves files to anyone (with CORS, so the player can
//     use them) and refuses uploads from anyone but the service role.
// Refuses any API URL that isn't localhost. Creates throwaway accounts and
// one test file (removed at the end); prints no credentials or keys.
// Usage: pnpm test:local:music
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
  getExistingSession,
  listMusicFavorites,
  setMusicFavorite,
  musicFileUrl,
  getToolSettings,
  getChildToolSetup,
  setChildToolSettings,
} from "../../../packages/api-client/src/index.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};
const fails = async (p: Promise<unknown>) => { try { await p; return "no_error"; } catch (e) { return (e as Error).message; } };
const born = (years: number) => ({ birthYear: new Date().getUTCFullYear() - years, birthMonth: new Date().getUTCMonth() + 1 });

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
const indi = mk("music-indi");
await signUpUser(indi.email, indi.password, "user");
const me = await getExistingSession();
await setMusicFavorite(me, "gentle-waves", true);
await setMusicFavorite(me, "rhyme-twinkle-twinkle", true);
await setMusicFavorite(me, "gentle-waves", true);
ok("an Individual hearts tracks (twice is fine)", (await listMusicFavorites(me)).sort().join() === "gentle-waves,rhyme-twinkle-twinkle");
await setMusicFavorite(me, "gentle-waves", false);
ok("and un-hearts them", (await listMusicFavorites(me)).join() === "rhyme-twinkle-twinkle");
ok("only catalog ids", (await fails(setMusicFavorite(me, "Not An Id", true))) === "invalid_input");
ok("an Individual's music has no controls on it", (await getToolSettings(me)).music.enabled === true);
await logOut();

// ---------------------------------------------------------------------------
// A family: a caregiver and two children
// ---------------------------------------------------------------------------
const carer = mk("music-carer");
await signUpUser(carer.email, carer.password, "caregiver");
const kidId = await addChild({ name: "Kid", ...born(8), pin: "4826", modules: [] });
await addChild({ name: "Sib", ...born(10), pin: "5937", modules: [] });
const family = await getMyFamilyCode();
await logOut();

const kid = await verifyChildPin(family, "4826");
const sib = await verifyChildPin(family, "5937");
await setMusicFavorite(kid, "sunny-marimba", true);
await setMusicFavorite(kid, "rhyme-chandamama-raave", true);
await setMusicFavorite(kid, "sunny-marimba", false);
ok("a child hearts and un-hearts through focus-tools", (await listMusicFavorites(kid)).join() === "rhyme-chandamama-raave");
ok("a sibling sees only their own", (await listMusicFavorites(sib)).length === 0);
const before = await getToolSettings(kid);
ok("music starts on for a child, with no extra limits",
  before.music.enabled && before.music.volumeMax === null && before.music.sleepMinutes === null);

await logInUser(carer.email, carer.password);
const { data: seen } = await getSafeSpaceClient().from("music_favorites").select("track_id").eq("child_id", kidId);
ok("the caregiver can't see the child's favorites", (seen ?? []).length === 0);
await setChildToolSettings(kidId, { music: { enabled: false, volumeMax: 30, sleepMinutes: 20 } });
ok("the caregiver sets the child's music controls",
  JSON.stringify((await getChildToolSetup(kidId)).settings.music) === JSON.stringify({ enabled: false, volumeMax: 30, sleepMinutes: 20 }));
ok("bad controls are refused", (await fails(setChildToolSettings(kidId, { music: { enabled: true, volumeMax: 90, sleepMinutes: null } }))) !== "no_error");
ok("the child's other tool settings are kept", (await getChildToolSetup(kidId)).settings.aacLabels !== undefined);
const after = await getToolSettings(kid);
ok("the controls reach the child", !after.music.enabled && after.music.volumeMax === 30 && after.music.sleepMinutes === 20);

// ---------------------------------------------------------------------------
// The music bucket
// ---------------------------------------------------------------------------
// Half a second of a quiet tone as a WAV file.
function tone(): Uint8Array {
  const rate = 8000, n = rate / 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 3000), true);
  return new Uint8Array(buf);
}
const PATH = "e2e-test/tone.wav";
const upload = (key: string) => fetch(`${st.API_URL}/storage/v1/object/music/${PATH}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, apikey: st.ANON_KEY, "Content-Type": "audio/wav", "x-upsert": "true" },
  body: tone(),
});
ok("anyone without the service role can't add files (anon)", !(await upload(st.ANON_KEY)).ok);
const session = (await getSafeSpaceClient().auth.getSession()).data.session;
ok("or a signed-in caregiver", !(await upload(session!.access_token)).ok);
ok("the service role can", (await upload(st.SERVICE_ROLE_KEY)).ok);
const url = musicFileUrl(PATH);
const res = await fetch(url, { headers: { Origin: "http://localhost:5173" } });
ok("files are public, with CORS so the player can use them",
  res.ok && (res.headers.get("access-control-allow-origin") === "*" || res.headers.get("access-control-allow-origin") === "http://localhost:5173"));
ok("a file that isn't audio is refused", !(await fetch(`${st.API_URL}/storage/v1/object/music/e2e-test/x.txt`, {
  method: "POST", headers: { Authorization: `Bearer ${st.SERVICE_ROLE_KEY}`, "Content-Type": "text/plain" }, body: "hello",
})).ok);
const removed = await fetch(`${st.API_URL}/storage/v1/object/music/${PATH}`, { method: "DELETE", headers: { Authorization: `Bearer ${st.SERVICE_ROLE_KEY}` } });
ok("the test file is removed", removed.ok);
await logOut();
