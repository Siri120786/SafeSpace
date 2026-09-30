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

export async function signChildToken(childId: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({
    child_id: childId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

// Returns the child_id if the token is authentic and unexpired, else null.
export async function verifyChildToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64url(sig), enc.encode(payload));
  if (!ok) return null;
  try {
    const { child_id, exp } = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    return exp > Math.floor(Date.now() / 1000) ? child_id : null;
  } catch {
    return null;
  }
}
