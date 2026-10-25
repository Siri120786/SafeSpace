// What every designed theme's kit takes, so the pages stay the same whatever
// the theme: a home (child home or Individual dashboard), a tools page and a
// frame for every other page.

import type React from "react";
import type { ConditionTool, ConditionToolKey } from "../conditions/conditionTools";

export interface ThemeTile {
  to: string;
  label: string;
  emoji: string;
}

export interface ThemeToolItem {
  tool: ConditionTool;
  mine: boolean;
}

export interface ThemeHomeProps {
  eyebrow: string;
  greeting: string;
  line: string;
  // A short word about today (the guide says it in a bubble, if the theme has one).
  status?: string;
  barExtra?: React.ReactNode;
  // The theme picker.
  picker?: React.ReactNode;
  // Every page, as tiles under the day.
  tiles: ThemeTile[];
  tilesLabel: string;
  // The day's things, on a light panel.
  children: React.ReactNode;
}

export interface ThemeToolsHomeProps {
  items: ThemeToolItem[];
  pathFor: (key: ConditionToolKey) => string;
  eyebrow: string;
  backTo: string;
  backLabel: string;
  picker?: React.ReactNode;
}

export interface ThemeFrameProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  // Beside the title (e.g. a page's own buttons).
  actions?: React.ReactNode;
  children: React.ReactNode;
}
