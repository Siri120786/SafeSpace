import React from "react";
import { Link } from "react-router-dom";
import { Sprout } from "../hero/MeadowHero";
import { useTranslation } from "react-i18next";
import "../hero/meadowSections.css";

// The closing words and the footer, on the same sky as the sections above.
export const LandingFooter: React.FC = () => {
  const { t } = useTranslation();
  return (
  <footer>
    <div className="ms-section ms-close">
      <p className="ms-quote ms-display">{t("landing.footer.quote1")}<br />{t("landing.footer.quote2")}</p>
      <p className="ms-lead">{t("landing.footer.lead")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/signup" className="ms-pill ms-pill-white">{t("common.getStarted")}</Link>
        <Link to="/login" className="ms-pill ms-pill-glass">{t("common.logIn")}</Link>
      </div>
    </div>
    <div className="ms-footer">
      <Link to="/" className="ms-footer-logo ms-display">
        <Sprout />
        SafeSpace
      </Link>
      <p className="m-0">© {new Date().getFullYear()} SafeSpace. {t("landing.footer.tagline")}</p>
      <nav aria-label={t("landing.footer.navLabel")}>
        <a href="#privacy">{t("landing.footer.privacy")}</a>
        <a href="#terms">{t("landing.footer.terms")}</a>
        <a href="#accessibility">{t("landing.footer.accessibility")}</a>
      </nav>
    </div>
  </footer>
  );
};

export default LandingFooter;
