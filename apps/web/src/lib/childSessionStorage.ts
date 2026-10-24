// apps/web/src/lib/childSessionStorage.ts

import type { ChildSession } from "@safespace/shared-types";

const KEY = "safespace_child_session";

export function getStoredChildSession(): ChildSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ChildSession) : null;
  } catch {
    return null;
  }
}

export function storeChildSession(session: ChildSession): void {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearChildSession(): void {
  localStorage.removeItem(KEY);
}

export const clearStoredChildSession = clearChildSession;

const FAMILY_KEY = "safespace_family_code";
export const getStoredFamilyCode = (): string | null => localStorage.getItem(FAMILY_KEY);
export const storeFamilyCode = (code: string): void => localStorage.setItem(FAMILY_KEY, code.trim().toUpperCase());
// "Change" on the PIN screen: a different family, or a mistyped code.
export const clearFamilyCode = (): void => localStorage.removeItem(FAMILY_KEY);
