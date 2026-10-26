import React from "react";
import { useTranslation } from "react-i18next";
import "../hero/meadowSections.css";

// "What's inside": the three things SafeSpace helps with, in the hero's look.
const FEATURES = [
  { icon: "🌱", key: "feelings" },
  { icon: "✅", key: "habits" },
  { icon: "🍃", key: "calm" },
] as const;

export const FeatureCardsSection: React.FC = () => {
  const { t } = useTranslation();
  return (
    <section className="ms-section" aria-labelledby="ms-features">
      <div className="ms-head">
        <p className="ms-kicker ms-display">{t("landing.features.kicker")}</p>
        <h2 id="ms-features" className="ms-title ms-display">
          <span>{t("landing.features.line1")}</span>
          <span>{t("landing.features.line2")}</span>
        </h2>
        <p className="ms-lead">{t("landing.features.lead")}</p>
      </div>
      <div className="ms-grid">
        {FEATURES.map((f) => (
          <article key={f.key} className="ms-card ms-card-hover">
            <div className="ms-badge" aria-hidden="true">{f.icon}</div>
            <h3 className="ms-display">{t(`landing.features.${f.key}.title`)}</h3>
            <p>{t(`landing.features.${f.key}.text`)}</p>
          </article>
        ))}
      </div>
    </section>
  );
};
