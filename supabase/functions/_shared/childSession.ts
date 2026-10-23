// supabase/functions/_shared/childSession.ts
// Child-session check used by every child-facing Edge Function: the token's
// signature and expiry (childToken.ts) AND its session version, which must
// match children.session_version. reset_child_pin() bumps the version, so a
// PIN reset signs the child out everywhere; a deleted child's tokens stop
// working. One indexed lookup per request.

import { readChildToken } from "./childToken.ts";

// Returns the child's current session version, or null when the child doesn't
// exist. Throws on database errors (callers answer 500).
export type SessionVersionLookup = (childId: string) => Promise<number | null>;

export function childSessionVerifier(lookup: SessionVersionLookup) {
  return async function verifyChildSession(token: unknown): Promise<string | null> {
    const t = await readChildToken(token);
    if (!t) return null;
    const current = await lookup(t.childId);
    return current !== null && current === t.sessionVersion ? t.childId : null;
  };
}

// The lookup for the service-role client. Typed loosely so this file needs
// no supabase-js import (tests run it under Node).
// deno-lint-ignore no-explicit-any
export function sessionVersionLookup(admin: any): SessionVersionLookup {
  return async (childId) => {
    const { data, error } = await admin.from("children").select("session_version").eq("id", childId).maybeSingle();
    if (error) throw error;
    return data ? (data.session_version as number) : null;
  };
}
