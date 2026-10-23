import { useEffect, useState } from "react";
import { getAccessibilityPreferences } from "@safespace/api-client";
import { useAuth } from "../../auth";
import { useAccessibility } from "../../profile";
import { resolveLowSensory } from "../lib/lowSensory";
import { useOptionalChildSpace } from "../../child-space/ChildSpaceContext";

const QUERY = "(prefers-reduced-motion: reduce)";

function readOsPreference(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(QUERY).matches
    : false;
}

export interface LowSensoryResult {
  /** True when animation should be removed and styling kept calm. */
  lowSensory: boolean;
  /** Set if the saved preference could not be loaded. The OS setting still applies. */
  preferenceError: string | null;
}

/**
 * Combines the OS "reduce motion" setting with the saved
 * reducedSensoryStimulation preference. If the shared AccessibilityContext has
 * not been filled yet (it only is after visiting Profile), the saved
 * preference is loaded here through getAccessibilityPreferences.
 */
export function useLowSensory(): LowSensoryResult {
  const { session } = useAuth();
  const { preferences } = useAccessibility();
  const childSpace = useOptionalChildSpace();
  const profileId = session?.kind === "auth_user" ? session.profile.id : null;

  const [osReduced, setOsReduced] = useState<boolean>(readOsPreference);
  const [fetched, setFetched] = useState<boolean | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setOsReduced(e.matches);
    setOsReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const contextLoaded = preferences.profileId !== "";

  useEffect(() => {
    if (!profileId || contextLoaded) return;
    let active = true;
    getAccessibilityPreferences(profileId)
      .then((acc) => {
        if (active) setFetched(acc?.reducedSensoryStimulation ?? false);
      })
      .catch(() => {
        if (active) setPreferenceError("We could not load your saved comfort settings. Using your device setting instead.");
      });
    return () => {
      active = false;
    };
  }, [profileId, contextLoaded]);

  // A child: their caregiver's default, or their own choice on this device.
  const saved = childSpace ? childSpace.lowSensory : contextLoaded ? preferences.reducedSensoryStimulation : fetched ?? false;
  return { lowSensory: resolveLowSensory(osReduced, saved), preferenceError };
}
