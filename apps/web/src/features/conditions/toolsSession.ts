// Who the ADHD and autism tools are saving for (role-flow 8e). The auth layer
// sets it whenever the session changes, before the tools render; the tools'
// service factories then save to that person's account in the database
// (children through the focus-tools Edge Function, Individuals under RLS).
// With nobody signed in, the services fall back to on-device storage, which
// itself saves nothing without an owner (8b).
import type { AppSession } from "@safespace/shared-types";
import { setCloudSaving } from "../wellness-ui/store/LocalDeviceStore";

let current: AppSession = null;

export function setToolsSession(session: AppSession): void {
  current = session;
  setCloudSaving(!!session);
}

export function getToolsSession(): AppSession {
  return current;
}
