// Cycle Care's saved parts, kept in the person's account (migration
// 20261029300000, 20261030100000): the chosen label, the diet plan, the
// health profile, the movement log and the personal tracker. One store per signed-in person holds the latest copy of
// each part for every screen, saves a change shortly after it's made, and
// notices Cycle Care data left in this browser from before (under the old
// shared keys), which the person can save to their account or delete.
// No React here, so apps/web/tests/cycle-care-store.test.mts can check it
// with a fake account and fake storage.

import { CONDITION_KEY, DIET_KEY, EXERCISE_KEY, PROFILE_KEY, type KeyValueStore } from "./deviceStore";

export type CyclePart = "condition" | "diet" | "profile" | "exercise" | "tracker";
export const CYCLE_PARTS: CyclePart[] = ["condition", "diet", "profile", "exercise", "tracker"];

// Where each part used to be kept in the browser, shared by everyone on it.
// The tracker is new and was never kept there.
export const LEGACY_KEYS: Partial<Record<CyclePart, string>> = {
  condition: CONDITION_KEY,
  diet: DIET_KEY,
  profile: PROFILE_KEY,
  exercise: EXERCISE_KEY,
};

export type PartValues = Record<CyclePart, unknown>;

export interface CycleCareBackend {
  load(): Promise<PartValues>;
  save(parts: Partial<PartValues>): Promise<void>;
  remove(): Promise<void>;
}

export type LoadStatus = "loading" | "ready" | "failed";

export const SAVE_DELAY_MS = 600;

const empty = (): PartValues => ({ condition: null, diet: null, profile: null, exercise: null, tracker: null });

export class CycleCareStore {
  status: LoadStatus = "loading";
  private data: PartValues = empty();
  private dirty = new Set<CyclePart>();
  private failed = new Set<CyclePart>();
  private timers = new Map<CyclePart, ReturnType<typeof setTimeout>>();
  private listeners = new Set<() => void>();
  // What the old shared keys hold, when anything (null when nothing).
  legacy: Partial<PartValues> | null = null;
  // Bumped on every change, for React's useSyncExternalStore.
  version = 0;

  constructor(
    private readonly backend: CycleCareBackend,
    private readonly storage: KeyValueStore | null,
    private readonly delayMs = SAVE_DELAY_MS,
  ) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  // Loads the account copy once. Parts changed before it arrived keep the
  // newer value (and are saved).
  async load(): Promise<void> {
    try {
      const remote = await this.backend.load();
      for (const p of CYCLE_PARTS) if (!this.dirty.has(p)) this.data[p] = remote[p] ?? null;
      this.status = "ready";
      for (const p of this.dirty) this.scheduleSave(p);
    } catch {
      this.status = "failed";
    }
    this.legacy = readLegacy(this.storage);
    this.changed();
  }

  get(part: CyclePart): unknown {
    return this.data[part];
  }

  saveFailed(part: CyclePart): boolean {
    return this.failed.has(part);
  }

  set(part: CyclePart, value: unknown) {
    this.data[part] = value;
    this.dirty.add(part);
    if (this.status === "ready") this.scheduleSave(part);
    // The account copy never loaded: saving now could overwrite it, so the
    // change stays here and the screen says it wasn't saved.
    if (this.status === "failed") this.failed.add(part);
    this.changed();
  }

  private scheduleSave(part: CyclePart) {
    const t = this.timers.get(part);
    if (t) clearTimeout(t);
    this.timers.set(part, setTimeout(() => void this.savePart(part), this.delayMs));
  }

  private async savePart(part: CyclePart) {
    this.timers.delete(part);
    try {
      await this.backend.save({ [part]: this.data[part] });
      this.dirty.delete(part);
      this.failed.delete(part);
    } catch {
      this.failed.add(part);
    }
    this.changed();
  }

  // Saves anything waiting now (e.g. before leaving).
  async flush(): Promise<void> {
    const waiting = [...this.timers.keys()];
    for (const p of waiting) {
      clearTimeout(this.timers.get(p)!);
      await this.savePart(p);
    }
  }

  // Old device data: fills only the parts the account doesn't have yet, saves
  // them, then removes the old keys.
  async adoptLegacy(): Promise<void> {
    if (!this.legacy) return;
    const fill: Partial<PartValues> = {};
    for (const p of CYCLE_PARTS) {
      const v = this.legacy[p];
      if (v !== undefined && v !== null && (this.data[p] === null || this.data[p] === undefined)) fill[p] = v;
    }
    if (Object.keys(fill).length) {
      await this.backend.save(fill);
      Object.assign(this.data, fill);
    }
    this.discardLegacy();
  }

  discardLegacy() {
    clearLegacy(this.storage);
    this.legacy = null;
    this.changed();
  }

  // "Delete my data": the account row, anything waiting to save, and any old
  // device data.
  async deleteAll(): Promise<void> {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.dirty.clear();
    await this.backend.remove();
    this.data = empty();
    this.failed.clear();
    clearLegacy(this.storage);
    this.legacy = null;
    this.changed();
  }

  dispose() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.listeners.clear();
  }
}

function readLegacy(storage: KeyValueStore | null): Partial<PartValues> | null {
  if (!storage) return null;
  const found: Partial<PartValues> = {};
  for (const p of CYCLE_PARTS) {
    const key = LEGACY_KEYS[p];
    if (!key) continue;
    try {
      const raw = storage.getItem(key);
      if (raw === null) continue;
      found[p] = JSON.parse(raw);
    } catch {
      // Damaged: nothing worth keeping.
    }
  }
  return Object.keys(found).length ? found : hasAnyLegacy(storage) ? {} : null;
}

function hasAnyLegacy(storage: KeyValueStore): boolean {
  return CYCLE_PARTS.some((p) => {
    const key = LEGACY_KEYS[p];
    if (!key) return false;
    try {
      return storage.getItem(key) !== null;
    } catch {
      return false;
    }
  });
}

function clearLegacy(storage: KeyValueStore | null) {
  if (!storage) return;
  for (const p of CYCLE_PARTS) {
    const key = LEGACY_KEYS[p];
    if (!key) continue;
    try {
      storage.removeItem(key);
    } catch {
      // Storage unavailable: nothing to clear.
    }
  }
}
