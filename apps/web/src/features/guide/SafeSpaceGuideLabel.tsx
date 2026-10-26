import React, { useEffect, useState } from "react";

// SafeSpace Guide: the help bot (index.html loads it as a chat bubble in the
// bottom-right corner on every page). The bubble itself has no words, so this
// pill names it beside the bubble and opens it too. Hidden while the chat is
// open, and until the bubble has loaded.
type Botpress = {
  initialized?: boolean;
  state?: string; // "opened" while the chat is open
  toggle?: () => void;
};

const botpress = () => (window as unknown as { botpress?: Botpress }).botpress;

export const SafeSpaceGuideLabel: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // The bubble's script loads on its own; watch it rather than its events,
  // which change between webchat versions.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const bp = botpress();
      setReady(!!bp?.initialized);
      setChatOpen(bp?.state === "opened");
    }, 400);
    return () => window.clearInterval(timer);
  }, []);

  if (!ready || chatOpen) return null;

  return (
    <button
      type="button"
      onClick={() => botpress()?.toggle?.()}
      className="fixed bottom-[38px] right-[98px] z-[2147483000] rounded-full border border-white/70 bg-white/90 px-4 py-2 text-sm font-semibold text-[#2f5a30] shadow-[0_8px_20px_rgba(20,60,100,0.22)] backdrop-blur-xl transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#4f8a3c]"
    >
      SafeSpace Guide
    </button>
  );
};

export default SafeSpaceGuideLabel;
