// supabase/functions/games/handler.ts
// Child-facing Games Corner storage (Sprint 4). Children have no Supabase
// login, so this verifies the signed child-session token, derives the child_id
// from it, and reads/writes ONLY that child's progress and preferences with
// the service role. Game rules never run here: the apps play locally and
// save one short record when a round finishes. Adults use the tables directly
// under RLS.
//
// Actions:
//   get_state         { child_session_token }
//   record_round      { child_session_token, game_id, difficulty, score }
//   save_preferences  { child_session_token, preferences: { difficulty,
//                       reduced_motion, sound_enabled, voice_enabled } }
//
// No Deno or esm.sh imports here; index.ts wires the real dependencies and
// supabase/tests/games_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";
import {
  parseGamesRequest,
  shapePreferences,
  shapeProgress,
  type PreferencesInput,
  type PreferencesRow,
  type ProgressRow,
} from "../_shared/games.ts";

export interface ChildGamesStore {
  listProgress(childId: string): Promise<ProgressRow[]>;
  getPreferences(childId: string): Promise<PreferencesRow | null>;
  recordRound(childId: string, gameId: string, difficulty: string, score: number | null): Promise<void>;
  savePreferences(childId: string, prefs: PreferencesInput): Promise<void>;
}

export interface GamesDeps {
  store: ChildGamesStore;
  verifyChildToken(token: string): Promise<string | null>;
  log(event: string, detail?: string): void;
}

export const MAX_BODY_BYTES = 2048;

export function createGamesHandler(deps: GamesDeps) {
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
      const parsed = parseGamesRequest(raw);
      if (!parsed.ok) return json({ error: parsed.error }, parsed.status);

      const childId = await deps.verifyChildToken(parsed.childSessionToken);
      if (!childId) return json({ error: "invalid_session" }, 401);

      const request = parsed.value;
      if (request.action === "get_state") {
        const [progress, preferences] = await Promise.all([deps.store.listProgress(childId), deps.store.getPreferences(childId)]);
        return json({ progress: shapeProgress(progress), preferences: shapePreferences(preferences) });
      }
      if (request.action === "record_round") {
        await deps.store.recordRound(childId, request.gameId, request.difficulty, request.score);
        return json({ ok: true });
      }
      await deps.store.savePreferences(childId, request.preferences);
      return json({ ok: true });
    } catch (e) {
      deps.log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
