import React from "react";
import { Card } from "../../../components/ui/Card";
import { BrainMascot } from "../../../components/vectors/BrainMascot";

export const FeatureCardsSection: React.FC = () => {
  const features = [
    {
      title: "Understand your feelings",
      description: "Track your emotions gently without judgment. Identify patterns, trigger reflections, and find peace in understanding.",
      stance: "happy" as const,
      bubble: "I'm listening!",
      bg: "bg-olive-50/60",
      accent: "text-olive-700",
    },
    {
      title: "Build small habits",
      description: "Nurture daily routines step-by-step. Set calm reminders and celebrate micro-wins at your own comfortable rhythm.",
      stance: "waving" as const,
      bubble: "You've got this!",
      bg: "bg-mascotPink-soft/60",
      accent: "text-mascotPink-dark",
    },
    {
      title: "Find your calm",
      description: "Immerse yourself in 5-minute guided breathing exercises, calming ambient soundscapes, and restful body resets.",
      stance: "meditating" as const,
      bubble: "Just breathe...",
      bg: "bg-deepGreen-50/60",
      accent: "text-deepGreen-700",
    },
  ];

  return (
    <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
        <h2 className="font-display text-3xl sm:text-4xl font-medium text-textHeading">
          Designed to support every moment of your day
        </h2>
        <p className="text-base sm:text-lg text-textBody font-light mt-3">
          Explore tools tailored to help you pause, reflect, and restore balance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {features.map((feature, idx) => (
          <Card key={idx} hoverable className={`${feature.bg} flex flex-col items-center text-center p-8 relative overflow-hidden`}>
            {/* Small Mascot Illustration */}
            <div className="mb-6">
              <BrainMascot
                stance={feature.stance}
                size={140}
                showBubble={true}
                bubbleText={feature.bubble}
              />
            </div>

            <h3 className={`font-display text-xl font-medium ${feature.accent} mb-2`}>
              {feature.title}
            </h3>

            <p className="text-sm md:text-base text-textBody/80 font-light leading-relaxed">
              {feature.description}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
};
