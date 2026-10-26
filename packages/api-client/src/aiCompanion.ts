// packages/api-client/src/aiCompanion.ts
// AI Companion API client bindings. Every operation goes through the
// ai-companion Edge Function; the tables are read-only for clients.
//
// Adults: the Supabase client attaches the CURRENT access token itself (it
// refreshes hourly), so no token is copied out of the session here.
// Children: the signed child-session token travels in the body.

import { getSafeSpaceClient } from "./supabaseClient";
import type {
  AppSession,
  LanguageCode,
  AiCompanionConversation,
  AiCompanionMessage,
  AiCompanionSendResult,
} from "@safespace/shared-types";

async function invokeAiCompanion(session: AppSession, body: Record<string, unknown>) {
  if (session?.kind === "child") {
    body = { ...body, child_session_token: session.childSessionToken };
  } else if (session?.kind !== "auth_user") {
    throw new Error("unsupported_session");
  }

  const supabase = getSafeSpaceClient();
  const { data, error } = await supabase.functions.invoke("ai-companion", { body });
  if (error) {
    // Non-2xx responses carry our { error } code in the response body.
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === "function"
      ? await ctx.json().catch(() => null)
      : null;
    throw new Error(payload?.error ?? error.message);
  }
  return data;
}

export async function sendAiCompanionMessage(
  session: AppSession,
  input: {
    conversationId?: string | null;
    content: string;
    language?: LanguageCode;
  }
): Promise<AiCompanionSendResult> {
  const data = await invokeAiCompanion(session, {
    action: "send_message",
    conversation_id: input.conversationId ?? null,
    content: input.content,
    language: input.language || "en",
  });
  return {
    conversation: data.conversation,
    userMessage: data.userMessage,
    assistantMessage: data.assistantMessage,
    safetyResponse: data.safetyResponse === true,
    caregiverAlerted: data.caregiverAlerted === true,
    safetyNotice: typeof data.safetyNotice === "string" ? data.safetyNotice : null,
  };
}

export async function listAiCompanionConversations(
  session: AppSession
): Promise<AiCompanionConversation[]> {
  if (!session) return [];
  const data = await invokeAiCompanion(session, { action: "list_conversations" });
  return data.conversations || [];
}

export async function getAiCompanionMessages(
  session: AppSession,
  conversationId: string
): Promise<AiCompanionMessage[]> {
  if (!session || !conversationId) return [];
  const data = await invokeAiCompanion(session, {
    action: "get_messages",
    conversation_id: conversationId,
  });
  return data.messages || [];
}
