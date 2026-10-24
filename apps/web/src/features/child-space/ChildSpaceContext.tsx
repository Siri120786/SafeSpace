import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyChildProfile, getMyChildSettings } from "@safespace/api-client";
import type { Child, ChildSession, ChildSettings } from "@safespace/shared-types";
import { useAuth } from "../auth";
import { effectiveLowSensory, isSessionEnded, needsSharingQuestion } from "./childHome";

export const SESSION_ENDED_NOTICE = "Please sign in again with your PIN.";

interface ChildSpace {
  session: ChildSession;
  child: Child;
  settings: ChildSettings;
  lowSensory: boolean;
  setLowSensoryOnThisDevice: (on: boolean | null) => void;
  setSettings: (s: ChildSettings) => void;
  // Runs a child api call; if the session has ended, signs out to the PIN page.
  guard: <T>(p: Promise<T>) => Promise<T>;
}

const Ctx = createContext<ChildSpace | null>(null);

// For screens shared with adults (calm tools): null outside the child's space.
export const useOptionalChildSpace = () => useContext(Ctx);

export function useChildSpace(): ChildSpace {
  const v = useContext(Ctx);
  if (!v) throw new Error("useChildSpace must be used inside ChildSpaceProvider");
  return v;
}

// The child's own choice, per device. Browser storage can be unavailable, so
// every read and write is guarded; without it the caregiver's default applies.
const deviceKey = (childId: string) => `safespace_child_low_sensory_${childId}`;
function readDeviceChoice(childId: string): boolean | null {
  try {
    const v = localStorage.getItem(deviceKey(childId));
    return v === "on" ? true : v === "off" ? false : null;
  } catch {
    return null;
  }
}
function writeDeviceChoice(childId: string, on: boolean | null) {
  try {
    if (on === null) localStorage.removeItem(deviceKey(childId));
    else localStorage.setItem(deviceKey(childId), on ? "on" : "off");
  } catch {
    // Not saved on this device; still applies until they leave.
  }
}

interface ProviderProps {
  children: React.ReactNode;
  // Shown instead of the space while the 15+ sharing question is unanswered.
  sharingQuestion: (answer: (s: ChildSettings) => void) => React.ReactNode;
  pinPath: string;
}

// Loads the signed-in child's profile and settings once for every child page
// (docs/role-flow/CONTRACT.md section 10).
export const ChildSpaceProvider: React.FC<ProviderProps> = ({ children, sharingQuestion, pinPath }) => {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [child, setChild] = useState<Child | null>(null);
  const [settings, setSettings] = useState<ChildSettings | null>(null);
  const [deviceChoice, setDeviceChoice] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const childSession = session?.kind === "child" ? session : null;

  const endSession = useCallback(async () => {
    await logout().catch(() => {});
    navigate(pinPath, { replace: true, state: { notice: SESSION_ENDED_NOTICE } });
  }, [logout, navigate, pinPath]);

  const guard = useCallback(
    async <T,>(p: Promise<T>): Promise<T> => {
      try {
        return await p;
      } catch (e) {
        if (isSessionEnded(e)) void endSession();
        throw e;
      }
    },
    [endSession],
  );

  useEffect(() => {
    if (!childSession) return;
    let active = true;
    setFailed(false);
    Promise.all([getMyChildProfile(childSession), getMyChildSettings(childSession)])
      .then(([c, s]) => {
        if (!active) return;
        setChild(c);
        setSettings(s);
        setDeviceChoice(readDeviceChoice(c.id));
      })
      .catch((e) => {
        if (!active) return;
        if (isSessionEnded(e)) void endSession();
        else setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [childSession, endSession]);

  const value = useMemo<ChildSpace | null>(() => {
    if (!childSession || !child || !settings) return null;
    return {
      session: childSession,
      child,
      settings,
      lowSensory: effectiveLowSensory(child.lowSensoryDefault, deviceChoice),
      setLowSensoryOnThisDevice: (on) => {
        writeDeviceChoice(child.id, on);
        setDeviceChoice(on);
      },
      setSettings,
      guard,
    };
  }, [childSession, child, settings, deviceChoice, guard]);

  if (failed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] p-6 text-center">
        <div className="space-y-3">
          <p className="text-base text-charcoal">We couldn't open your space just now.</p>
          <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-botanical-700 px-5 py-2 text-sm font-semibold text-white">
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (!value) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
        <p className="text-sm font-semibold text-botanical-800">Loading your space…</p>
      </div>
    );
  }
  if (needsSharingQuestion(value.settings)) {
    return <Ctx.Provider value={value}>{sharingQuestion(setSettings)}</Ctx.Provider>;
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
