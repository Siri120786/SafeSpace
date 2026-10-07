import React from "react";
import { LeafCluster } from "../../../components/vectors/LeafFrame";
import { Sparkle } from "../../../components/vectors/Sparkles";

export const LandingFooter: React.FC = () => {
  return (
    <footer className="relative bg-gradient-to-b from-transparent via-paleLime/30 to-cream pt-20 pb-12 overflow-hidden border-t border-olive-100/60">
      {/* Botanical Leaf Framing Clusters in Corners */}
      <LeafCluster position="bottom-left" size={200} className="absolute bottom-0 left-0 opacity-80" />
      <LeafCluster position="bottom-right" size={200} className="absolute bottom-0 right-0 opacity-80" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        {/* Reassuring Closing Message */}
        <div className="mb-12 max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-white shadow-card mb-4">
            <Sparkle size={24} color="#8DA568" />
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-medium text-textHeading tracking-tight">
            "You're safe. Just breathe."
          </h2>
          <p className="text-sm md:text-base text-textMuted font-light mt-3">
            SafeSpace is committed to dignified, accessible, non-diagnostic wellbeing support for everyone.
          </p>
        </div>

        {/* Footer Navigation & Copyright */}
        <div className="pt-8 border-t border-olive-200/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-textMuted font-light">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-mascotPink text-white flex items-center justify-center font-display font-bold text-xs">
              S
            </div>
            <span className="font-medium text-textHeading">SafeSpace Platform</span>
          </div>

          <p>© {new Date().getFullYear()} SafeSpace. All rights reserved. Screen, educate, and support — never diagnose.</p>

          <div className="flex items-center gap-4">
            <a href="#privacy" className="hover:text-deepGreen transition-colors">Privacy Policy</a>
            <a href="#terms" className="hover:text-deepGreen transition-colors">Terms of Service</a>
            <a href="#accessibility" className="hover:text-deepGreen transition-colors">Accessibility</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
