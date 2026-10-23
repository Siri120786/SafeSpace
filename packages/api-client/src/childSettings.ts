// packages/api-client/src/childSettings.ts
// A signed-in child's own settings (docs/role-flow/CONTRACT.md section 10),
// through the child-settings Edge Function. Only the young person can change
// the sharing choice, and only at 15 or over (sharing_not_available_under_15).

import { ContractError, invokeEdge } from "./edge";
import type { AppSession, ChildSettings } from "@safespace/shared-types";

function requireChild(session: AppSession) {
  if (session?.kind !== "child") throw new ContractError("unsupported_session");
  return session;
}

export async function getMyChildSettings(session: AppSession): Promise<ChildSettings> {
  const s = requireChild(session);
  const data = await invokeEdge<{ settings: ChildSettings }>("child-settings", {
    action: "get",
    child_session_token: s.childSessionToken,
  });
  return data.settings;
}

// share: true = my caregivers can see my activity; false = they can't.
export async function setMySharing(session: AppSession, share: boolean): Promise<ChildSettings> {
  const s = requireChild(session);
  if (typeof share !== "boolean") throw new ContractError("invalid_input");
  const data = await invokeEdge<{ settings: ChildSettings }>("child-settings", {
    action: "set_sharing",
    child_session_token: s.childSessionToken,
    share,
  });
  return data.settings;
}
