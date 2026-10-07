import React from "react";
import { SafeSpaceButton } from "../../../components/ui/SafeSpaceButton";

export interface AccessibilityOptionsState {
  reducedSensoryStimulation: boolean;
  largerText: boolean;
  readAloud: boolean;
  simplifiedPresentation: boolean;
}

interface OnboardingAccessibilityStepProps {
  accessibility: AccessibilityOptionsState;
  onToggleAccessibility: (key: keyof AccessibilityOptionsState) => void;
  onNext: () => void;
  onBack: () => void;
}

interface AccItem {
  key: keyof AccessibilityOptionsState;
  label: string;
  description: string;
}

const ACCESSIBILITY_ITEMS: AccItem[] = [
  {
    key: "reducedSensoryStimulation",
    label: "Reduced Sensory Stimulation",
    description: "Softens UI colors, mutes high-contrast animations, and reduces visual noise.",
  },
  {
    key: "largerText",
    label: "Larger Text & High Legibility",
    description: "Increases default typography sizes for improved reading comfort.",
  },
  {
    key: "readAloud",
    label: "Read-Aloud & Audio Assistance",
    description: "Enables text-to-speech triggers and spoken prompts where available.",
  },
  {
    key: "simplifiedPresentation",
    label: "Simplified Presentation",
    description: "Streamlines dashboard layouts to focus on primary tasks and routines.",
  },
];

export const OnboardingAccessibilityStep: React.FC<OnboardingAccessibilityStepProps> = ({
  accessibility,
  onToggleAccessibility,
  onNext,
  onBack,
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-botanical-900/10 pb-4">
        <h2 className="font-display text-2xl font-bold text-charcoal">Accessibility &amp; Sensory Preferences</h2>
        <p className="text-sm text-charcoal/70 mt-1">
          Customize how SafeSpace presents content to best fit your comfort and sensory needs.
          You can update these settings anytime.
        </p>
      </div>

      <div className="space-y-4">
        {ACCESSIBILITY_ITEMS.map((item) => {
          const isEnabled = accessibility[item.key];
          return (
            <div
              key={item.key}
              role="switch"
              aria-checked={isEnabled}
              tabIndex={0}
              onClick={() => onToggleAccessibility(item.key)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  onToggleAccessibility(item.key);
                }
              }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-start justify-between focus:outline-none focus:ring-2 focus:ring-botanical-700 ${
                isEnabled
                  ? "border-botanical-700 bg-botanical-50/60 shadow-sm"
                  : "border-botanical-900/10 bg-white hover:border-botanical-900/20"
              }`}
            >
              <div className="pr-4">
                <h3 className="text-base font-bold text-charcoal">{item.label}</h3>
                <p className="text-xs text-charcoal/70 mt-1">{item.description}</p>
              </div>

              <div
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors flex-shrink-0 mt-0.5 ${
                  isEnabled ? "bg-botanical-700 justify-end" : "bg-ivory-300 justify-start"
                }`}
              >
                <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-4 flex items-center justify-between">
        <SafeSpaceButton variant="ghost" type="button" onClick={onBack}>
          &larr; Back
        </SafeSpaceButton>
        <SafeSpaceButton type="button" onClick={onNext}>
          Continue to Review &rarr;
        </SafeSpaceButton>
      </div>
    </div>
  );
};

export default OnboardingAccessibilityStep;
