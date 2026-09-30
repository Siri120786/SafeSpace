// Runs the Edge Function crypto helpers under Node with a Deno.env stub.
// Usage: npx tsx supabase/tests/crypto.test.mts
(globalThis as any).Deno = { env: { get: (k: string) => k === "CHILD_SESSION_SECRET" ? "test-secret" : undefined } };
const { hashPin, verifyPin } = await import("../functions/_shared/pin.ts");
const { signChildToken, verifyChildToken } = await import("../functions/_shared/childToken.ts");

const assert = (name: string, cond: boolean) => { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) process.exitCode = 1; };

const h = await hashPin("1234");
assert("correct PIN verifies", await verifyPin("1234", h));
assert("wrong PIN rejected", !(await verifyPin("1235", h)));
assert("same PIN hashes differently (salted)", h !== await hashPin("1234"));
assert("hash is not plaintext", !h.includes("1234"));

const t = await signChildToken("child-abc");
assert("valid token resolves child_id", (await verifyChildToken(t)) === "child-abc");
const [, sig] = t.split(".");
assert("tampered payload rejected", (await verifyChildToken(btoa(JSON.stringify({ child_id: "other", exp: 9999999999 })) + "." + sig)) === null);
assert("garbage rejected", (await verifyChildToken("nope")) === null);
assert("undefined rejected", (await verifyChildToken(undefined)) === null);

const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const expPayload = b64u(new TextEncoder().encode(JSON.stringify({ child_id: "c", exp: 1 })));
const expSig = b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(expPayload))));
assert("expired token rejected", (await verifyChildToken(`${expPayload}.${expSig}`)) === null);
