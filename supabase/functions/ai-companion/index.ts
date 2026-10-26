// supabase/functions/ai-companion/index.ts
// AI Companion Edge Function: wiring only. The request logic lives in
// ./handler.ts; this file supplies the real side effects:
//   - store: ai_companion_* tables via the service role (the only writer;
//     clients have read-only RLS access)
//   - adult identity: Supabase Auth (JWT in the Authorization header)
//   - child identity: the signed child-session token (_shared/childToken.ts)
//   - model: Gemini, server-side only (key never leaves this function)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { childSessionVerifier, sessionVersionLookup } from "../_shared/childSession.ts";
import { buildGeminiRequest, extractGeminiText, type HistoryMessage } from "../_shared/aiCompanion.ts";
import {
  createAiCompanionHandler,
  errorSummary,
  type AiCompanionStore,
  type Owner,
} from "./handler.ts";

// gemini-2.5-flash is no longer available to new API keys (404). The 3.x
// "flash" models spend most of the 600-token output budget on hidden thinking
// and were badly overloaded when tested (Oct 2026); flash-lite answers in ~1-2 s
// with no thinking overhead. Override per environment with GEMINI_MODEL.
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const MODEL_TIMEOUT_MS = 20_000;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Signature, expiry AND session version (a PIN reset ends sessions).
const verifyChildToken = childSessionVerifier(sessionVersionLookup(admin));

const log = (event: string, detail?: string) =>
  console.error(`ai-companion: ${event}${detail ? ` (${detail})` : ""}`);

const store: AiCompanionStore = {
  async listConversations(owner: Owner, limit: number) {
    const { data, error } = await admin.from("ai_companion_conversations")
      .select("*").eq(owner.column, owner.id)
      .order("updated_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async getOwnedConversation(owner: Owner, id: string) {
    const { data } = await admin.from("ai_companion_conversations")
      .select("*").eq("id", id).eq(owner.column, owner.id).maybeSingle();
    return data ?? null;
  },

  async listMessages(conversationId: string) {
    const { data, error } = await admin.from("ai_companion_messages")
      .select("*").eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async recentHistory(conversationId: string, limit: number) {
    const { data } = await admin.from("ai_companion_messages")
      .select("sender, content").eq("conversation_id", conversationId)
      .order("created_at", { ascending: false }).limit(limit);
    return ((data ?? []) as HistoryMessage[]).reverse();
  },

  // ai_companion_take_slot (migration 20261021000000): atomic, per identity,
  // service role only. Throws on any failure so the handler fails closed.
  async takeRateLimitSlot(owner: Owner, limit: number, windowSeconds: number) {
    const { data, error } = await admin.rpc("ai_companion_take_slot", {
      p_profile_id: owner.column === "profile_id" ? owner.id : null,
      p_child_id: owner.column === "child_id" ? owner.id : null,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    if (typeof data !== "boolean") throw new Error("unexpected_rate_limit_result");
    return data;
  },

  async createConversation(owner: Owner, title: string, language: string) {
    const { data, error } = await admin.from("ai_companion_conversations")
      .insert({ [owner.column]: owner.id, title, language })
      .select("*").single();
    if (error || !data) throw error ?? new Error("conversation_insert_failed");
    return data;
  },

  async insertMessages(rows) {
    const { data, error } = await admin.from("ai_companion_messages").insert(rows).select("*");
    if (error || !data || data.length !== 2) throw error ?? new Error("message_insert_failed");
    return data;
  },

  async touchConversation(id: string, language: string) {
    const { data } = await admin.from("ai_companion_conversations")
      .update({ language }).eq("id", id).select("*").single();
    return data ?? null;
  },
};

async function authenticateAdult(authorizationHeader: string): Promise<string | null> {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!anonKey) return null;
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorizationHeader } },
  });
  const { data, error } = await authClient.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

async function askGemini(systemPrompt: string, history: HistoryMessage[]): Promise<string | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return null;
  const model = Deno.env.get("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(buildGeminiRequest(systemPrompt, history)),
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      log("model_http_error", String(res.status));
      return null;
    }
    return extractGeminiText(await res.json());
  } catch (e) {
    log("model_call_failed", errorSummary(e));
    return null;
  }
}

serve(createAiCompanionHandler({
  store,
  authenticateAdult,
  verifyChildToken,
  askModel: askGemini,
  log,
  raiseSafetyAlert: async (childId, source) => {
    const { data, error } = await admin.rpc("raise_safety_alert", { p_child_id: childId, p_source: source });
    if (error) throw error;
    return data as string;
  },
}));
