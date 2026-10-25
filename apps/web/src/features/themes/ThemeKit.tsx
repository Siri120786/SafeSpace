import React from "react";
import type { ThemeFrameProps, ThemeHomeProps, ThemeToolsHomeProps } from "./kitTypes";
import type { ToolTheme } from "./toolThemes";
import { SpaceHome, SpaceToolFrame, SpaceToolsHome } from "./space/SpaceTools";
import { AnimalsFrame, AnimalsHome, AnimalsToolsHome } from "./animals/AnimalsKit";

// Each designed theme's kit. Pages ask for "the home", "the tools page" or
// "the frame" in the active theme; calm is the pages' own look.
const KITS = {
  space: { Home: SpaceHome, ToolsHome: SpaceToolsHome, Frame: SpaceToolFrame },
  animals: { Home: AnimalsHome, ToolsHome: AnimalsToolsHome, Frame: AnimalsFrame },
} as const;

type Designed = keyof typeof KITS;
const kitFor = (theme: ToolTheme) => KITS[theme as Designed];

export const ThemedHome: React.FC<ThemeHomeProps & { theme: ToolTheme }> = ({ theme, ...props }) => {
  const { Home } = kitFor(theme);
  return <Home {...props} />;
};

export const ThemedToolsHome: React.FC<ThemeToolsHomeProps & { theme: ToolTheme }> = ({ theme, ...props }) => {
  const { ToolsHome } = kitFor(theme);
  return <ToolsHome {...props} />;
};

export const ThemedFrame: React.FC<ThemeFrameProps & { theme: ToolTheme }> = ({ theme, ...props }) => {
  const { Frame } = kitFor(theme);
  return <Frame {...props} />;
};
