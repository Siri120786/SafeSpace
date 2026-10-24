import { useContext, useMemo, useSyncExternalStore } from "react";
import { deleteCycleCareData, getCycleCareData, saveCycleCareParts, type CycleCareData } from "@safespace/api-client";
import type { AppSession } from "@safespace/shared-types";
import { AuthContext } from "../../auth";
import { runBeforeSignOut } from "../../auth/beforeSignOut";
import { deviceKeyValueStore } from "../lib/deviceStore";
import { CycleCareStore, type CyclePart, type LoadStatus, type PartValues } from "../lib/cycleCareStore";

// One Cycle Care store for the signed-in person, shared by every screen. A
// different person (or signing out) gets a fresh one.
let current: { owner: string; store: CycleCareStore } | null = null;

function storeFor(session: AppSession): CycleCareStore | null {
  const owner = session?.kind === "auth_user" ? session.profile?.id : null;
  if (!owner) {
    current?.store.dispose();
    current = null;
    return null;
  }
  if (current?.owner !== owner) {
    current?.store.dispose();
    const store = new CycleCareStore(
      {
        load: () => getCycleCareData(session) as Promise<PartValues>,
        save: (parts) => saveCycleCareParts(session, parts as Partial<CycleCareData>),
        remove: () => deleteCycleCareData(session),
      },
      deviceKeyValueStore(),
    );
    current = { owner, store };
    void store.load();
  }
  return current.store;
}

// Saves any Cycle Care change still waiting, before signing out.
export async function flushCycleCare(): Promise<void> {
  await current?.store.flush().catch(() => undefined);
}
runBeforeSignOut(flushCycleCare);

const noSubscribe = () => () => undefined;

export function useCycleCareStore(): CycleCareStore | null {
  // No sign-in at all (e.g. a screen shown on its own): nothing to load or save.
  const session = useContext(AuthContext)?.session ?? null;
  const store = storeFor(session);
  const version = () => store?.version ?? 0;
  useSyncExternalStore(store?.subscribe ?? noSubscribe, version, version);
  return store;
}

/**
 * One part of the person's Cycle Care, saved to their account. Bad or missing
 * data falls back to `fallback`. `saveFailed` becomes true when the last save
 * didn't go through, so the screen can say so.
 */
export function useCycleCarePart<T>(
  part: CyclePart,
  fallback: T,
  sanitize: (raw: unknown) => T,
): [T, (next: T) => void, boolean, LoadStatus] {
  const store = useCycleCareStore();
  const raw = store?.get(part);
  const value = useMemo(() => sanitize(raw ?? fallback), [raw]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (next: T) => store?.set(part, next);
  return [value, set, !!store?.saveFailed(part), store?.status ?? "failed"];
}
