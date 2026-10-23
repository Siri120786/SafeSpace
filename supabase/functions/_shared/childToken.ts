// supabase/functions/_shared/childToken.ts
// Signed, short-lived token scoped to exactly one child_id. Issued by
// verify-child-pin, verified by every child-facing Edge Function. Children have
// no auth.users row, so this token IS their session (see migration 0001).
//
// Format: base64url(payloadJSON).base64url(HMAC-SHA256(payload, secret))
// Secret: CHILD_SESSION_SECRET (set with `supabase secrets set`, never commit).

const enc = new TextEncoder();
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("CHILD_SESSION_SECRET");
  if (!secret) throw new Error("CHILD_SESSION_SECRET is not set");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

// sessionVersion: children.session_version when the token is issued. Each
// child request checks it (see childSession.ts), so a PIN reset ends sessions.
export async function signChildToken(childId: string, sessionVersion = 1): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({
    child_id: childId,
    sv: sessionVersion,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

// Returns the child_id if the token is authentic and unexpired, else null.
// Accepts any value straight from a request body: anything malformed (not a
// string, wrong shape, bad base64, bad JSON) is null, never a thrown error, so
// callers answer 401 rather than 500. A missing CHILD_SESSION_SECRET still
// throws, because that is a server misconfiguration, not a bad token.
// Signature and expiry only: child functions use childSession.ts, which also
// checks the session version against the database.
export async function verifyChildToken(token: unknown): Promise<string | null> {
  return (await readChildToken(token))?.childId ?? null;
}

// The verified token contents (same rules as verifyChildToken). Tokens issued
// before session versions existed carry no `sv` and count as version 1.
export async function readChildToken(token: unknown): Promise<{ childId: string; sessionVersion: number } | null> {
  if (typeof token !== "string" || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [payload, sig] = parts;
  let sigBytes: Uint8Array;
  try {
    sigBytes = fromB64url(sig);
  } catch {
    return null;
  }
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(), sigBytes, enc.encode(payload));
  if (!ok) return null;
  try {
    const { child_id, exp, sv } = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (typeof child_id !== "string" || !child_id || typeof exp !== "number") return null;
    if (sv !== undefined && (typeof sv !== "number" || !Number.isInteger(sv) || sv < 1)) return null;
    return exp > Math.floor(Date.now() / 1000) ? { childId: child_id, sessionVersion: sv ?? 1 } : null;
  } catch {
    return null;
  }
}
