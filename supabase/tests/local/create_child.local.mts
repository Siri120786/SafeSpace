// Local-only end-to-end test for child creation (migration 20261026200000 and
// create-child/handler.ts) against the LOCAL Supabase stack and functions
// server, through the real REST API and Edge Function: caregivers create
// children only through create-child, can't insert children or modules
// directly, can't read PIN hashes, can't reach other families, and
// non-caregivers can't create children at all.
// Refuses any API URL that isn't localhost. Creates throwaway accounts;
// prints no credentials.
// Usage: pnpm test:local:create-child
import { execSync } from "node:child_process";
import {
  initSafeSpaceClient,
  getSafeSpaceClient,
  signUpUser,
  logOut,
  getExistingSession,
  addChild,
  listMyChildren,
  getChildOverview,
  getMyFamilyCode,
  verifyChildPin,
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

async function becomeNew(role: "user" | "caregiver") {
  await logOut().catch(() => {});
  await signUpUser(`create-child-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, crypto.randomUUID(), role);
  const s = await getExistingSession();
  return s?.kind === "auth_user" ? s.profile.id : "";
}
const db = () => getSafeSpaceClient();

// ---------------------------------------------------------------------------
// Caregiver B first, so A can try to reach B's family later.
// ---------------------------------------------------------------------------
const cgB = await becomeNew("caregiver");
const kidB = await addChild({ name: "B kid", age: 9, pin: "6040", modules: ["adhd"] });

const cgA = await becomeNew("caregiver");
const kidA = await addChild({ name: "  Asha ", age: 10, pin: "4826", modules: ["anxiety", "adhd", "anxiety", "nope"] });
const mine = await listMyChildren();
ok("an authorised caregiver creates a child through create-child",
  mine.length === 1 && mine[0].id === kidA && mine[0].name === "Asha" && mine[0].caregiverId === cgA);
ok("privacy tier comes from age and modules are cleaned up server-side",
  mine[0].privacyTier === "partial" && [...mine[0].assignedModules].sort().join() === "adhd,anxiety");
ok("the new child can sign in with the family code and PIN",
  (await verifyChildPin(await getMyFamilyCode(), "4826")).childId === kidA);
// A fresh caregiver C probes A's and B's families.
const cgC = await becomeNew("caregiver");
ok("existing reads still work: overview of one's own child", (await addChild({ name: "C kid", age: 6, pin: "1357", modules: [] })) !== "" &&
  (await listMyChildren()).length === 1 && (await getChildOverview((await listMyChildren())[0].id, 7)).child.privacyTier === "full");

// ---------------------------------------------------------------------------
// Bypass attempts through the REST API, as caregiver C
// ---------------------------------------------------------------------------
const direct = await db().from("children").insert({ caregiver_id: cgC, name: "x", age: 15, pin_hash: "h", privacy_tier: "full" });
ok("direct REST insert into children is refused (42501)", direct.error?.code === "42501");
const directOther = await db().from("children").insert({ caregiver_id: cgB, name: "x", age: 6, pin_hash: "h" });
ok("...including for another caregiver's family", directOther.error?.code === "42501");
const mods = await db().from("child_modules").insert({ child_id: kidB, module_key: "autism" });
ok("direct REST insert into child_modules is refused (42501)", mods.error?.code === "42501");
const rpc = await db().rpc("create_child", { p_caregiver_id: cgC, p_name: "x", p_age: 15, p_pin_hash: "h", p_modules: [] });
ok("create_child() can't be called from the client", !!rpc.error);
const hashes = await db().from("children").select("pin_hash");
ok("PIN hashes can't be read, even for one's own children", !!hashes.error);
const others = await db().from("children").select("id").in("id", [kidA, kidB]);
ok("other families' children stay invisible (RLS)", !others.error && (others.data ?? []).length === 0);
ok("another family's overview is not_found", (await errCode(getChildOverview(kidB, 7))) === "not_found");
const spoof = await addChild({ name: "Spoof", age: 8, pin: "9182", modules: [] } as any).then(async (id) => {
  const row = await db().from("children").select("caregiver_id").eq("id", id).single();
  return row.data?.caregiver_id;
});
ok("a child created by C always belongs to C", spoof === cgC);
ok("a duplicate PIN in the family is refused", (await errCode(addChild({ name: "Twin", age: 8, pin: "1357", modules: [] }))) === "pin_already_used_in_family");

// ---------------------------------------------------------------------------
// Non-caregivers and anonymous callers
// ---------------------------------------------------------------------------
await becomeNew("user");
ok("an adult (non-caregiver) can't create a child", (await errCode(addChild({ name: "x", age: 8, pin: "2222", modules: [] }))) === "not_a_caregiver");
await logOut().catch(() => {});
const anon = await fetch(`${st.API_URL}/functions/v1/create-child`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: st.ANON_KEY, Authorization: `Bearer ${st.ANON_KEY}` },
  body: JSON.stringify({ name: "x", age: 8, pin: "2222", modules: [] }),
});
ok("an anonymous caller can't create a child (401)", anon.status === 401);
const anonInsert = await db().from("children").insert({ caregiver_id: cgB, name: "x", age: 6, pin_hash: "h" });
ok("anonymous REST insert into children is refused", anonInsert.error?.code === "42501");
void cgA;
process.exit(process.exitCode ?? 0);
