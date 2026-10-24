import React, { useEffect } from "react";
import { Button } from "../../../components/ui/Button";
import { isExitKey } from "../lib/lowSensory";

interface CalmToolShellProps {
  title: string;
  onExit: () => void;
  lowSensory: boolean;
  notice?: string | null;
  children: React.ReactNode;
}

/** Shared frame for every calm-tool screen: title, an always-visible Exit button, Escape to exit. */
export const CalmToolShell: React.FC<CalmToolShellProps> = ({ title, onExit, lowSensory, notice, children }) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isExitKey(e.key)) onExit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExit]);

  return (
    <div
      data-low-sensory={lowSensory ? "true" : "false"}
      className={`min-h-screen font-sans px-4 py-6 sm:px-6 ${
        lowSensory ? "bg-[#F4F1EA]" : "bg-gradient-to-b from-cream to-paleLime"
      }`}
    >
      <div className="mx-auto w-full max-w-xl">
        <header className="flex items-center justify-between gap-3 mb-6">
          <h1 className="font-display text-2xl font-medium text-textHeading">{title}</h1>
          <Button variant="outline" size="sm" onClick={onExit} aria-label={`Exit ${title} and return home`}>
            Exit
          </Button>
        </header>
        {notice && (
          <p role="status" className="mb-4 rounded-2xl bg-white/80 border border-olive-200 px-4 py-3 text-sm text-textBody">
            {notice}
          </p>
        )}
        <main>{children}</main>
        <p className="mt-6 text-xs text-textMuted text-center">
          Press Escape at any time to leave. This is a calming exercise, not medical advice.
        </p>
      </div>
    </div>
  );
};
