// How each child theme looks in the child's space (role-flow 8d). The themes
// and accent colours come from Manju's special-interest themes; the page
// backgrounds are kept light (her "space" is dark navy) so every page's text
// stays readable. Low-sensory mode always uses the calm look, as in her
// design. No React here, so apps/web/tests/child-home.test.mts can check it.

import type { ChildTheme } from "@safespace/shared-types";

export interface ChildThemeLook {
  emoji: string;
  background: string; // the page
  accent: string;     // the page title
}

export const CHILD_THEME_LOOKS: Record<ChildTheme, ChildThemeLook> = {
  calm: { emoji: "🌱", background: "#FAF7F2", accent: "#2F3A2A" },
  space: { emoji: "🚀", background: "#EEF0FA", accent: "#3B4A8F" },
  ocean: { emoji: "🐋", background: "#EEF6F7", accent: "#1F5A64" },
  dinosaurs: { emoji: "🦕", background: "#F2F6EA", accent: "#4A6424" },
  trains: { emoji: "🚂", background: "#F1F4F7", accent: "#2B526D" },
  animals: { emoji: "🦁", background: "#FBF6EE", accent: "#87491F" },
  nature: { emoji: "🌲", background: "#F1F6EF", accent: "#2F5227" },
};

// The look to show: the child's theme, or calm when there's none or
// low-sensory mode is on.
export function childThemeLook(theme: ChildTheme | null, lowSensory: boolean): ChildThemeLook {
  return CHILD_THEME_LOOKS[lowSensory || !theme ? "calm" : theme] ?? CHILD_THEME_LOOKS.calm;
}

// WCAG relative-luminance contrast between two "#RRGGBB" colours (1 to 21).
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
