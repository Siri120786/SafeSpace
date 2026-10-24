// supabase/functions/story-writer/handler.ts
// Gemini drafts a social story for a caregiver or Individual (role-flow 6b).
// Nothing is stored here: the draft goes back to the editor, and only the
// stories function saves it, after the adult has checked it.
//
//   POST { prompt, age_band? }   Authorization: Bearer <jwt>
//
// Flow: validate -> identity -> crisis screen on the prompt -> take a daily
// slot (10 per rolling 24 hours; a failed draft still counts) -> Gemini ->
// check the script; if it fails, ask Gemini once more with the problems ->
// the script, or ai_unavailable. No prompt or story text is logged.
//
// No Deno or esm.sh imports; index.ts wires the real dependencies and
// supabase/tests/story_writer_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";
import {
  DAILY_DRAFT_LIMIT,
  DRAFT_WINDOW_SECONDS,
  firstTurn,
  parseWriterRequest,
  promptIsUnsuitable,
  readModelScript,
  retryTurn,
  type AgeBand,
  type WriterTurn,
} from "../_shared/storyWriter.ts";

export interface StoryWriterDeps {
  authenticateAdult(authorizationHeader: string): Promise<string | null>;
  // Atomic; throws on failure so the handler fails closed.
  takeSlot(userId: string, limit: number, windowSeconds: number): Promise<boolean>;
  // The model's text, or null when it's unavailable, fails or is blocked.
  askModel(ageBand: AgeBand, turns: WriterTurn[]): Promise<string | null>;
  log(event: string, detail?: string): void;
}

export const MAX_BODY_BYTES = 4096;

export function createStoryWriterHandler(deps: StoryWriterDeps) {
  const { log } = deps;

  return async function handle(req: Request): Promise<Response> {
    const pre = preflight(req); if (pre) return pre;
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    try {
      const text = await req.text();
      if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      let raw: unknown;
      try { raw = JSON.parse(text); } catch { return json({ error: "invalid_request" }, 400); }
      const parsed = parseWriterRequest(raw);
      if (!parsed.ok) return json({ error: parsed.error }, parsed.status);

      const auth = req.headers.get("Authorization");
      const userId = auth ? await deps.authenticateAdult(auth) : null;
      if (!userId) return json({ error: "unauthorized" }, 401);

      // Before the slot: an unsuitable prompt never reaches the model.
      if (promptIsUnsuitable(parsed.value.prompt)) return json({ error: "not_suitable" }, 422);

      if (!(await deps.takeSlot(userId, DAILY_DRAFT_LIMIT, DRAFT_WINDOW_SECONDS))) {
        return json({ error: "daily_limit_reached" }, 429);
      }

      const turns: WriterTurn[] = [firstTurn(parsed.value.prompt)];
      for (let attempt = 1; attempt <= 2; attempt++) {
        const reply = await deps.askModel(parsed.value.ageBand, turns);
        if (reply === null) {
          log("model_unavailable", `attempt ${attempt}`);
          return json({ error: "ai_unavailable" }, 503);
        }
        const result = readModelScript(reply);
        if (result.ok) return json({ script: result.story });
        log("draft_rejected", `attempt ${attempt}, ${result.errors.length} problems`);
        turns.push({ role: "model", text: reply }, retryTurn(result.errors));
      }
      return json({ error: "ai_unavailable" }, 503);
    } catch (e) {
      log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
