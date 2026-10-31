import React from "react";
import type { ChildTheme } from "@safespace/shared-types";
import { CHILD_THEME_LOOKS } from "./childThemes";
import { useAppTheme } from "../themes/useAppTheme";
import { ThemedFrame } from "../themes/ThemeKit";

export const THEME_EMOJI = Object.fromEntries(
  Object.entries(CHILD_THEME_LOOKS).map(([k, v]) => [k, v.emoji]),
) as Record<ChildTheme, string>;

interface Props {
  title: string;
  backTo?: string;   // omitted on the home page
  actions?: React.ReactNode;
  children: React.ReactNode;
}

// Frame for every child page: the meadow look (the landing page's boy and
// puppy) with a big title and a way home; with the ADHD or autism module, the
// child's chosen theme. Low-sensory mode keeps the meadow, still.
export const ChildPageShell: React.FC<Props> = ({ title, backTo, actions, children }) => {
  const { active, lowSensory } = useAppTheme();
  return (
    <ThemedFrame
      theme={active === "plain" ? "calm" : active}
      stillOnly={lowSensory}
      eyebrow="My space"
      title={title}
      backTo={backTo}
      backLabel="Home"
      actions={actions}
    >
      {children}
    </ThemedFrame>
  );
};
