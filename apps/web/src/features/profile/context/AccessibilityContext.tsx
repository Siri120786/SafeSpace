import React, { createContext, useContext, useEffect, useState } from "react";
import type { ProfileAccessibilityPreferences } from "@safespace/shared-types";

interface AccessibilityContextType {
  preferences: ProfileAccessibilityPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<ProfileAccessibilityPreferences>>;
  speakText: (text: string) => void;
}

const defaultPreferences: ProfileAccessibilityPreferences = {
  profileId: "",
  reducedSensoryStimulation: false,
  largerText: false,
  readAloud: false,
  simplifiedPresentation: false,
  createdAt: "",
  updatedAt: "",
};

const AccessibilityContext = createContext<AccessibilityContextType>({
  preferences: defaultPreferences,
  setPreferences: () => {},
  speakText: () => {},
});

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<ProfileAccessibilityPreferences>(defaultPreferences);

  useEffect(() => {
    // Apply body classes for global accessibility behaviors
    const root = document.documentElement;
    
    if (preferences.largerText) {
      root.classList.add("text-lg", "accessibility-larger-text");
    } else {
      root.classList.remove("text-lg", "accessibility-larger-text");
    }

    if (preferences.reducedSensoryStimulation) {
      root.classList.add("motion-reduce", "accessibility-reduced-stimulation");
    } else {
      root.classList.remove("motion-reduce", "accessibility-reduced-stimulation");
    }

    if (preferences.simplifiedPresentation) {
      root.classList.add("accessibility-simplified");
    } else {
      root.classList.remove("accessibility-simplified");
    }
  }, [preferences]);

  const speakText = (text: string) => {
    if (!preferences.readAloud || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <AccessibilityContext.Provider value={{ preferences, setPreferences, speakText }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => useContext(AccessibilityContext);
