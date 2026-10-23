import React from "react";
import { Link } from "react-router-dom";
import type { ChildTheme } from "@safespace/shared-types";
import { useChildSpace } from "./ChildSpaceContext";

export const THEME_EMOJI: Record<ChildTheme, string> = {
  space: "🚀",
  ocean: "🐠",
  dinosaurs: "🦕",
  trains: "🚂",
};

interface Props {
  title: string;
  backTo?: string;   // omitted on the home page
  actions?: React.ReactNode;
  children: React.ReactNode;
}

// Frame for every child page: calm background, a big title, a way home.
// Low-sensory mode drops motion and keeps colours plain.
export const ChildPageShell: React.FC<Props> = ({ title, backTo, actions, children }) => {
  const { child, lowSensory } = useChildSpace();
  const accent = child.theme ? THEME_EMOJI[child.theme] : null;
  return (
    <div
      data-low-sensory={lowSensory ? "on" : "off"}
      className={`min-h-screen bg-[#FAF7F2] text-charcoal ${lowSensory ? "[&_*]:!transition-none [&_*]:!animate-none" : ""}`}
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
            <h1 className="font-display text-2xl sm:text-3xl font-bold">
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
