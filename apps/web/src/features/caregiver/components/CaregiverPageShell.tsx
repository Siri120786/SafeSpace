import React from "react";
import { CalmFrame } from "../../themes/calm/CalmKit";
import { useLowSensory } from "../../calm-tools/hooks/useLowSensory";

interface Props {
  title: string;
  subtitle?: string;
  backTo: string;
  backLabel?: string;
  children: React.ReactNode;
}

// Shared frame for caregiver pages below the home, in the meadow look (the
// landing page's boy and puppy): a way back, a title, the page. Low-sensory
// mode keeps the meadow still.
export const CaregiverPageShell: React.FC<Props> = ({ title, subtitle, backTo, backLabel = "Your children", children }) => {
  const { lowSensory } = useLowSensory();
  return (
    <CalmFrame stillOnly={lowSensory} eyebrow="Caregiver" title={title} subtitle={subtitle} backTo={backTo} backLabel={backLabel}>
      {children}
    </CalmFrame>
  );
};
