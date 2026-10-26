import React from "react";
import { useTranslation } from "react-i18next";
import "../hero/meadowSections.css";

interface EntryChoiceCardProps {
  onChooseCaregiver: () => void;
  onChooseChild: () => void;
}

// "Come on in": the two ways into SafeSpace (an adult's account, or a child's
// family code and PIN), as frosted cards.
export const EntryChoiceCard: React.FC<EntryChoiceCardProps> = ({ onChooseCaregiver, onChooseChild }) => {
  const { t } = useTranslation();
  return (
  <section className="ms-section" aria-labelledby="ms-entry">
    <div className="ms-head">
      <p className="ms-kicker ms-display">{t("landing.entry.kicker")}</p>
      <h2 id="ms-entry" className="ms-title ms-display">
        <span>{t("landing.entry.line1")}</span>
        <span>{t("landing.entry.line2")}</span>
      </h2>
      <p className="ms-lead">{t("landing.entry.lead")}</p>
    </div>

    <div className="ms-grid ms-grid-2">
      <article className="ms-card ms-card-hover flex flex-col">
        <span className="ms-tag">{t("landing.entry.adultTag")}</span>
        <div className="ms-badge" aria-hidden="true">🌿</div>
        <h3 className="ms-display">{t("landing.entry.adultTitle")}</h3>
        <p>{t("landing.entry.adultText")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="ms-pill ms-pill-green" onClick={onChooseCaregiver}>
            {t("common.logIn")} <span aria-hidden="true">→</span>
          </button>
        </div>
      </article>

      <article className="ms-card ms-card-hover flex flex-col">
        <span className="ms-tag">{t("landing.entry.childTag")}</span>
        <div className="ms-badge" aria-hidden="true">🧒</div>
        <h3 className="ms-display">{t("landing.entry.childTitle")}</h3>
        <p>{t("landing.entry.childText")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="ms-pill ms-pill-glass" onClick={onChooseChild}>
            {t("landing.entry.childButton")} <span aria-hidden="true">→</span>
          </button>
        </div>
      </article>
    </div>
  </section>
  );
};

export default EntryChoiceCard;
