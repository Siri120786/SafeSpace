import React from "react";
import type { ThemeFrameProps, ThemeHomeProps, ThemeToolsHomeProps } from "./kitTypes";
import type { ToolTheme } from "./toolThemes";
import { SpaceHome, SpaceToolFrame, SpaceToolsHome } from "./space/SpaceTools";
import { AnimalsFrame, AnimalsHome, AnimalsToolsHome } from "./animals/AnimalsKit";
import { OceanFrame, OceanHome, OceanToolsHome } from "./ocean/OceanKit";
import { NatureFrame, NatureHome, NatureToolsHome } from "./nature/NatureKit";
import { CalmFrame, CalmHome, CalmToolsHome } from "./calm/CalmKit";
import { DinoFrame, DinoHome, DinoToolsHome } from "./dinosaurs/DinoKit";
import { DINO_CARD_CLIPS } from "./dinosaurs/media";
import { SPACE_CARD_CLIPS } from "./space/media";
import { ANIMALS_CARD_CLIPS } from "./animals/media";
import { OCEAN_CARD_CLIPS } from "./ocean/media";
import { NATURE_CARD_CLIPS } from "./nature/media";
import { CALM_CARD_PICTURES } from "./calm/media";

// Each designed theme's kit. Pages ask for "the home", "the tools page" or
// "the frame" in the active theme; calm is the pages' own look.
const KITS = {
  calm: { Home: CalmHome, ToolsHome: CalmToolsHome, Frame: CalmFrame },
  space: { Home: SpaceHome, ToolsHome: SpaceToolsHome, Frame: SpaceToolFrame },
  animals: { Home: AnimalsHome, ToolsHome: AnimalsToolsHome, Frame: AnimalsFrame },
  ocean: { Home: OceanHome, ToolsHome: OceanToolsHome, Frame: OceanFrame },
  nature: { Home: NatureHome, ToolsHome: NatureToolsHome, Frame: NatureFrame },
  dinosaurs: { Home: DinoHome, ToolsHome: DinoToolsHome, Frame: DinoFrame },
} as const;

type Designed = keyof typeof KITS;
const kitFor = (theme: ToolTheme) => KITS[theme as Designed];

// A small picture of each theme's world, for cards that once showed the
// plain look's mascot (the dashboard's breathing card).
const MASCOTS: Record<Designed, string> = {
  calm: CALM_CARD_PICTURES.focus,
  space: SPACE_CARD_CLIPS.feelings.still,
  animals: ANIMALS_CARD_CLIPS.focus.still,
  ocean: OCEAN_CARD_CLIPS.focus.still,
  nature: NATURE_CARD_CLIPS.feelings.still,
  dinosaurs: DINO_CARD_CLIPS.focus.still,
};
export const themeMascot = (theme: ToolTheme): string => MASCOTS[theme as Designed] ?? MASCOTS.calm;

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
