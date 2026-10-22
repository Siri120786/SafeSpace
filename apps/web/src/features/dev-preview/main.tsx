import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { AccessibilityProvider, useAccessibility } from "../profile/context/AccessibilityContext";
import { AuthContext, type AuthContextType } from "../auth/context/AuthContext";
import { PREVIEW_REGISTRY } from "./registry";
import "../wellness-ui/accessibility.css";

// Standalone mock Auth session allowing offline preview with zero Supabase credentials
const mockAuthValue: AuthContextType = {
  session: {
    kind: "auth_user",
    user: { id: "dev-preview-user", email: "preview@safespace.local" },
    profile: {
      id: "dev-preview-user",
      role: "user",
      displayName: "Preview Tester",
      onboardingState: "completed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    supabaseAccessToken: "mock-preview-token",
  },
  loading: false,
  error: null,
  refreshSession: async () => {},
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  resetPassword: async () => {},
  changePassword: async () => {},
  setChildSessionState: () => {},
  clearError: () => {},
};

const PreviewApp: React.FC = () => {
  const { preferences, setPreferences } = useAccessibility();
  const [activeTabId, setActiveTabId] = useState(PREVIEW_REGISTRY[0].id);

  const activeTab = PREVIEW_REGISTRY.find((t) => t.id === activeTabId) ?? PREVIEW_REGISTRY[0];
  const ActiveComponent = activeTab.component;

  const toggleLowSensory = () => {
    setPreferences((prev) => ({
      ...prev,
      reducedSensoryStimulation: !prev.reducedSensoryStimulation,
    }));
  };

  const toggleLargerText = () => {
    setPreferences((prev) => ({
      ...prev,
      largerText: !prev.largerText,
    }));
  };

  const toggleSimplified = () => {
    setPreferences((prev) => ({
      ...prev,
      simplifiedPresentation: !prev.simplifiedPresentation,
    }));
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-textHeading font-sans pb-24">
      {/* Top Banner & Accessibility Quick Toggles */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-olive-100 shadow-xs px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden="true">
                🌿
              </span>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-textHeading">
                SafeSpace Preview Harness
              </h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider bg-olive-100 text-deepGreen-800 px-2.5 py-0.5 rounded-full">
                Workstream B
              </span>
            </div>
            <p className="text-xs text-textMuted font-light mt-0.5">
              Live component viewer operating offline without backend or Supabase login.
            </p>
          </div>

          {/* Accessibility Quick Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleLowSensory}
              aria-pressed={preferences.reducedSensoryStimulation}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-olive-600 focus-visible:outline-none ${
                preferences.reducedSensoryStimulation
                  ? "bg-deepGreen text-white border-deepGreen shadow-sm"
                  : "bg-white text-textBody border-olive-200 hover:bg-olive-50"
              }`}
            >
              <span>{preferences.reducedSensoryStimulation ? "✓" : "○"}</span>
              <span>Low Sensory Mode</span>
            </button>

            <button
              type="button"
              onClick={toggleLargerText}
              aria-pressed={preferences.largerText}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-olive-600 focus-visible:outline-none ${
                preferences.largerText
                  ? "bg-deepGreen text-white border-deepGreen shadow-sm"
                  : "bg-white text-textBody border-olive-200 hover:bg-olive-50"
              }`}
            >
              <span>{preferences.largerText ? "✓" : "○"}</span>
              <span>Larger Text</span>
            </button>

            <button
              type="button"
              onClick={toggleSimplified}
              aria-pressed={preferences.simplifiedPresentation}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-olive-600 focus-visible:outline-none ${
                preferences.simplifiedPresentation
                  ? "bg-deepGreen text-white border-deepGreen shadow-sm"
                  : "bg-white text-textBody border-olive-200 hover:bg-olive-50"
              }`}
            >
              <span>{preferences.simplifiedPresentation ? "✓" : "○"}</span>
              <span>Simplified View</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="max-w-6xl mx-auto mt-4 pt-3 border-t border-olive-100/60 flex items-center gap-2 overflow-x-auto">
          {PREVIEW_REGISTRY.map((tab) => {
            const isCurrent = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                className={`min-h-[44px] px-4 py-2 rounded-xl font-display text-xs sm:text-sm font-medium transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-olive-600 focus-visible:outline-none ${
                  isCurrent
                    ? "bg-darkBtn text-white shadow-pill font-semibold"
                    : "text-textBody hover:bg-olive-50 hover:text-deepGreen"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 pt-8">
        <div className="mb-6 text-left">
          <h2 className="font-display text-2xl font-bold text-textHeading">
            {activeTab.label}
          </h2>
          <p className="text-sm text-textMuted font-light mt-1">
            {activeTab.description}
          </p>
        </div>

        <div className="bg-white/70 p-6 sm:p-8 rounded-4xl border border-white shadow-card backdrop-blur-xs">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
};

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AuthContext.Provider value={mockAuthValue}>
        <AccessibilityProvider>
          <PreviewApp />
        </AccessibilityProvider>
      </AuthContext.Provider>
    </React.StrictMode>
  );
}
