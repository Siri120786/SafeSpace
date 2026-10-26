import React, { useState } from "react";
import type { AppSession } from "@safespace/shared-types";
import { useAiCompanion } from "./useAiCompanion";
import { LanguageSelector } from "./LanguageSelector";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { langTag } from "../speech";
import { BrainMascot } from "../../components/vectors/BrainMascot";

interface ChatWindowProps {
  session: AppSession;
  className?: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ session, className = "" }) => {
  const {
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
  } = useAiCompanion(session);

  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className={`flex flex-col bg-gradient-to-b from-cream/60 via-white to-paleLime/30 rounded-3xl border border-white shadow-card overflow-hidden h-[600px] max-h-[80vh] ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-olive-100/80 bg-white/80 backdrop-blur-md flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-olive-400 to-deepGreen text-white flex items-center justify-center shadow-xs">
              <BrainMascot stance="happy" size={28} />
            </div>
            <div>
              <h3 className="font-display text-base font-medium text-textHeading flex items-center gap-2">
                SafeSpace AI Companion
                <span className="text-[10px] bg-paleLime text-deepGreen font-semibold px-2 py-0.5 rounded-full border border-olive-200">
                  V1 Beta
                </span>
              </h3>
              <p className="text-xs text-textMuted font-light">
                {activeConversation?.title || "New conversation"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              aria-expanded={showHistory}
              className="p-2 rounded-xl text-textBody hover:bg-olive-50 border border-olive-100 transition-colors text-xs font-medium flex items-center gap-1.5"
              title="Conversation History"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">History ({conversations.length})</span>
            </button>

            <button
              onClick={startNewConversation}
              disabled={sending}
              className="px-3 py-2 rounded-xl bg-olive-500 text-white hover:bg-deepGreen transition-colors text-xs font-medium flex items-center gap-1.5 shadow-xs"
            >
              <span>+ New Chat</span>
            </button>
          </div>
        </div>

        {/* Language Selection Bar */}
        <div className="flex items-center gap-2 pt-1 border-t border-olive-50">
          <span className="text-[11px] font-medium text-textMuted shrink-0">Language:</span>
          <LanguageSelector
            selectedLanguage={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
          />
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Messages */}
        <div className="flex-1 flex flex-col min-w-0">
          {error && (
            <div role="alert" className="m-3 p-3 bg-red-50 text-red-600 rounded-xl text-xs border border-red-200 shrink-0">
              {error}
            </div>
          )}

          {loading && messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-textMuted gap-2">
              <svg className="animate-spin h-4 w-4 text-olive-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Loading messages...</span>
            </div>
          ) : (
            <MessageList messages={messages} sending={sending} />
          )}

          {safetyNotice && (
            <p role="status" className="mx-3 mb-2 rounded-2xl bg-sky-50 border border-sky-200 px-4 py-2.5 text-sm font-semibold text-botanical-800">
              {safetyNotice}
            </p>
          )}

          {/* Input Footer */}
          <div className="p-3 bg-white/60 backdrop-blur-xs border-t border-olive-100 shrink-0">
            <MessageInput onSendMessage={sendMessage} disabled={sending} lang={langTag(selectedLanguage)} />
            <p className="mt-2 px-1 text-[10px] leading-snug text-textMuted">
              SafeSpace Companion is an AI, not a therapist or doctor, and can make mistakes.
              If you might be in danger, call 112. For free mental health support in India, call Tele-MANAS on 14416.
            </p>
          </div>
        </div>

        {/* Conversation History Drawer Overlay */}
        {showHistory && (
          <div className="absolute inset-y-0 right-0 w-64 bg-white border-l border-olive-100 shadow-xl z-20 flex flex-col p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-olive-100">
              <h4 className="font-display text-sm font-medium text-textHeading">Past Conversations</h4>
              <button onClick={() => setShowHistory(false)} aria-label="Close history" className="text-textMuted hover:text-textHeading text-xs font-bold">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
              {conversations.length === 0 ? (
                <p className="text-xs text-textMuted italic p-2">No history found.</p>
              ) : (
                conversations.map((c) => {
                  const isSelected = activeConversation?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        selectConversation(c);
                        setShowHistory(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-all ${
                        isSelected
                          ? "bg-olive-50 font-semibold text-deepGreen border border-olive-200"
                          : "text-textBody hover:bg-gray-50 border border-transparent"
                      }`}
                    >
                      <div className="truncate">{c.title || "Untitled Chat"}</div>
                      <div className="text-[10px] text-textMuted font-light mt-0.5">
                        {new Date(c.updatedAt).toLocaleDateString()}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
