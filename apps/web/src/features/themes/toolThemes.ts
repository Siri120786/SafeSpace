// Themes for people with the ADHD or autism module: the same seven themes as
// the child space. The chosen theme styles their home or dashboard, their
// tools and their own pages (condition rooms keep their own looks). The
// person picks one (a caregiver can lock a child's); Calm, the meadow with
// the dog and puppy, is the default. Low-sensory mode, and anyone without
// the ADHD or autism module, get the pages' own plain look. A theme without
// its own designed look yet shows Calm, so nothing is ever half-built on
// screen. No React here, so apps/web/tests/space-theme.test.mts can check it.

import { CHILD_THEMES, type ChildTheme, type ModuleKey } from "@safespace/shared-types";
import { CHILD_THEME_LOOKS } from "../child-space/childThemes";

export type ToolTheme = ChildTheme;

// What a page shows: a designed theme, or the pages' own plain look.
export type ActiveLook = ToolTheme | "plain";

export const TOOL_THEMES: readonly ToolTheme[] = CHILD_THEMES;

// Themes with their own designed tools pages so far.
export const DESIGNED_TOOL_THEMES: readonly ToolTheme[] = ["calm", "space", "animals", "ocean", "nature"];

export const TOOL_THEME_LABELS: Record<ToolTheme, string> = {
  calm: "Calm",
  space: "Space",
  ocean: "Ocean",
  dinosaurs: "Dinosaurs",
  trains: "Trains",
  animals: "Animals",
  nature: "Nature",
};

export const toolThemeEmoji = (theme: ToolTheme): string => CHILD_THEME_LOOKS[theme].emoji;

export function isToolTheme(value: unknown): value is ToolTheme {
  return typeof value === "string" && (TOOL_THEMES as readonly string[]).includes(value);
}

// Themes are offered only to people with the ADHD or autism module.
export function themesOffered(modules: readonly ModuleKey[]): boolean {
  return modules.includes("adhd") || modules.includes("autism");
}

// The look to show: plain without themes or in low-sensory mode; otherwise
// the chosen theme if it has its own design, else Calm (the default).
export function activeToolTheme(chosen: ToolTheme | null, lowSensory: boolean, offered = true): ActiveLook {
  if (!offered || lowSensory) return "plain";
  return chosen && DESIGNED_TOOL_THEMES.includes(chosen) ? chosen : "calm";
}
