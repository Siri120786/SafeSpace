import React from "react";

export const TrustStatement: React.FC = () => {
  return (
    <section id="trust-section" className="py-16 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Trust Statement */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-botanical-100/70 text-botanical-800 text-xs font-semibold uppercase tracking-wider">
            <span>Our Product Promise</span>
          </div>

          <h2 className="font-display text-3xl sm:text-4xl font-bold text-charcoal tracking-tight">
            Built around your needs, with your choices in your hands.
          </h2>

          <p className="text-base text-charcoal/80 max-w-2xl mx-auto leading-relaxed">
            SafeSpace is designed to support wellbeing, reflection and everyday coping — <strong className="font-semibold text-botanical-800">never to diagnose.</strong>
          </p>
        </div>

        {/* 3 Pillars Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Pillar 1 */}
          <div className="p-6 bg-white rounded-3xl border border-botanical-900/5 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-botanical-100 text-botanical-700 flex items-center justify-center font-bold text-lg">
              🌿
            </div>
            <h3 className="font-display text-lg font-bold text-charcoal">
              Support Without Stigma
            </h3>
            <p className="text-xs sm:text-sm text-charcoal/70 leading-relaxed">
              Personalized tools for routines, executive function, sensory preferences, and mood regulation tailored to your rhythm.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-6 bg-white rounded-3xl border border-botanical-900/5 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-coral-100 text-coral-600 flex items-center justify-center font-bold text-lg">
              🛡️
            </div>
            <h3 className="font-display text-lg font-bold text-charcoal">
              Dignified Privacy
            </h3>
            <p className="text-xs sm:text-sm text-charcoal/70 leading-relaxed">
              Age-tiered privacy rules protect young individuals&apos; self-expression while maintaining critical safety overrides.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-6 bg-white rounded-3xl border border-botanical-900/5 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-ivory-200 text-botanical-800 flex items-center justify-center font-bold text-lg">
              🤝
            </div>
            <h3 className="font-display text-lg font-bold text-charcoal">
              Caregiver Collaboration
            </h3>
            <p className="text-xs sm:text-sm text-charcoal/70 leading-relaxed">
              Provides caregivers with actionable insight and calm tools to support family harmony without intrusive surveillance.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
};

export default TrustStatement;
