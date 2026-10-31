import { useCallback, useEffect, useState } from "react";
import { getSupportPreferences, setMyTheme } from "@safespace/api-client";
import type { ModuleKey } from "@safespace/shared-types";
import { useAuth } from "../auth";
import { useOptionalChildSpace } from "../child-space/ChildSpaceContext";
import { useLowSensory } from "../calm-tools/hooks/useLowSensory";
import { useToolTheme } from "./useToolTheme";
import { activeToolTheme, themesOffered, type ActiveLook, type ToolTheme } from "./toolThemes";

export interface AppTheme {
  // The look to show now ("plain": the pages' own look).
  active: ActiveLook;
  // What the person picked (calm when nothing yet).
  chosen: ToolTheme;
  // Only people with the ADHD or autism module get themes.
  offered: boolean;
  // They may change it themself (false while a caregiver has locked it).
  canChoose: boolean;
  choose: (theme: ToolTheme) => void;
  lowSensory: boolean;
}

// An Individual's support areas, fetched once per person while the app is
// open (kept once loaded, so later pages open straight in their theme).
const areasCache = new Map<string, Promise<ModuleKey[]>>();
const areasLoaded = new Map<string, ModuleKey[]>();
function supportAreasFor(profileId: string): Promise<ModuleKey[]> {
  let p = areasCache.get(profileId);
  if (!p) {
    p = getSupportPreferences(profileId)
      .then((s) => {
        const a = s?.supportAreas ?? [];
        areasLoaded.set(profileId, a);
        return a;
      })
      .catch(() => {
        areasCache.delete(profileId);
        return [];
      });
    areasCache.set(profileId, p);
  }
  return p;
}

// After an Individual changes their support areas (onboarding or profile).
export function forgetSupportAreas(): void {
  areasCache.clear();
  areasLoaded.clear();
}

export function useSupportAreas(): ModuleKey[] | null {
  const { session } = useAuth();
  const profileId = session?.kind === "auth_user" ? session.profile.id : null;
  const [areas, setAreas] = useState<ModuleKey[] | null>(() => (profileId ? areasLoaded.get(profileId) ?? null : null));
  useEffect(() => {
    if (!profileId) return;
    let live = true;
    supportAreasFor(profileId).then((a) => live && setAreas(a));
    return () => {
      live = false;
    };
  }, [profileId]);
  return areas;
}

// The theme for whoever is signed in: a child (their theme is saved with
// them, a caregiver may lock it) or an Individual (kept on this device).
export function useAppTheme(): AppTheme {
  const childSpace = useOptionalChildSpace();
  const areas = useSupportAreas();
  const [deviceTheme, setDeviceTheme] = useToolTheme();
  const { lowSensory } = useLowSensory();
  const chooseChild = useCallback(
    (theme: ToolTheme) => {
      if (!childSpace) return;
      childSpace
        .guard(setMyTheme(childSpace.session, theme))
        .then(childSpace.setTheme)
        .catch(() => undefined);
    },
    [childSpace],
  );
  if (childSpace) {
    const { child } = childSpace;
    const offered = themesOffered(child.assignedModules);
    const chosen = child.theme ?? "calm";
    return {
      active: activeToolTheme(chosen, childSpace.lowSensory, offered),
      chosen,
      offered,
      canChoose: offered && !child.themeLocked,
      choose: chooseChild,
      lowSensory: childSpace.lowSensory,
    };
  }
  const offered = themesOffered(areas ?? []);
  return {
    active: activeToolTheme(deviceTheme, lowSensory, offered),
    chosen: deviceTheme,
    offered,
    canChoose: offered,
    choose: setDeviceTheme,
    lowSensory,
  };
}
