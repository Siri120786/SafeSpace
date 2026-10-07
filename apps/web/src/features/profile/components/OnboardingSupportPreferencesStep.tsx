import React from "react";
import type { ModuleKey } from "@safespace/shared-types";
import { SafeSpaceButton } from "../../../components/ui/SafeSpaceButton";

interface SupportOption {
  key: ModuleKey;
  title: string;
  description: string;
  badge: string;
}

const SUPPORT_OPTIONS: SupportOption[] = [
  {
    key: "autism",
    title: "Autism Spectrum & Neurodivergent Routines",
    description: "Visual schedules, predictable transitions, and clear sensory-friendly communication.",
    badge: "Available Now",
  },
  {
    key: "adhd",
    title: "ADHD Focus & Executive Function",
    description: "Task breakdowns, time guidance, motivation cues, and focus check-ins.",
    badge: "Upcoming",
  },
  {
    key: "anxiety",
    title: "Emotional Regulation & Calming Support",
    description: "Grounding exercises, breathing prompts, and anxiety reduction tools.",
    badge: "Upcoming",
  },
  {
    key: "depression",
    title: "Mood Tracking & Encouragement",
    description: "Gentle daily check-ins, activation prompts, and mood reflection tools.",
    badge: "Upcoming",
  },
  {
    key: "ptsd",
    title: "Trauma-Informed Safety & Predictability",
    description: "Reassuring structures, trigger safety notes, and calming routines.",
    badge: "Upcoming",
  },
  {
    key: "pcos_pcod",
    title: "Health Habits & Symptom Tracking",
    description: "Daily wellness habit logs, cycle tracking support, and self-care prompts.",
    badge: "Upcoming",
  },
];

interface OnboardingSupportPreferencesStepProps {
  selectedSupportAreas: ModuleKey[];
  onToggleSupportArea: (key: ModuleKey) => void;
  onNext: () => void;
  onBack: () => void;
}

export const OnboardingSupportPreferencesStep: React.FC<OnboardingSupportPreferencesStepProps> = ({
  selectedSupportAreas,
  onToggleSupportArea,
  onNext,
  onBack,
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-botanical-900/10 pb-4">
        <h2 className="font-display text-2xl font-bold text-charcoal">What would you like support with?</h2>
        <p className="text-sm text-charcoal/70 mt-1">
          Choose any support areas you&apos;d like SafeSpace to adapt around for you or your family.
          These selections customize your tools and themes — SafeSpace does not diagnose.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SUPPORT_OPTIONS.map((opt) => {
          const isSelected = selectedSupportAreas.includes(opt.key);
          return (
            <div
              key={opt.key}
              role="checkbox"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => onToggleSupportArea(opt.key)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  onToggleSupportArea(opt.key);
                }
              }}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-botanical-700 ${
                isSelected
                  ? "border-botanical-700 bg-botanical-50/70 shadow-sm"
                  : "border-botanical-900/10 bg-white hover:border-botanical-900/20"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-botanical-700 border-botanical-700 text-white"
                        : "border-botanical-900/30 bg-white"
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                        <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-charcoal">{opt.title}</h3>
                </div>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    opt.badge === "Available Now"
                      ? "bg-botanical-100 text-botanical-800"
                      : "bg-ivory-200 text-charcoal/60"
                  }`}
                >
                  {opt.badge}
                </span>
              </div>
              <p className="text-xs text-charcoal/70 mt-2 pl-8">{opt.description}</p>
            </div>
          );
        })}
      </div>

      <div className="pt-4 flex items-center justify-between">
        <SafeSpaceButton variant="ghost" type="button" onClick={onBack}>
          &larr; Back
        </SafeSpaceButton>
        <SafeSpaceButton type="button" onClick={onNext}>
          Continue &rarr;
        </SafeSpaceButton>
      </div>
    </div>
  );
};

export default OnboardingSupportPreferencesStep;
