import React from "react";
import { Link } from "react-router-dom";
import { Sprout } from "../hero/MeadowHero";
import "../hero/meadowSections.css";

// The closing words and the footer, on the same sky as the sections above.
export const LandingFooter: React.FC = () => (
  <footer>
    <div className="ms-section ms-close">
      <p className="ms-quote ms-display">YOU'RE SAFE.<br />JUST BREATHE.</p>
      <p className="ms-lead">Kind, accessible support for everyday wellbeing. Never a diagnosis.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/signup" className="ms-pill ms-pill-white">Get started</Link>
        <Link to="/login" className="ms-pill ms-pill-glass">Log in</Link>
      </div>
    </div>
    <div className="ms-footer">
      <Link to="/" className="ms-footer-logo ms-display">
        <Sprout />
        SafeSpace
      </Link>
      <p className="m-0">© {new Date().getFullYear()} SafeSpace. Support, never a diagnosis.</p>
      <nav aria-label="Footer">
        <a href="#privacy">Privacy</a>
        <a href="#terms">Terms</a>
        <a href="#accessibility">Accessibility</a>
      </nav>
    </div>
  </footer>
);

export default LandingFooter;
