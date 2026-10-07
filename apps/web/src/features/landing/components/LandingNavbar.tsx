import React, { useState, useEffect } from "react";
import { Button } from "../../../components/ui/Button";

interface LandingNavbarProps {
  onLogin: () => void;
  onGetStarted: () => void;
  onChildPin?: () => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({
  onLogin,
  onGetStarted,
  onChildPin,
}) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "bg-white/80 backdrop-blur-md border-b border-olive-100 shadow-sm py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-mascotPink to-mascotPink-dark text-white flex items-center justify-center font-display font-bold text-lg shadow-sm">
            S
          </div>
          <span className="font-display text-xl font-medium tracking-tight text-textHeading">
            SafeSpace
          </span>
        </div>

        {/* Center Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-textBody">
          <a href="#features" className="hover:text-deepGreen transition-colors">
            Features
          </a>
          <a href="#showcase" className="hover:text-deepGreen transition-colors">
            Experience
          </a>
          <a href="#about" className="hover:text-deepGreen transition-colors">
            Philosophy
          </a>
          {onChildPin && (
            <button
              onClick={onChildPin}
              className="text-olive-700 hover:text-deepGreen font-semibold flex items-center gap-1"
            >
              <span>Child Space</span>
              <span className="text-xs bg-olive-100 text-olive-800 px-2 py-0.5 rounded-full">PIN</span>
            </button>
          )}
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onLogin}
            className="text-sm font-medium text-textHeading hover:text-deepGreen px-3 py-2 transition-colors"
          >
            Log in
          </button>

          <Button variant="primary" size="sm" onClick={onGetStarted}>
            Get started
          </Button>
        </div>
      </div>
    </header>
  );
};

export default LandingNavbar;
