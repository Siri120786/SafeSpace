import React, { useState } from "react";
import { getChildAiMessages } from "@safespace/api-client";
import type { AiCompanionConversation, AiCompanionMessage } from "@safespace/shared-types";
import { formatAlertTime } from "../alertsView";

interface Props {
  childId: string;
  childName: string;
  conversations: AiCompanionConversation[];
}

// A child's AI Companion chats for their caregivers: read-only, each one
// collapsed until opened, messages fetched only then.
export const AiChatList: React.FC<Props> = ({ childId, childName, conversations }) => {
  if (conversations.length === 0) {
    return <p className="text-sm text-textMuted">{childName} hasn't chatted with the AI Companion yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {conversations.map((c) => (
        <li key={c.id}>
          <Conversation childId={childId} childName={childName} conversation={c} />
        </li>
      ))}
    </ul>
  );
};

const Conversation: React.FC<{ childId: string; childName: string; conversation: AiCompanionConversation }> = ({
  childId,
  childName,
  conversation,
}) => {
  const [messages, setMessages] = useState<AiCompanionMessage[] | null>(null);
  const [error, setError] = useState(false);

  async function onToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!e.currentTarget.open || messages) return;
    try {
      setMessages(await getChildAiMessages(childId, conversation.id));
      setError(false);
    } catch {
      setError(true);
    }
  }

  return (
    <details onToggle={onToggle} className="group rounded-2xl border border-olive-100 bg-white">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm">
        <span className="font-medium text-textHeading">{conversation.title}</span>
        <span className="text-xs text-textMuted">{formatAlertTime(conversation.updatedAt)}</span>
      </summary>
      <div className="border-t border-olive-100 px-4 py-3 space-y-2">
        {error && <p className="text-sm text-red-700">Couldn't load this chat right now.</p>}
        {!messages && !error && <p className="text-sm text-textMuted">Loading...</p>}
        {messages?.length === 0 && <p className="text-sm text-textMuted">No messages.</p>}
        {messages?.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              m.sender === "user" ? "ml-auto bg-olive-50 text-textHeading" : "bg-cream text-textBody"
            }`}
          >
            <span className="block text-[11px] font-semibold text-textMuted">
              {m.sender === "user" ? childName : "AI Companion"}
              {m.isSafetyResponse && " · safety message"}
            </span>
            <span className="whitespace-pre-wrap break-words">{m.content}</span>
          </div>
        ))}
      </div>
    </details>
  );
};
