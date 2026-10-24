import React, { useEffect, useState } from "react";
import {
  DeviceOnlyNote,
  SoftBadge,
  useReducedMotion,
} from "../../../wellness-ui";
import {
  createThemeService,
  resolveActiveTheme,
  THEME_DEFINITIONS,
} from "../services";
import type { AutismThemeKey } from "../types";

export interface SpecialInterestThemesProps {
  children?: React.ReactNode;
  showPicker?: boolean;
  className?: string;
}

export const SpecialInterestThemes: React.FC<SpecialInterestThemesProps> = ({
  children,
  showPicker = true,
  className = "",
}) => {
  const service = createThemeService();
  const { reducedMotion } = useReducedMotion();

  const [savedTheme, setSavedTheme] = useState<AutismThemeKey>("calm");

  useEffect(() => {
    service.getSelectedTheme().then(setSavedTheme).catch(() => {});
  }, []);

  const handleSelectTheme = (theme: AutismThemeKey) => {
    setSavedTheme(theme);
    service.saveTheme(theme).catch(() => {});
  };

  // Pure resolution: Low-sensory mode unconditionally overrides any theme to "calm"
  const activeThemeKey = resolveActiveTheme(savedTheme, reducedMotion);
  const activeTheme = THEME_DEFINITIONS[activeThemeKey];

  return (
    <div
      style={activeTheme.cssVariables as React.CSSProperties}
      className={`rounded-4xl p-6 sm:p-8 transition-colors duration-200 text-left ${className}`.trim()}
      style-description="Theming variables strictly scoped to this container element"
    >
      {showPicker && (
        <div className="space-y-4 mb-6 border-b border-black/10 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold px-3 py-1 rounded-full bg-black/5 text-textHeading">
                Special-Interest Themes
              </span>
              <h3 className="font-display text-2xl font-bold text-textHeading mt-1">
                Personalize Your Space
              </h3>
              <p className="text-xs sm:text-sm text-textMuted font-light mt-0.5">
                Pick a soothing interest theme. Colors stay calm with full AA text contrast.
              </p>
            </div>
            <DeviceOnlyNote compact />
          </div>

          {/* Low-Sensory Override Notice */}
          {reducedMotion && savedTheme !== "calm" && (
            <div
              role="note"
              className="p-3.5 rounded-2xl bg-black/5 text-xs text-textMuted flex items-center gap-2"
            >
              <span aria-hidden="true">🌿</span>
              <span>
                Low-sensory mode is active, keeping colors calm and uniform. Your
                &quot;{THEME_DEFINITIONS[savedTheme].label}&quot; preference remains saved.
              </span>
            </div>
          )}

          {/* Theme Choice Tiles */}
          <div
            role="group"
            aria-label="Theme choices"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5"
          >
            {(Object.keys(THEME_DEFINITIONS) as AutismThemeKey[]).map((key) => {
              const def = THEME_DEFINITIONS[key];
              const isSelected = savedTheme === key;
              const isCurrentlyApplied = activeThemeKey === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectTheme(key)}
                  aria-pressed={isSelected}
                  className={`min-h-[72px] p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 ${
                    isSelected
                      ? "bg-white/95 border-black/30 shadow-card font-semibold ring-1 ring-black/20"
                      : "bg-white/60 hover:bg-white/80 border-black/10 shadow-soft"
                  }`}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {def.icon}
                  </span>
                  <span className="text-xs font-display leading-tight text-textHeading">
                    {def.label}
                  </span>
                  {isCurrentlyApplied && (
                    <span className="text-[10px] text-deepGreen font-medium">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Scoped Child Content Area */}
      {children}
    </div>
  );
};
