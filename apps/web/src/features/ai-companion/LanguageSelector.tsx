import React from "react";
import type { LanguageCode } from "@safespace/shared-types";

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা" },
  { code: "ur", label: "Urdu", nativeLabel: "اردو" },
];

interface LanguageSelectorProps {
  selectedLanguage: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguage,
  onLanguageChange,
  className = "",
}) => {
  return (
    <div className={`flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none ${className}`}>
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isSelected = selectedLanguage === lang.code;
        return (
          <button
            key={lang.code}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onLanguageChange(lang.code)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              isSelected
                ? "bg-olive-500 text-white shadow-xs font-semibold scale-105"
                : "bg-white/80 text-textBody hover:bg-olive-100 hover:text-deepGreen border border-olive-100"
            }`}
          >
            <span>{lang.nativeLabel}</span>
            {isSelected && <span className="ml-1 text-[10px] opacity-80">({lang.label})</span>}
          </button>
        );
      })}
    </div>
  );
};
