import React from "react";
import { Link } from "react-router-dom";
import type { ChildTheme } from "@safespace/shared-types";
import { useChildSpace } from "./ChildSpaceContext";
import { CHILD_THEME_LOOKS, childThemeLook } from "./childThemes";
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

// Frame for every child page: the theme's soft background, a big title in
// the theme's colour, a way home. Low-sensory mode drops motion and always
// uses the calm look (role-flow 8d). A child with the ADHD or autism module
// in a designed theme (Space, Animals) gets that theme's frame instead.
export const ChildPageShell: React.FC<Props> = ({ title, backTo, actions, children }) => {
  const { child, lowSensory } = useChildSpace();
  const { active } = useAppTheme();
  if (active !== "calm") {
    return (
      <ThemedFrame theme={active} eyebrow="My space" title={title} backTo={backTo} backLabel="Home" actions={actions}>
        {children}
      </ThemedFrame>
    );
  }
  const look = childThemeLook(child.theme, lowSensory);
  const accent = child.theme ? THEME_EMOJI[child.theme] : null;
  return (
    <div
      data-low-sensory={lowSensory ? "on" : "off"}
      data-theme={lowSensory || !child.theme ? "calm" : child.theme}
      style={{ backgroundColor: look.background }}
      className={`min-h-screen text-charcoal ${lowSensory ? "[&_*]:!transition-none [&_*]:!animate-none" : ""}`}
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {backTo && (
              <Link
                to={backTo}
                className="rounded-full border border-botanical-900/10 bg-white px-4 py-2 text-sm font-semibold text-botanical-800 focus:outline-none focus:ring-2 focus:ring-botanical-700"
              >
                &larr; Home
              </Link>
            )}
            <h1 className="font-display text-2xl sm:text-3xl font-bold" style={{ color: look.accent }}>
              {title} {accent && !backTo && <span aria-hidden="true">{accent}</span>}
            </h1>
          </div>
          {actions}
        </header>
        {children}
      </div>
    </div>
  );
};
