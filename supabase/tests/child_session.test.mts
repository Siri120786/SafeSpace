// Child sessions (role-flow M3): tokens carry the child's session version and
// every child request checks it against the database, so a PIN reset (which
// bumps the version) signs the child out and a deleted child's tokens stop
// working. Tokens issued before versions existed count as version 1.
// Usage: npx tsx supabase/tests/child_session.test.mts

(globalThis as any).Deno = { env: { get: (k: string) => (k === "CHILD_SESSION_SECRET" ? "session-test-secret" : undefined) } };
const { signChildToken, verifyChildToken, readChildToken } = await import("../functions/_shared/childToken.ts");
const { childSessionVerifier } = await import("../functions/_shared/childSession.ts");
const { createHmac } = await import("node:crypto");

const ok = (n: string, c: boolean) => {
  console.log((c ? "PASS " : "FAIL ") + n);
  if (!c) process.exitCode = 1;
};

const KID = "11111111-1111-4111-8111-111111111111";
const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");
// A token signed with the real secret but a payload we choose.
const forge = (payload: object) => {
  const p = b64url(JSON.stringify(payload));
  return `${p}.${b64url(createHmac("sha256", "session-test-secret").update(p).digest())}`;
};
const exp = Math.floor(Date.now() / 1000) + 3600;

const t3 = await signChildToken(KID, 3);
ok("new tokens carry the session version", (await readChildToken(t3))?.sessionVersion === 3);
ok("signChildToken defaults to version 1", (await readChildToken(await signChildToken(KID)))?.sessionVersion === 1);
const legacy = forge({ child_id: KID, exp });
ok("a token from before session versions counts as version 1", (await readChildToken(legacy))?.sessionVersion === 1);
ok("a malformed version is rejected",
  (await readChildToken(forge({ child_id: KID, exp, sv: 0 }))) === null &&
  (await readChildToken(forge({ child_id: KID, exp, sv: "2" }))) === null &&
  (await readChildToken(forge({ child_id: KID, exp, sv: 1.5 }))) === null);
ok("verifyChildToken still returns just the child id (signature and expiry)", (await verifyChildToken(t3)) === KID);

const versions: Record<string, number | null> = { [KID]: 3 };
const lookups: string[] = [];
const verify = childSessionVerifier(async (id) => { lookups.push(id); return versions[id] ?? null; });
ok("the matching session version is accepted", (await verify(t3)) === KID);
versions[KID] = 4;
ok("after a PIN reset (version bumped) the old token is refused", (await verify(t3)) === null);
ok("a token issued after the reset works", (await verify(await signChildToken(KID, 4))) === KID);
versions[KID] = 1;
ok("a legacy token works while the child is still on version 1", (await verify(legacy)) === KID);
versions[KID] = null;
ok("a deleted child's token is refused", (await verify(await signChildToken(KID, 1))) === null);
lookups.length = 0;
ok("a tampered token is refused without touching the database",
  (await verify(`${t3.split(".")[0]}.AAAA`)) === null && (await verify("not a token")) === null && lookups.length === 0);
const failing = childSessionVerifier(async () => { throw Object.assign(new Error("db down"), { code: "PGRST301" }); });
let threw = false;
try { await failing(await signChildToken(KID, 1)); } catch { threw = true; }
ok("a database error is thrown (the function answers 500), never treated as a valid session", threw);
