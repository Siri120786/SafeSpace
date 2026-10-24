/**
 * SafeSpace Workstream B — Local Device Store
 *
 * Provides a resilient, type-safe persistence wrapper over browser `localStorage`.
 * Guaranteed to never throw uncaught exceptions (e.g. in private browsing mode,
 * quota exceeded errors, or when running in SSR/test environments where storage is absent).
 *
 * Namespace prefix: "safespace.ws-b."
 *
 * Per person (role-flow 8b): every key includes the signed-in person
 * ("p:<profile id>" for adults, "c:<child id>" for children), so on a shared
 * family device nobody sees anyone else's schedule, feelings, tasks or stars.
 * The auth layer sets the owner whenever the session changes; with nobody
 * signed in nothing is read or saved. clearDeviceStore() removes every tool
 * key on sign-out. This is interim: step 8e moves the data to the database.
 */

export const STORAGE_PREFIX = "safespace.ws-b.";

let currentOwner: string | null = null;

/** Who the tool data belongs to: "p:<profile id>", "c:<child id>", or null when signed out. */
export function setDeviceStoreOwner(owner: string | null): void {
  currentOwner = owner && /^[pc]:[A-Za-z0-9-]{1,64}$/.test(owner) ? owner : null;
}

export function getDeviceStoreOwner(): string | null {
  return currentOwner;
}

/** Removes every tool key on this device (all people). Used on sign-out. */
export function clearDeviceStore(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const storage = window.localStorage;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => storage.removeItem(k));
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

export interface StorageOptions<T> {
  /** Optional custom runtime validator function to verify parsed JSON structure. */
  validator?: (data: unknown) => data is T;
}

export class LocalDeviceStore<T> {
  private readonly featureKey: string;
  private readonly validator?: (data: unknown) => data is T;

  /**
   * @param featureKey Unique identifier for the feature/domain (e.g., "autism.routines", "adhd.focus")
   * @param options Storage configuration options including optional validator
   */
  constructor(featureKey: string, options?: StorageOptions<T>) {
    this.featureKey = featureKey;
    this.validator = options?.validator;
  }

  /** The full storage key for the signed-in person, or null when nobody is signed in. */
  get key(): string | null {
    return currentOwner ? `${STORAGE_PREFIX}${currentOwner}.${this.featureKey}` : null;
  }

  /**
   * Checks if window.localStorage is accessible and writable in the current runtime.
   */
  public isAvailable(): boolean {
    try {
      if (!this.key || typeof window === "undefined" || !window.localStorage) {
        return false;
      }
      const testKey = `${STORAGE_PREFIX}__probe__`;
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the stored data for this key.
   * If the key is missing, storage is unavailable, or JSON is corrupt/invalid,
   * falls back safely to the provided `defaultValue`.
   */
  public get(defaultValue: T): T {
    try {
      const key = this.key;
      if (!key || typeof window === "undefined" || !window.localStorage) {
        return defaultValue;
      }
      const raw = window.localStorage.getItem(key);
      if (raw === null || raw === undefined) {
        return defaultValue;
      }

      const parsed: unknown = JSON.parse(raw);
      if (this.validator && !this.validator(parsed)) {
        return defaultValue;
      }

      return parsed as T;
    } catch {
      // Corrupt JSON, storage read failure, or security error
      return defaultValue;
    }
  }

  /**
   * Saves data into localStorage.
   * Returns true on success, or false if storage is disabled, unavailable, or quota exceeded.
   */
  public set(value: T): boolean {
    try {
      const key = this.key;
      if (!key || typeof window === "undefined" || !window.localStorage) {
        return false;
      }
      const serialized = JSON.stringify(value);
      window.localStorage.setItem(key, serialized);
      return true;
    } catch {
      // Storage unavailable, quota exceeded, or serialization error
      return false;
    }
  }

  /**
   * Removes the stored key from localStorage.
   * Returns true on success, or false if an error occurred.
   */
  public remove(): boolean {
    try {
      const key = this.key;
      if (!key || typeof window === "undefined" || !window.localStorage) {
        return false;
      }
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
}

/** Convenience factory function to instantiate a LocalDeviceStore. */
export function createLocalDeviceStore<T>(
  featureKey: string,
  options?: StorageOptions<T>
): LocalDeviceStore<T> {
  return new LocalDeviceStore<T>(featureKey, options);
}
