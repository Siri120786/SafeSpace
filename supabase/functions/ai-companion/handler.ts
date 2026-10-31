// supabase/functions/ai-companion/handler.ts
// Request logic for the ai-companion Edge Function, separated from its side
// effects (database, Supabase Auth, child tokens, the model, logging), which
// are injected. index.ts wires the real implementations; the tests in
// supabase/tests/ai_companion_handler.test.mts wire in-memory fakes. No Deno or
// esm.sh imports here, so it runs under Node.
//
// Actions:
//   list_conversations  {}
//   get_messages        { conversation_id }
//   send_message        { conversation_id?, content, language? }
//
// send_message flow: validate -> identity -> ownership -> crisis screen ->
// (non-crisis only) take a rate-limit slot -> reply (fixed safety message, or
// the model) -> store both messages. If the model is not configured or fails,
// nothing is stored and the client gets ai_unavailable, so there is never a
// fake "assistant" reply in the history; the attempt still used its slot.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";
import {
  HISTORY_LIMIT,
  MAX_BODY_BYTES,
  RATE_LIMIT_PER_MINUTE,
  buildSystemPrompt,
  makeTitle,
  parseRequest,
  safetyMessage,
  screenForCrisis,
  validateUserMessage,
  type HistoryMessage,
  type LanguageCode,
} from "../_shared/aiCompanion.ts";
import { escalateChildText, type RaiseSafetyAlert, type SafetyNotice } from "../_shared/safety.ts";

export type Owner = { column: "profile_id" | "child_id"; id: string };

// Raw ai_companion_* rows (snake_case), as PostgREST returns them.
export interface ConversationRow {
  id: string;
  profile_id: string | null;
  child_id: string | null;
  title: string;
  language: string;
  created_at: string;
  updated_at: string;
}
export interface MessageRow {
  id: string;
  conversation_id: string;
  sender: "user" | "assistant";
  content: string;
  detected_language: string | null;
  is_safety_response: boolean;
  created_at: string;
}
export interface NewMessage {
  conversation_id: string;
  sender: "user" | "assistant";
  content: string;
  detected_language: LanguageCode;
  is_safety_response: boolean;
  created_at: string;
}

export interface AiCompanionStore {
  listConversations(owner: Owner, limit: number): Promise<ConversationRow[]>;
  // null for "missing" and "someone else's" alike, so ids can't be probed.
  getOwnedConversation(owner: Owner, id: string): Promise<ConversationRow | null>;
  listMessages(conversationId: string): Promise<MessageRow[]>;
  // Newest-last; may return [] if history can't be read.
  recentHistory(conversationId: string, limit: number): Promise<HistoryMessage[]>;
  // true = slot taken, false = over the limit. MUST throw if the check can't
  // be completed; the handler then fails closed.
  takeRateLimitSlot(owner: Owner, limit: number, windowSeconds: number): Promise<boolean>;
  createConversation(owner: Owner, title: string, language: LanguageCode): Promise<ConversationRow>;
  // Inserts both messages atomically; returns the stored rows.
  insertMessages(rows: [NewMessage, NewMessage]): Promise<MessageRow[]>;
  touchConversation(id: string, language: LanguageCode): Promise<ConversationRow | null>;
}

export interface AiCompanionDeps {
  store: AiCompanionStore;
  // Verifies an "Authorization: Bearer <jwt>" header with Supabase Auth.
  authenticateAdult(authorizationHeader: string): Promise<string | null>;
  verifyChildToken(token: string): Promise<string | null>;
  // Returns the reply text, or null if the model is unavailable, failed or
  // blocked the request.
  askModel(systemPrompt: string, history: HistoryMessage[]): Promise<string | null>;
  // Receives a fixed event name and an error name/code only: never message
  // content, tokens or raw error objects.
  log(event: string, detail?: string): void;
  now?: () => number;
  // Raises the caregiver alert for a child's crisis-screen match
  // (raise_safety_alert). Children only; absent means no alert is raised.
  raiseSafetyAlert?: RaiseSafetyAlert;
}

export const RATE_LIMIT_WINDOW_SECONDS = 60;
const LIST_LIMIT = 50;

// errorSummary moved to _shared/errors.ts so other functions can use it;
// re-exported here so existing imports (index.ts) keep working.
export { errorSummary };

