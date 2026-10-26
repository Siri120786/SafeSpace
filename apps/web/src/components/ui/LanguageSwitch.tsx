import React from "react";
import { useTranslation } from "react-i18next";
import { APP_LANGUAGES } from "@safespace/shared-types";
import { LANGUAGE_NAMES } from "../../i18n";
import { useLanguage } from "../../i18n/LanguageSync";

// English / हिन्दी / తెలుగు as three pills. Each name is written in its own
// language, so anyone can find theirs whatever is showing now. `look`:
// "glass" for the meadow (landing, sign-in), "plain" for light cards.
export const LanguageSwitch: React.FC<{ look?: "glass" | "plain"; className?: string }> = ({ look = "plain", className = "" }) => {
  const { t } = useTranslation();
  const { language, choose } = useLanguage();
  const base = "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2";
  const styles = look === "glass"
    ? { on: "bg-white text-[#2f5a30] focus:ring-white", off: "text-white hover:bg-white/20 focus:ring-white" }
    : { on: "bg-botanical-700 text-white focus:ring-botanical-700", off: "text-charcoal hover:bg-botanical-50 focus:ring-botanical-700" };

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className={`inline-flex items-center gap-1 rounded-full p-1 ${look === "glass" ? "bg-white/15 backdrop-blur-md border border-white/40" : "bg-white border border-olive-100 shadow-sm"} ${className}`}
    >
      {APP_LANGUAGES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={language === l}
          onClick={() => choose(l)}
          className={`${base} ${language === l ? styles.on : styles.off}`}
        >
          {LANGUAGE_NAMES[l]}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitch;

// A "Language" section for settings pages: a title, a line saying what
// changes, and the switch. A pick saves straight away (no Save button).
export const LanguageSection: React.FC<{ className?: string }> = ({ className = "rounded-3xl bg-white p-5 shadow-card space-y-3" }) => {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="language-title" className={className}>
      <h2 id="language-title" className="font-display text-xl font-bold text-charcoal">{t("language.title")}</h2>
      <p className="text-sm text-charcoal/70">{t("language.help")}</p>
      <LanguageSwitch />
    </section>
  );
};
