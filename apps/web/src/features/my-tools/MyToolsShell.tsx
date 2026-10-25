import React from "react";
import { Link } from "react-router-dom";
import { LeafCluster } from "../../components/vectors/LeafFrame";
import { useAppTheme } from "../themes/useAppTheme";
import { SpaceToolFrame } from "../themes/space/SpaceTools";

interface Props {
  title: string;
  subtitle?: string;
  backTo: string;
  backLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const DEFAULT_BACK = "Back to your dashboard";

// Frame for an Individual's tool pages: back to the dashboard, a title, the
// page. With the ADHD or autism module in a designed theme (Space), that
// theme's frame instead.
export const MyToolsShell: React.FC<Props> = ({ title, subtitle, backTo, backLabel = DEFAULT_BACK, actions, children }) => {
  const { active } = useAppTheme();
  if (active === "space") {
    return (
      <SpaceToolFrame
        eyebrow="Your space"
        title={title}
        subtitle={subtitle}
        backTo={backTo}
        backLabel={backLabel === DEFAULT_BACK ? "Dashboard" : backLabel}
        actions={actions}
      >
        {children}
      </SpaceToolFrame>
    );
  }
  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-[#FAF7F2] to-paleLime/30 text-textHeading font-sans pb-16 relative overflow-x-hidden">
      <LeafCluster position="top-right" size={180} className="fixed top-0 right-0 opacity-40 pointer-events-none" />
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link to={backTo} className="text-xs font-semibold text-deepGreen hover:underline">
              &larr; {backLabel}
            </Link>
            <h1 className="font-display text-3xl font-medium text-textHeading mt-2">{title}</h1>
            {subtitle && <p className="text-sm text-textMuted font-light mt-1">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
};
