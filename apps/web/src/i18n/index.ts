// SafeSpace in English, Hindi and Telugu (react-i18next).
//
// Every translated string lives in ./locales/{en,hi,te}.json under the same
// keys; screens call t("area.key"). English is the fallback for any missing
// key, and apps/web/tests/i18n.test.mts checks the three files have exactly
// the same keys and placeholders. Hindi and Telugu are first drafts that need
// a native speaker's check (docs/content-needing-review.md).
//
// Which language: the person's saved choice once signed in (LanguageSync),
// else the last choice on this device, else the device's own language, else
// English. The <html lang> follows it, so read-aloud and screen readers do too.

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { APP_LANGUAGES, type AppLanguage } from "@safespace/shared-types";
import en from "./locales/en.json";
import hi from "./locales/hi.json";
import te from "./locales/te.json";

export const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  te: "తెలుగు",
};

const STORAGE_KEY = "safespace.language";

export const isAppLanguage = (v: unknown): v is AppLanguage => (APP_LANGUAGES as readonly unknown[]).includes(v);

function deviceLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isAppLanguage(saved)) return saved;
  } catch {
    // Storage blocked (private mode): fall through to the browser.
  }
  const nav = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  for (const l of nav) {
    const base = (l ?? "").toLowerCase().split("-")[0];
    if (isAppLanguage(base)) return base;
  }
  return "en";
}

function applyToPage(lang: string) {
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Not remembered on this device; the saved preference still applies.
  }
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, te: { translation: te } },
  lng: deviceLanguage(),
  fallbackLng: "en",
  supportedLngs: [...APP_LANGUAGES],
  interpolation: { escapeValue: false },   // React escapes already
  returnNull: false,
});
applyToPage(i18n.language);
i18n.on("languageChanged", applyToPage);

export default i18n;
