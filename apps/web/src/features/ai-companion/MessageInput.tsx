import React, { useState } from "react";
import { MicButton, appendTranscript } from "../speech";

const MAX_LENGTH = 2000;

interface MessageInputProps {
  // Resolves false when sending failed, so the typed text is put back.
  onSendMessage: (content: string) => Promise<boolean>;
  disabled?: boolean;
  placeholder?: string;
  lang?: string; // dictation language, from the chosen chat language
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = "Type your message...",
  lang,
}) => {
  const [text, setText] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || disabled) return;
    setText("");
    const sent = await onSendMessage(content);
    if (!sent) setText(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const nearLimit = text.length > MAX_LENGTH * 0.9;

  return (
    <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-white p-2 rounded-2xl border border-olive-200 shadow-sm">
      <label htmlFor="ai-companion-input" className="sr-only">Message</label>
      <textarea
        id="ai-companion-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={MAX_LENGTH}
        rows={1}
        className="w-full resize-none bg-transparent px-3 py-2 text-sm text-textHeading placeholder:text-textMuted/60 focus:outline-none max-h-32 min-h-[40px] font-sans"
      />
      {/* Speak instead of typing: words go into the box to check before sending. */}
      <MicButton
        lang={lang}
        disabled={disabled}
        onText={(spoken) => setText((t) => appendTranscript(t, spoken, MAX_LENGTH))}
        className="shrink-0"
      />
      {nearLimit && (
        <span className="absolute -top-5 right-3 text-[10px] text-textMuted" aria-live="polite">
          {text.length}/{MAX_LENGTH}
        </span>
      )}
      <button
        type="submit"
        disabled={!text.trim() || disabled}
        aria-label="Send message"
        className={`p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center ${
          text.trim() && !disabled
            ? "bg-darkBtn text-white hover:bg-deepGreen shadow-sm scale-100"
            : "bg-olive-100 text-olive-400 cursor-not-allowed"
        }`}
        title="Send Message"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </form>
  );
};
