/**
 * SafeSpace Workstream B — Local Device Store
 *
 * Provides a resilient, type-safe persistence wrapper over browser `localStorage`.
 * Guaranteed to never throw uncaught exceptions (e.g. in private browsing mode,
 * quota exceeded errors, or when running in SSR/test environments where storage is absent).
 *
 * Namespace prefix: "safespace.ws-b."
 */

export const STORAGE_PREFIX = "safespace.ws-b.";

export interface StorageOptions<T> {
  /** Optional custom runtime validator function to verify parsed JSON structure. */
  validator?: (data: unknown) => data is T;
}

export class LocalDeviceStore<T> {
  private readonly storageKey: string;
  private readonly validator?: (data: unknown) => data is T;

  /**
   * @param featureKey Unique identifier for the feature/domain (e.g., "autism.routines", "adhd.focus")
   * @param options Storage configuration options including optional validator
   */
  constructor(featureKey: string, options?: StorageOptions<T>) {
    this.storageKey = `${STORAGE_PREFIX}${featureKey}`;
    this.validator = options?.validator;
  }

  /** Fully qualified storage key including the namespace prefix. */
  get key(): string {
    return this.storageKey;
  }

  /**
   * Checks if window.localStorage is accessible and writable in the current runtime.
   */
  public isAvailable(): boolean {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
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
      if (typeof window === "undefined" || !window.localStorage) {
        return defaultValue;
      }
      const raw = window.localStorage.getItem(this.storageKey);
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
      if (typeof window === "undefined" || !window.localStorage) {
        return false;
      }
      const serialized = JSON.stringify(value);
      window.localStorage.setItem(this.storageKey, serialized);
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
      if (typeof window === "undefined" || !window.localStorage) {
        return false;
      }
      window.localStorage.removeItem(this.storageKey);
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
