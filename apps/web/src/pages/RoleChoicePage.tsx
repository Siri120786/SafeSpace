import React from "react";
import { useNavigate } from "react-router-dom";
import { MeadowHero } from "../features/landing/hero/MeadowHero";
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

  const handleChild = () => {
    if (onChooseChild) {
      onChooseChild();
    } else {
      navigate("/child/pin");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#3f7d27] font-sans selection:bg-olive-200 selection:text-deepGreen">
      <main className="flex-1">
        {/* The hillside scene, the welcome and the ways in */}
        <MeadowHero />

        {/* Everything below continues the hero's sky, type and glass cards */}
        <div className="ms">
          <div id="features">
            <FeatureCardsSection />
          </div>
          <div id="showcase">
            <ShowcaseSection />
          </div>
          <div id="about">
            <EntryChoiceCard onChooseCaregiver={handleLogin} onChooseChild={handleChild} />
          </div>
          <div id="promise">
            <TrustStatement />
          </div>
          <LandingFooter />
        </div>
      </main>
    </div>
  );
}
