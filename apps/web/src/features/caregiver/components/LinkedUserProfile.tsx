import React from "react";
import type { LinkedUserProfileView, ModuleKey } from "@safespace/shared-types";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";

// Framed as support preferences, never as diagnoses.
const SUPPORT_LABELS: Record<ModuleKey, string> = {
  autism: "Autism-related support",
  adhd: "ADHD-related support",
  anxiety: "Anxiety support",
  depression: "Depression support",
  ptsd: "PTSD-related support",
  pcos_pcod: "PCOS/PCOD wellbeing",
};

interface Props {
  view: LinkedUserProfileView;
  onBack: () => void;
}

export const LinkedUserProfile: React.FC<Props> = ({ view, onBack }) => {
  const { profile, supportPreferences, accessibilityPreferences } = view;

  const accessibilityRows: { label: string; on: boolean }[] =
    accessibilityPreferences
      ? [
          { label: "Reduced sensory stimulation", on: accessibilityPreferences.reducedSensoryStimulation },
          { label: "Larger text", on: accessibilityPreferences.largerText },
          { label: "Read aloud", on: accessibilityPreferences.readAloud },
          { label: "Simplified presentation", on: accessibilityPreferences.simplifiedPresentation },
        ]
      : [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← Back to linked users
      </Button>

      <Card>
        <h2 className="text-2xl font-semibold text-textHeading">
          {profile.displayName || "Unnamed user"}
        </h2>
        <p className="mt-1 text-textBody">
          Onboarding:{" "}
          <strong>
            {profile.onboardingState === "completed" ? "Completed" : "Not completed yet"}
          </strong>
        </p>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-textHeading">Support preferences</h3>
        {supportPreferences && supportPreferences.supportAreas.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {supportPreferences.supportAreas.map((area) => (
              <li key={area} className="rounded-full bg-black/5 px-3 py-1 text-sm text-textBody">
                {SUPPORT_LABELS[area] ?? area}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-textBody">None selected yet.</p>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-textHeading">Accessibility preferences</h3>
        {accessibilityRows.length > 0 ? (
          <ul className="mt-3 space-y-1 text-textBody">
            {accessibilityRows.map((r) => (
              <li key={r.label} className="flex justify-between">
                <span>{r.label}</span>
                <span>{r.on ? "On" : "Off"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-textBody">Not set yet.</p>
        )}
      </Card>

      <p className="text-xs text-textBody">
        You can see basic profile details, support preferences, accessibility
        preferences and onboarding status. Private journals, mood entries, AI
        conversations and personal notes are not shared.
      </p>
    </div>
  );
};
