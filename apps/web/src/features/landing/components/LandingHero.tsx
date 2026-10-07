import React from "react";
import { BrainMascot } from "../../../components/vectors/BrainMascot";
import { Sparkle } from "../../../components/vectors/Sparkles";
import { LeafCluster } from "../../../components/vectors/LeafFrame";
import { Button } from "../../../components/ui/Button";

interface LandingHeroProps {
  onBeginJourney: () => void;
  onLogin: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onBeginJourney,
  onLogin,
}) => {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-16 lg:pb-24 px-4 sm:px-6 lg:px-8">
      {/* Organic Background Blobs */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-gradient-to-b from-cream via-paleLime/40 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Decorative Floating Sparkles */}
      <Sparkle size={28} className="absolute top-12 left-10 md:left-24 text-olive-500" />
      <Sparkle size={20} className="absolute top-36 right-12 md:right-32 text-deepGreen-600" />
      <Sparkle size={24} className="absolute bottom-16 left-16 text-mascotPink" />

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Hero Text Content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left z-10">
            
            {/* Eyebrow Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-olive-200 text-deepGreen font-medium text-xs md:text-sm shadow-sm backdrop-blur-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-olive-500 animate-ping" />
              <span>Screen, educate, and support — never diagnose</span>
            </div>

            {/* Main Hero Headline */}
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-medium text-textHeading tracking-tight leading-[1.15]">
              You don't have to figure it out{" "}
              <span className="relative inline-block text-deepGreen">
                alone
                {/* Custom Hand-Drawn Style Underline */}
                <svg
                  className="absolute -bottom-2 left-0 w-full h-3 text-olive-500 overflow-visible"
                  viewBox="0 0 120 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M 3 9 C 35 2 85 2 117 8 C 95 11 45 11 15 9"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    fill="currentColor"
                  />
                </svg>
              </span>
              .
            </h1>

            {/* Subtitle / Description */}
            <p className="text-base sm:text-lg md:text-xl text-textBody max-w-2xl mx-auto lg:mx-0 leading-relaxed font-light">
              SafeSpace brings personalized reflection, gentle daily routines, guided breathing, and practical mental-wellness tools into one warm, reassuring space.
            </p>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Button
                variant="primary"
                size="lg"
                onClick={onBeginJourney}
                className="w-full sm:w-auto shadow-xl hover:scale-105"
              >
                <span>Begin your journey</span>
                <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Button>

              <button
                type="button"
                onClick={onLogin}
                className="text-sm md:text-base font-medium text-textBody hover:text-deepGreen transition-colors underline decoration-olive-300 underline-offset-4 py-2"
              >
                Already have an account? Log in
              </button>
            </div>

            {/* Trust Highlights */}
            <div className="pt-6 border-t border-olive-200/50 grid grid-cols-3 gap-4 text-center lg:text-left">
              <div>
                <p className="text-xs uppercase font-semibold text-deepGreen">Gentle & Warm</p>
                <p className="text-xs text-textMuted mt-0.5">Self-paced tools</p>
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-deepGreen">Private & Safe</p>
                <p className="text-xs text-textMuted mt-0.5">Encrypted & secure</p>
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-deepGreen">Zero Diagnosis</p>
                <p className="text-xs text-textMuted mt-0.5">Focus on support</p>
              </div>
            </div>

          </div>

          {/* Right Column: Large Happy Brain Mascot + Decorative Leaves */}
          <div className="lg:col-span-5 flex justify-center relative">
            <div className="relative p-6 md:p-10 bg-white/60 rounded-4xl border border-white shadow-card backdrop-blur-md flex flex-col items-center">
              
              {/* Mascot */}
              <BrainMascot
                stance="happy"
                size={260}
                showBubble={true}
                bubbleText="How are you feeling today?"
              />

              {/* Leaf Accents framing corner */}
              <LeafCluster position="bottom-right" className="absolute -bottom-6 -right-6 scale-90 opacity-90" />
              <LeafCluster position="top-left" className="absolute -top-6 -left-6 scale-75 opacity-75" />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default LandingHero;
