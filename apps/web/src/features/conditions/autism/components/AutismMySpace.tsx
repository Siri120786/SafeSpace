import React, { useState } from "react";
import { EmotionCards } from "./EmotionCards";
import { TransitionCountdown } from "./TransitionCountdown";
import { VisualSchedule } from "./VisualSchedule";
import { AacBoard } from "./AacBoard";
import { SpecialInterestThemes } from "./SpecialInterestThemes";

export interface AutismMySpaceProps {
  className?: string;
}

type AutismSubTab = "emotions" | "schedule" | "transitions" | "aac";

export const AutismMySpace: React.FC<AutismMySpaceProps> = ({ className = "" }) => {
  const [activeTab, setActiveTab] = useState<AutismSubTab>("emotions");

  const tabs: { id: AutismSubTab; label: string; icon: string }[] = [
    { id: "emotions", label: "Feelings & Emotions", icon: "😊" },
    { id: "schedule", label: "Visual Schedule", icon: "📅" },
    { id: "transitions", label: "Transition Pacing", icon: "⏳" },
    { id: "aac", label: "AAC Board", icon: "💬" },
  ];

  return (
    <SpecialInterestThemes className={className}>
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Autism My Space features"
          className="flex items-center gap-2 border-b border-black/10 pb-3 overflow-x-auto"
        >
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-selected={isSelected}
                className={`min-h-[44px] px-4 py-2.5 rounded-2xl font-display text-xs sm:text-sm font-medium transition-all shrink-0 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 ${
                  isSelected
                    ? "bg-darkBtn text-white shadow-pill font-semibold"
                    : "text-textBody hover:bg-black/5"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Panels */}
        <div role="tabpanel" className="transition-all">
          {activeTab === "emotions" && <EmotionCards />}
          {activeTab === "schedule" && <VisualSchedule />}
          {activeTab === "transitions" && <TransitionCountdown />}
          {activeTab === "aac" && <AacBoard />}
        </div>
      </div>
    </SpecialInterestThemes>
  );
};
