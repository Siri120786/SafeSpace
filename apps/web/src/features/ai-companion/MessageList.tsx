import React, { useEffect, useRef } from "react";
import type { AiCompanionMessage } from "@safespace/shared-types";
import { BrainMascot } from "../../components/vectors/BrainMascot";
import { ReadAloudButton, langTag } from "../speech";

interface MessageListProps {
  messages: AiCompanionMessage[];
  sending?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, sending = false }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  if (messages.length === 0 && !sending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 my-auto">
        <BrainMascot stance="happy" size={100} showBubble={true} bubbleText="Hi! How are you feeling today?" />
        <div className="max-w-xs space-y-1">
          <h4 className="font-display text-base font-medium text-textHeading">Start a conversation</h4>
          <p className="text-xs text-textMuted font-light">
            I'm here to listen, support, and help you reset. Select your preferred language above and send a message.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-4 p-4 scrollbar-thin" role="log" aria-live="polite" aria-label="Conversation">
      {messages.map((msg) => {
        const isUser = msg.sender === "user";
        const isSafety = !isUser && msg.isSafetyResponse;
        return (
          <div
            key={msg.id}
            className={`flex items-end gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
          >
            {!isUser && (
              <div className="w-8 h-8 rounded-full bg-paleLime/80 border border-olive-200 flex items-center justify-center shrink-0 shadow-xs">
                <BrainMascot stance="happy" size={24} />
              </div>
            )}
            <div
              className={`max-w-[80%] sm:max-w-[70%] rounded-2xl p-3.5 text-sm font-sans shadow-xs ${
                isUser
                  ? "bg-darkBtn text-white rounded-br-none"
                  : isSafety
                  ? "bg-amber-50 text-textHeading rounded-bl-none border-2 border-amber-300"
                  : "bg-white text-textHeading rounded-bl-none border border-olive-100"
              }`}
            >
              {isSafety && (
                <p className="text-[11px] font-semibold text-amber-800 mb-1">Support information</p>
              )}
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              <span
                className={`flex items-center justify-end gap-2 text-[10px] mt-1 font-light ${
                  isUser ? "text-white/60" : "text-textMuted/70"
                }`}
              >
                {!isUser && <ReadAloudButton text={msg.content} lang={langTag(msg.language)} label="Read this reply aloud" />}
                {formatTime(msg.createdAt)}
              </span>
            </div>
          </div>
        );
      })}

      {sending && (
        <div className="flex items-end gap-2.5 justify-start">
          <div className="w-8 h-8 rounded-full bg-paleLime/80 border border-olive-200 flex items-center justify-center shrink-0 shadow-xs">
            <BrainMascot stance="meditating" size={24} />
          </div>
          <div className="bg-white text-textHeading rounded-2xl rounded-bl-none p-3.5 border border-olive-100 shadow-xs flex items-center gap-1.5">
            <span className="w-2 h-2 bg-olive-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-olive-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-olive-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
