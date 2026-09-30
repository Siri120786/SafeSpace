// supabase/functions/_shared/pin.ts
// PBKDF2-SHA256 with a per-PIN random salt, via Web Crypto (works in the Edge
// runtime without native deps). Stored format: "pbkdf2$<iterations>$<saltB64>$<hashB64>".
//
// HONEST LIMITATION: a 4-digit PIN has 10,000 possibilities, so ANY hash of it
// can be brute-forced offline if the database leaks. Hashing protects against
// casual exposure, not a determined attacker with DB access. The real
// protections are: RLS, the family_code requirement, and rate-limiting in
// verify-child-pin. Treat the PIN as a profile switch, not a strong secret
// (see docs/Architecture_Specification.md §6).

const enc = new TextEncoder();
const ITERATIONS = 100_000;

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, iter, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2") return false;
  const expected = fromB64(hashB64);
  const actual = await derive(pin, fromB64(saltB64), Number(iter));
  if (expected.length !== actual.length) return false;
  let diff = 0; // constant-time compare
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
  return diff === 0;
}
