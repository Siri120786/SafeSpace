/**
 * Tiny browser-storage helper. Cycle Care used to keep its data here under the
 * fixed keys below, shared by everyone on the device; it now lives in the
 * person's account (lib/cycleCareStore.ts), and these keys are only read so
 * old data can be saved to the account or deleted.
 * Every access is wrapped: storage can be blocked, full or missing (private windows, tests).
 */

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function deviceKeyValueStore(): KeyValueStore | null {
  return browserStore();
}

function browserStore(): KeyValueStore | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    // storage blocked
  }
  return null;
}

export function readJson<T>(key: string, fallback: T, store: KeyValueStore | null = browserStore()): T {
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Returns false when the data could not be saved, so the screen can say so. */
export function writeJson(key: string, value: unknown, store: KeyValueStore | null = browserStore()): boolean {
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearKey(key: string, store: KeyValueStore | null = browserStore()): void {
  try {
    store?.removeItem(key);
  } catch {
    // ignore
  }
}

export const DIET_KEY = "safespace.cycle-care.diet.v1";
export const PROFILE_KEY = "safespace.cycle-care.profile.v1";
export const EXERCISE_KEY = "safespace.cycle-care.exercise.v1";
export const CONDITION_KEY = "safespace.cycle-care.condition.v1";
