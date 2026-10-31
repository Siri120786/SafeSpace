// supabase/functions/recommendations/handler.ts
// Rule-based "try this next" suggestions for an Individual's or a child's own
// home. Who is asking comes from the signed child session (children) or the
// Supabase Auth JWT (adults); the data is that person's own wellness summary
// (counts only) and modules. The rules live in ../_shared/recommendations.ts.
// No AI, no new keys, nothing stored.
//
// Action:
//   get { child_session_token?, to: "YYYY-MM-DD", timezone: IANA, local_hour: 0-23 }
//   Adults send no child_session_token and an Authorization header.
//
// No Deno or esm.sh imports; index.ts wires the real dependencies and
// supabase/tests/recommendations_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";
import { isValidLocalDate } from "../_shared/routines.ts";
import { recommend, type Audience, type SummaryCounts } from "../_shared/recommendations.ts";

export type Owner = { kind: "child"; childId: string } | { kind: "adult"; profileId: string; authorization: string };

export interface RecommendationsStore {
  // The owner's 7-day wellness_summary. Throws Error("invalid_input") for
  // inputs the database rejects (e.g. an unknown timezone).
  summary(owner: Owner, to: string, timezone: string): Promise<SummaryCounts>;
  // Module keys: a child's assigned modules, an adult's support areas.
  modules(owner: Owner): Promise<string[]>;
}

export interface RecommendationsDeps {
  store: RecommendationsStore;
  verifyChildToken(token: string): Promise<string | null>;
  // Resolves an Authorization header to the adult's profile id, or null.
  authenticateAdult(authorization: string): Promise<string | null>;
  log(event: string, detail?: string): void;
  now?: () => Date;
}

export const MAX_BODY_BYTES = 2048;
const TIMEZONE_RE = /^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/;

export function createRecommendationsHandler(deps: RecommendationsDeps) {
  const now = deps.now ?? (() => new Date());
  return async function handle(req: Request): Promise<Response> {
    const pre = preflight(req); if (pre) return pre;
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    try {
      const text = await req.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return json({ error: "invalid_request" }, 400);
      }
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return json({ error: "invalid_request" }, 400);
      const b = raw as Record<string, unknown>;
      if ((b.action ?? "get") !== "get") return json({ error: "invalid_action" }, 400);
      if (!isValidLocalDate(b.to) || typeof b.timezone !== "string" || !TIMEZONE_RE.test(b.timezone) ||
          !Number.isInteger(b.local_hour) || (b.local_hour as number) < 0 || (b.local_hour as number) > 23) {
        return json({ error: "invalid_input" }, 400);
      }

      // Who is asking: the child session wins when present; otherwise the adult's JWT.
      let owner: Owner;
      let audience: Audience;
      if (b.child_session_token !== undefined) {
        if (typeof b.child_session_token !== "string" || !b.child_session_token) return json({ error: "invalid_session" }, 401);
        const childId = await deps.verifyChildToken(b.child_session_token);
        if (!childId) return json({ error: "invalid_session" }, 401);
        owner = { kind: "child", childId };
        audience = "child";
      } else {
        const authorization = req.headers.get("Authorization") ?? "";
        const profileId = authorization.startsWith("Bearer ") ? await deps.authenticateAdult(authorization) : null;
        if (!profileId) return json({ error: "invalid_session" }, 401);
        owner = { kind: "adult", profileId, authorization };
        audience = "individual";
      }

      let summary: SummaryCounts;
      try {
        summary = await deps.store.summary(owner, b.to as string, b.timezone);
      } catch (e) {
        if ((e as Error)?.message === "invalid_input") return json({ error: "invalid_input" }, 400);
        throw e;
      }
      const modules = await deps.store.modules(owner);
      const recommendations = recommend({ audience, modules, summary, localHour: b.local_hour as number, now: now() });
      return json({ recommendations });
    } catch (e) {
      deps.log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
