import React from "react";
import { MyToolsShell } from "../features/my-tools/MyToolsShell";
import { ChildPageShell } from "../features/child-space/ChildPageShell";
import { CaregiverPageShell } from "../features/caregiver/components/CaregiverPageShell";
import { NutritionGuide } from "../features/nutrition";
import { ROUTES } from "../routes";

// NutritionGuide for each role, in that role's own page frame.

export const IndividualNutritionPage: React.FC = () => (
  <MyToolsShell title="NutritionGuide" subtitle="Ask about food, meals and eating well." backTo={ROUTES.DASHBOARD}>
    <NutritionGuide />
  </MyToolsShell>
);

export const ChildNutritionPage: React.FC = () => (
  <ChildPageShell title="NutritionGuide" backTo={ROUTES.CHILD_HOME}>
    <NutritionGuide />
    <p className="text-xs text-charcoal/70">
      NutritionGuide is a computer, not a person. Ask a grown-up before you change what you eat.
    </p>
  </ChildPageShell>
);

export const CaregiverNutritionPage: React.FC = () => (
  <CaregiverPageShell
    title="NutritionGuide"
    subtitle="Ask about food, meals and eating well for your family."
    backTo={ROUTES.CAREGIVER_HOME}
    backLabel="Home"
  >
    <NutritionGuide />
  </CaregiverPageShell>
);
