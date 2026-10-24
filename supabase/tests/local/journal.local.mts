// Local-only end-to-end test for Sprint 3 journaling: drives the REAL
// @safespace/api-client functions against the LOCAL Supabase stack
// (`supabase start` + `supabase functions serve`) as adults, a caregiver, and
// children of two privacy tiers signed in by PIN. Refuses any API URL that
// isn't localhost. Creates throwaway accounts; prints no credentials.
// Usage: pnpm test:local:journal
import { execSync } from "node:child_process";
import {
  initSafeSpaceClient,
  getSafeSpaceClient,
  signUpUser,
  logInUser,
  logOut,
  getExistingSession,
  addChild,
  getMyFamilyCode,
  verifyChildPin,
  createJournalEntry,
  listMyJournalEntries,
  deleteJournalEntry,
  listChildJournalEntries,
} from "../../../packages/api-client/src/index.ts";

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};
// A birth month/year giving this age today (role flow: children have birth dates).
const born = (years: number) => ({ birthYear: new Date().getUTCFullYear() - years, birthMonth: new Date().getUTCMonth() + 1 });
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

const accounts: Record<string, { email: string; password: string }> = {};
async function becomeNew(key: string, role: "user" | "caregiver") {
  await logOut().catch(() => {});
  accounts[key] = { email: `journal-${key}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, password: crypto.randomUUID() };
  await signUpUser(accounts[key].email, accounts[key].password, role);
  return getExistingSession();
}
async function become(key: string) {
  await logOut().catch(() => {});
  await logInUser(accounts[key].email, accounts[key].password);
  return getExistingSession();
}

// ---------------------------------------------------------------------------
// Adults
// ---------------------------------------------------------------------------
const a = await becomeNew("adultA", "user");
const e1 = await createJournalEntry(a, { content: "  Long day, but I finished the report.  " });
const e2 = await createJournalEntry(a, { content: "Grateful for chai with my sister", entryType: "gratitude", moduleKey: "depression" });
ok("adult saves entries (trimmed, default type 'journal', gratitude with module)",
  e1.content === "Long day, but I finished the report." && e1.entryType === "journal" && e1.moduleKey === null &&
  e2.entryType === "gratitude" && e2.moduleKey === "depression" && e1.profileId !== null && e1.childId === null);
const mine = await listMyJournalEntries(a);
ok("adult lists their entries newest first", mine.length === 2 && mine[0].id === e2.id);
ok("adult filters by type and by module",
  (await listMyJournalEntries(a, { entryType: "gratitude" })).length === 1 &&
  (await listMyJournalEntries(a, { moduleKey: "depression" })).length === 1);
ok("adults can't save a private note (private notes were removed)",
  (await errCode(createJournalEntry(a, { content: "x", isPrivateNote: true } as any))) === "invalid_input");
ok("blank and over-long content rejected",
  (await errCode(createJournalEntry(a, { content: "   " }))) === "invalid_input" &&
  (await errCode(createJournalEntry(a, { content: "a".repeat(5001) }))) === "content_too_long");

const b = await becomeNew("adultB", "user");
ok("another adult sees none of A's entries and can't delete them",
  (await listMyJournalEntries(b)).length === 0 &&
  (await errCode(deleteJournalEntry(b, e1.id))) === "not_found");

// ---------------------------------------------------------------------------
// Caregiver and two children under 15 (age 7 and age 10)
// ---------------------------------------------------------------------------
await becomeNew("cg", "caregiver");
const youngId = await addChild({ name: "Young", ...born(7), pin: "2741", modules: [] });
const olderId = await addChild({ name: "Older", ...born(10), pin: "5826", modules: [] });
const family = await getMyFamilyCode();
const young = await verifyChildPin(family, "2741");
const older = await verifyChildPin(family, "5826");

const y1 = await createJournalEntry(young, { content: "I drew a cat" });
ok("a child saves an entry through the Edge Function", y1.childId === youngId && y1.profileId === null);
ok("children can't mark a private note (private notes were removed)",
  (await errCode(createJournalEntry(young, { content: "secret", isPrivateNote: true } as any))) === "invalid_input" &&
  (await errCode(createJournalEntry(older, { content: "secret", isPrivateNote: true } as any))) === "invalid_input");
await createJournalEntry(older, { content: "Shared: maths test went ok" });
await createJournalEntry(older, { content: "Worried about a friend" });
ok("each child lists only their own entries",
  (await listMyJournalEntries(young)).length === 1 && (await listMyJournalEntries(older)).length === 2);
ok("children can't delete entries this sprint", (await errCode(deleteJournalEntry(young, y1.id))) === "unsupported_session");

await become("cg");
const cgOlder = (await listChildJournalEntries(olderId)).map((e) => e.content);
ok("caregiver sees all of an under-15 child's entries",
  cgOlder.includes("Shared: maths test went ok") && cgOlder.includes("Worried about a friend"));
ok("caregiver sees the younger child's entry too", (await listChildJournalEntries(youngId)).length === 1);
ok("caregiver can't see adult A's journal", (await listMyJournalEntries(await getExistingSession())).length === 0);

// Another family's caregiver sees nothing of these children.
await becomeNew("cg2", "caregiver");
ok("another caregiver sees none of these children's entries",
  (await listChildJournalEntries(youngId)).length === 0 && (await listChildJournalEntries(olderId)).length === 0);

// ---------------------------------------------------------------------------
// Anonymous access, then cleanup
// ---------------------------------------------------------------------------
await logOut().catch(() => {});
const anon = await getSafeSpaceClient().from("journal_entries").select("id");
ok("anonymous REST read of journal entries is refused", !!anon.error && anon.error.code === "42501");

const back = await become("adultA");
await deleteJournalEntry(back, e1.id);
await deleteJournalEntry(back, e2.id);
ok("adult deletes their entries", (await listMyJournalEntries(back)).length === 0);
await logOut().catch(() => {});
process.exit(process.exitCode ?? 0);
