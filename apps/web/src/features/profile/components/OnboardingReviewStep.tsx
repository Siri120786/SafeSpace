import React from "react";
import type { ModuleKey, UserRole } from "@safespace/shared-types";
import type { AccessibilityOptionsState } from "./OnboardingAccessibilityStep";
import { SafeSpaceButton } from "../../../components/ui/SafeSpaceButton";

interface OnboardingReviewStepProps {
  displayName: string;
  role: UserRole;
  selectedSupportAreas: ModuleKey[];
  accessibility: AccessibilityOptionsState;
  isSubmitting: boolean;
  onGoToStep: (step: number) => void;
  onSubmit: () => void;
  onBack: () => void;
}

const SUPPORT_LABELS: Record<ModuleKey, string> = {
  autism: "Autism Spectrum & Neurodivergent Routines",
  adhd: "ADHD Focus & Executive Function",
  anxiety: "Emotional Regulation & Calming Support",
  depression: "Mood Tracking & Encouragement",
  ptsd: "Trauma-Informed Safety & Predictability",
  pcos_pcod: "Health Habits & Symptom Tracking",
};

const ACCESSIBILITY_LABELS: Record<keyof AccessibilityOptionsState, string> = {
  reducedSensoryStimulation: "Reduced Sensory Stimulation",
  largerText: "Larger Text & High Legibility",
  readAloud: "Read-Aloud & Audio Assistance",
  simplifiedPresentation: "Simplified Presentation",
};

export const OnboardingReviewStep: React.FC<OnboardingReviewStepProps> = ({
  displayName,
  role,
  selectedSupportAreas,
  accessibility,
  isSubmitting,
  onGoToStep,
  onSubmit,
  onBack,
}) => {
  const activeAccessibilityList = (
    Object.keys(accessibility) as Array<keyof AccessibilityOptionsState>
  ).filter((key) => accessibility[key]);

  const roleTitle = role === "caregiver" ? "Caregiver / Family Lead" : "Individual User";

  return (
    <div className="space-y-6">
      <div className="border-b border-botanical-900/10 pb-4">
        <h2 className="font-display text-2xl font-bold text-charcoal">Review Your Setup</h2>
        <p className="text-sm text-charcoal/70 mt-1">
          Review your selections below. You can update these choices anytime in your settings.
        </p>
      </div>

      <div className="space-y-4">
        {/* Section 1: Basic Info */}
        <div className="p-4 rounded-2xl border border-botanical-900/10 bg-white shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-bold text-botanical-700 uppercase tracking-wider">
              Step 1 &bull; Profile Info
            </span>
            <h3 className="text-base font-bold text-charcoal mt-1">{displayName || "(No name set)"}</h3>
            <p className="text-xs text-charcoal/70">Role: {roleTitle}</p>
          </div>
          <button
            type="button"
            onClick={() => onGoToStep(1)}
            className="text-xs text-botanical-700 hover:text-botanical-900 font-bold underline px-2 py-1"
          >
            Edit
          </button>
        </div>

        {/* Section 2: Support Preferences */}
        <div className="p-4 rounded-2xl border border-botanical-900/10 bg-white shadow-sm flex items-start justify-between">
          <div className="pr-4">
            <span className="text-xs font-bold text-botanical-700 uppercase tracking-wider">
              Step 2 &bull; Support Areas
            </span>
            {selectedSupportAreas.length === 0 ? (
              <p className="text-sm text-charcoal/70 mt-1 italic">Default setup (no specific support areas selected)</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {selectedSupportAreas.map((key) => (
                  <li key={key} className="text-sm text-charcoal flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-botanical-600"></span>
                    <span>{SUPPORT_LABELS[key] || key}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => onGoToStep(2)}
            className="text-xs text-botanical-700 hover:text-botanical-900 font-bold underline px-2 py-1"
          >
            Edit
          </button>
        </div>

        {/* Section 3: Accessibility */}
        <div className="p-4 rounded-2xl border border-botanical-900/10 bg-white shadow-sm flex items-start justify-between">
          <div className="pr-4">
            <span className="text-xs font-bold text-coral-600 uppercase tracking-wider">
              Step 3 &bull; Accessibility
            </span>
            {activeAccessibilityList.length === 0 ? (
              <p className="text-sm text-charcoal/70 mt-1 italic">Standard display settings</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {activeAccessibilityList.map((key) => (
                  <li key={key} className="text-sm text-charcoal flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-coral-500"></span>
                    <span>{ACCESSIBILITY_LABELS[key]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => onGoToStep(3)}
            className="text-xs text-botanical-700 hover:text-botanical-900 font-bold underline px-2 py-1"
          >
            Edit
          </button>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-ivory-100 border border-botanical-900/10 text-xs text-charcoal/80 space-y-1">
        <p className="font-bold text-charcoal">Notice:</p>
        <p>
          SafeSpace is an educational and supportive platform. Selections represent personal preferences and assistance choices, not medical diagnoses.
        </p>
      </div>

      <div className="pt-4 flex items-center justify-between">
        <SafeSpaceButton
          variant="ghost"
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
        >
          &larr; Back
        </SafeSpaceButton>
        <SafeSpaceButton
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <div className="flex items-center space-x-2">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Creating your SafeSpace...</span>
            </div>
          ) : (
            <span>Create my SafeSpace</span>
          )}
        </SafeSpaceButton>
      </div>
    </div>
  );
};

export default OnboardingReviewStep;
