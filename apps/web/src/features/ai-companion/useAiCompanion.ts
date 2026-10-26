import { useState, useEffect, useCallback, useRef } from "react";
import type {
  AppSession,
  LanguageCode,
  AiCompanionConversation,
  AiCompanionMessage,
} from "@safespace/shared-types";
import {
  sendAiCompanionMessage,
  listAiCompanionConversations,
  getAiCompanionMessages,
} from "@safespace/api-client";

// Error codes from the ai-companion Edge Function -> readable text.
const ERROR_TEXT: Record<string, string> = {
  ai_unavailable: "The companion can't reply right now. Your message wasn't saved, please try again in a moment.",
  rate_limited: "You're sending messages quickly. Please wait a minute and try again.",
  rate_limit_unavailable: "The companion is busy right now. Please try again in a moment.",
  message_too_long: "That message is too long. Please keep it under 2,000 characters.",
  missing_message_content: "Please type a message first.",
  conversation_not_found: "That conversation couldn't be found. Start a new chat instead.",
  unauthorized: "Your session has ended. Please log in again.",
  unsupported_session: "Please log in to use the companion.",
};

function readableError(err: unknown): string {
  const code = (err as Error)?.message ?? "";
  return ERROR_TEXT[code] ?? "Something went wrong. Please try again.";
}

// Stable identity for the signed-in person, so a token refresh (which creates
// a new session object) doesn't reload the whole chat.
function sessionKey(session: AppSession): string | null {
  if (session?.kind === "auth_user") return `user:${session.user.id}`;
  if (session?.kind === "child") return `child:${session.childId}`;
  return null;
}

export function useAiCompanion(session: AppSession) {
  const [conversations, setConversations] = useState<AiCompanionConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<AiCompanionConversation | null>(null);
  const [messages, setMessages] = useState<AiCompanionMessage[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>("en");
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [safetyNotice, setSafetyNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = sessionKey(session);
  // Always read the latest session without re-running effects on refresh.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  // Guards against an older messages request overwriting a newer one.
  const loadSeq = useRef(0);

  const refreshConversations = useCallback(async () => {
    if (!sessionRef.current) return [];
    const list = await listAiCompanionConversations(sessionRef.current);
    setConversations(list);
    return list;
  }, []);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    refreshConversations()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setActiveConversation((current) => current ?? list[0]);
        setSelectedLanguage((current) => list[0].preferredLanguage || current);
      })
      .catch((err) => !cancelled && setError(readableError(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [key, refreshConversations]);

  const activeId = activeConversation?.id ?? null;

  useEffect(() => {
    const seq = ++loadSeq.current;
    if (!activeId || !sessionRef.current) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError(null);
    getAiCompanionMessages(sessionRef.current, activeId)
      .then((msgs) => seq === loadSeq.current && setMessages(msgs))
      .catch((err) => seq === loadSeq.current && setError(readableError(err)))
      .finally(() => seq === loadSeq.current && setLoading(false));
  }, [activeId]);

  const selectConversation = (conv: AiCompanionConversation) => {
    if (sending) return;
    setActiveConversation(conv);
    if (conv.preferredLanguage) setSelectedLanguage(conv.preferredLanguage);
  };

  const startNewConversation = () => {
    if (sending) return;
    setActiveConversation(null);
    setMessages([]);
    setError(null);
  };

  // Resolves true when the message was sent, false when it failed (the input
  // keeps the text so nothing the user typed is lost).
  const sendMessage = async (content: string): Promise<boolean> => {
    const current = sessionRef.current;
    const text = content.trim();
    if (!current || !text || sending) return false;

    const pendingId = `pending-${Date.now()}`;
    const pending: AiCompanionMessage = {
      id: pendingId,
      conversationId: activeId ?? "",
      sender: "user",
      content: text,
      language: selectedLanguage,
      isSafetyResponse: false,
      createdAt: new Date().toISOString(),
    };

    setSending(true);
    setError(null);
    setMessages((prev) => [...prev, pending]);

    try {
      const res = await sendAiCompanionMessage(current, {
        conversationId: activeId,
        content: text,
        language: selectedLanguage,
      });
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== pendingId),
        res.userMessage,
        res.assistantMessage,
      ]);
      setActiveConversation(res.conversation);
      // A child's caregivers were alerted: say so gently under the safety reply.
      setSafetyNotice(res.safetyNotice);
      refreshConversations().catch(() => {});
      return true;
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));
      setError(readableError(err));
      return false;
    } finally {
      setSending(false);
    }
  };

  return {
    conversations,
    activeConversation,
    messages,
    selectedLanguage,
    setSelectedLanguage,
    loading,
    sending,
    error,
    safetyNotice,
    selectConversation,
    startNewConversation,
    sendMessage,
    refreshConversations,
  };
}