function toConversation(c: ConversationRow) {
  return {
    id: c.id,
    profileId: c.profile_id,
    childId: c.child_id,
    preferredLanguage: c.language,
    title: c.title,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

function toMessage(m: MessageRow, fallbackLang: string) {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    sender: m.sender,
    content: m.content,
    language: m.detected_language || fallbackLang,
    isSafetyResponse: m.is_safety_response === true,
    createdAt: m.created_at,
  };
}

export function createAiCompanionHandler(deps: AiCompanionDeps) {
  const { store, log } = deps;
  const now = deps.now ?? Date.now;

  async function resolveOwner(req: Request, childSessionToken: string | null): Promise<Owner | null> {
    if (childSessionToken) {
      const childId = await deps.verifyChildToken(childSessionToken);
      return childId ? { column: "child_id", id: childId } : null;
    }
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return null;
    const userId = await deps.authenticateAdult(authHeader);
    return userId ? { column: "profile_id", id: userId } : null;
  }

  return async function handle(req: Request): Promise<Response> {
    const pre = preflight(req); if (pre) return pre;
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    try {
      // Malformed requests are rejected (400/401/413) before any identity or
      // database work, so bad input can never surface as a 500.
      const declaredLength = Number(req.headers.get("Content-Length") ?? 0);
      if (declaredLength > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      const text = await req.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return json({ error: "invalid_request" }, 400);
      }
      const parsed = parseRequest(raw);
      if (!parsed.ok) return json({ error: parsed.error }, parsed.status);
      const { action, childSessionToken, conversationId, language: lang } = parsed.value;

      const owner = await resolveOwner(req, childSessionToken);
      if (!owner) return json({ error: "unauthorized" }, 401);

      if (action === "list_conversations") {
        const rows = await store.listConversations(owner, LIST_LIMIT);
        return json({ conversations: rows.map(toConversation) });
      }

      if (action === "get_messages") {
        const conv = await store.getOwnedConversation(owner, conversationId!);
        if (!conv) return json({ error: "conversation_not_found" }, 404);
        const rows = await store.listMessages(conv.id);
        return json({ messages: rows.map((m) => toMessage(m, conv.language)) });
      }

      // action === "send_message"
      const validation = validateUserMessage(parsed.value.content);
      if (!validation.ok) return json({ error: validation.error }, 400);
      const content = validation.value;

      let conv: ConversationRow | null = null;
      if (conversationId) {
        conv = await store.getOwnedConversation(owner, conversationId);
        if (!conv) return json({ error: "conversation_not_found" }, 404);
      }

      // Crisis-screen matches are exempt from the ordinary limit: the reply is
      // a fixed message (no model call), and refusing it would be the worse
      // failure. The screen itself is narrow (see _shared/aiCompanion.ts), not
      // a complete or multilingual crisis detector.
      const isCrisis = screenForCrisis(content);
      let reply: string | null;
      let childAlert: SafetyNotice | null = null;
      if (isCrisis) {
        reply = safetyMessage(lang);
        // A child's caregivers get an in-app alert naming where, never what.
        if (owner.column === "child_id" && deps.raiseSafetyAlert) {
          childAlert = await escalateChildText(content, owner.id, "companion_flag", deps.raiseSafetyAlert, log);
        }
      } else {
        // Taken BEFORE the model, so failed or blocked model calls still
        // count. Fails CLOSED: if the check can't complete, refuse.
        let allowed: boolean;
        try {
          allowed = await store.takeRateLimitSlot(owner, RATE_LIMIT_PER_MINUTE, RATE_LIMIT_WINDOW_SECONDS);
        } catch (e) {
          log("rate_limit_slot_failed", errorSummary(e));
          return json({ error: "rate_limit_unavailable" }, 503);
        }
        if (!allowed) return json({ error: "rate_limited" }, 429);

        const history = conv ? await store.recentHistory(conv.id, HISTORY_LIMIT - 1) : [];
        history.push({ sender: "user", content });
        const audience = owner.column === "child_id" ? "child" : "adult";
        reply = await deps.askModel(buildSystemPrompt(lang, audience), history);
        if (!reply) return json({ error: "ai_unavailable" }, 503);
      }

      // Only now that a real reply exists is anything written.
      if (!conv) conv = await store.createConversation(owner, makeTitle(content), lang);

      const t = now();
      const stored = await store.insertMessages([
        { conversation_id: conv.id, sender: "user", content, detected_language: lang,
          is_safety_response: isCrisis, created_at: new Date(t).toISOString() },
        { conversation_id: conv.id, sender: "assistant", content: reply, detected_language: lang,
          is_safety_response: isCrisis, created_at: new Date(t + 1).toISOString() },
      ]);
      const userMsg = stored.find((m) => m.sender === "user");
      const assistantMsg = stored.find((m) => m.sender === "assistant");
      if (!userMsg || !assistantMsg) throw new Error("message_insert_incomplete");

      // updated_at is maintained by the database trigger.
      const updatedConv = await store.touchConversation(conv.id, lang);

      return json({
        conversation: toConversation(updatedConv ?? conv),
        userMessage: toMessage(userMsg, lang),
        assistantMessage: toMessage(assistantMsg, lang),
        safetyResponse: isCrisis,
        caregiverAlerted: childAlert?.caregiverAlerted === true,
        safetyNotice: childAlert?.notice ?? null,
      });
    } catch (e) {
      // Name/code only: never content, tokens or raw error objects.
      log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
