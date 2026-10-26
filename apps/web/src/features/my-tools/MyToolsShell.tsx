import React from "react";
import { useAppTheme } from "../themes/useAppTheme";
import { ThemedFrame } from "../themes/ThemeKit";

interface Props {
  title: string;
  subtitle?: string;
  backTo: string;
  backLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const DEFAULT_BACK = "Back to your dashboard";

// Frame for an Individual's pages: back to the dashboard, a title, the page,
// in the meadow look (the landing page's boy and puppy); with the ADHD or
// autism module, in their chosen theme. Low-sensory mode keeps the meadow
// still.
export const MyToolsShell: React.FC<Props> = ({ title, subtitle, backTo, backLabel = DEFAULT_BACK, actions, children }) => {
  const { active, lowSensory } = useAppTheme();
  return (
    <ThemedFrame
      theme={active === "plain" ? "calm" : active}
      stillOnly={lowSensory}
      eyebrow="Your space"
      title={title}
      subtitle={subtitle}
      backTo={backTo}
      backLabel={backLabel === DEFAULT_BACK ? "Dashboard" : backLabel}
      actions={actions}
    >
      {children}
    </ThemedFrame>
  );
};
