import React from "react";
import { useTranslation } from "react-i18next";
import "../hero/meadowSections.css";

// "Our promise": what SafeSpace is and isn't, in three frosted cards.
const PILLARS = [
  { icon: "🌿", key: "stigma" },
  { icon: "🛡️", key: "privacy" },
  { icon: "🤝", key: "caregivers" },
] as const;

export const TrustStatement: React.FC = () => {
  const { t } = useTranslation();
  return (
    <section className="ms-section" aria-labelledby="ms-promise">
      <div className="ms-head">
        <p className="ms-kicker ms-display">{t("landing.promise.kicker")}</p>
        <h2 id="ms-promise" className="ms-title ms-display">
          <span>{t("landing.promise.line1")}</span>
          <span>{t("landing.promise.line2")}</span>
        </h2>
        <p className="ms-lead">{t("landing.promise.lead")}</p>
      </div>
      <div className="ms-grid">
        {PILLARS.map((p) => (
          <article key={p.key} className="ms-card">
            <div className="ms-badge" aria-hidden="true">{p.icon}</div>
            <h3 className="ms-display">{t(`landing.promise.${p.key}.title`)}</h3>
            <p>{t(`landing.promise.${p.key}.text`)}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default TrustStatement;
