import React from "react";
import { useNavigate } from "react-router-dom";
import { LandingNavbar } from "../features/landing/components/LandingNavbar";
import { LandingHero } from "../features/landing/components/LandingHero";
import { FeatureCardsSection } from "../features/landing/components/FeatureCardsSection";
import { ShowcaseSection } from "../features/landing/components/ShowcaseSection";
import { LandingFooter } from "../features/landing/components/LandingFooter";
import EntryChoiceCard from "../features/landing/components/EntryChoiceCard";
import TrustStatement from "../features/landing/components/TrustStatement";

interface Props {
  onChooseCaregiver?: () => void;
  onChooseChild?: () => void;
}

export default function RoleChoicePage({ onChooseCaregiver, onChooseChild }: Props) {
  const navigate = useNavigate();

  const handleLogin = () => {
    if (onChooseCaregiver) {
      onChooseCaregiver();
    } else {
      navigate("/login");
    }
  };

  const handleSignup = () => {
    navigate("/signup");
  };

  const handleChild = () => {
    if (onChooseChild) {
      onChooseChild();
    } else {
      navigate("/child/pin");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-cream via-[#FAF7F2] to-paleLime/30 text-textHeading font-sans selection:bg-olive-200 selection:text-deepGreen">
      {/* 1. Sticky Navbar */}
      <LandingNavbar
        onLogin={handleLogin}
        onGetStarted={handleSignup}
        onChildPin={handleChild}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* 2. Hero Section */}
        <LandingHero
          onBeginJourney={handleSignup}
          onLogin={handleLogin}
        />

        {/* 3. Feature Cards Section (Understand feelings, build habits, find calm) */}
        <div id="features">
          <FeatureCardsSection />
        </div>

        {/* 4. Showcase Phone Frame Section */}
        <div id="showcase">
          <ShowcaseSection />
        </div>

        {/* 5. Entry Choice Cards (Preserving Adult vs Child PIN entry) */}
        <div id="about">
          <EntryChoiceCard
            onChooseCaregiver={handleLogin}
            onChooseChild={handleChild}
          />
        </div>

        {/* 6. Product Principles & Trust */}
        <TrustStatement />
      </main>

      {/* 7. Footer */}
      <LandingFooter />
    </div>
  );
}
