import React, { useState } from "react";
import { EmotionCards } from "./EmotionCards";
import { TransitionCountdown } from "./TransitionCountdown";

export interface AutismMySpaceProps {
  className?: string;
}

export const AutismMySpace: React.FC<AutismMySpaceProps> = ({ className = "" }) => {
  const [activeTab, setActiveTab] = useState<"emotions" | "transitions">("emotions");

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      {/* Sub-Feature Navigation */}
      <div className="flex items-center gap-2 border-b border-olive-100 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("emotions")}
          aria-pressed={activeTab === "emotions"}
          className={`min-h-[44px] px-4 py-2 rounded-2xl font-display text-sm font-medium transition-all ${
            activeTab === "emotions"
              ? "bg-darkBtn text-white shadow-pill"
              : "text-textBody hover:bg-olive-50"
          }`}
        >
          Emotion Cards
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("transitions")}
          aria-pressed={activeTab === "transitions"}
          className={`min-h-[44px] px-4 py-2 rounded-2xl font-display text-sm font-medium transition-all ${
            activeTab === "transitions"
              ? "bg-darkBtn text-white shadow-pill"
              : "text-textBody hover:bg-olive-50"
          }`}
        >
          Transition Countdown
        </button>
      </div>

      {/* Render Selected View */}
      {activeTab === "emotions" ? (
        <EmotionCards />
      ) : (
        <TransitionCountdown />
      )}
    </div>
  );
};
