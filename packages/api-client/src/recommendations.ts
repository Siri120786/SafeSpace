// packages/api-client/src/recommendations.ts
// Rule-based "try this next" suggestions for the signed-in Individual or
// child, from the recommendations Edge Function. It reads that person's own
// 7-day wellness summary (counts only) and modules; nothing is stored.

import { ContractError, invokeEdge } from "./edge";
import type { AppSession, Recommendation } from "@safespace/shared-types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Up to three suggestions, most relevant first. Adults send their JWT automatically. */
export async function getRecommendations(session: AppSession, now: Date = new Date()): Promise<Recommendation[]> {
  if (session?.kind !== "child" && session?.kind !== "auth_user") throw new ContractError("unsupported_session");
  const body: Record<string, unknown> = {
    action: "get",
    to: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    local_hour: now.getHours(),
  };
  if (session.kind === "child") body.child_session_token = session.childSessionToken;
  const data = await invokeEdge<{ recommendations: Recommendation[] }>("recommendations", body);
  return data.recommendations ?? [];
}
