import React from "react";

// NutritionGuide: the NutriAI food-and-nutrition chat, opened from its own tile
// on every home (Individuals, children and caregivers). The chat is hosted
// outside SafeSpace and only loads when someone opens this page.
const CHAT_URL =
  "https://cdn.botpress.cloud/webchat/v3.3/shareable.html?configUrl=https://files.bpcontent.cloud/2025/10/22/13/20251022132657-9130AIU9.json";

export const NutritionGuide: React.FC = () => (
  <section
    aria-label="NutritionGuide chat"
    className="flex h-[min(640px,calc(100vh-14rem))] min-h-[420px] w-full flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-2xl backdrop-blur-xl"
  >
    <header className="flex items-center gap-2 bg-gradient-to-r from-[#4f8a3c] to-[#7cb342] px-4 py-3 text-white">
      <span aria-hidden="true" className="text-xl leading-none">🥕</span>
      <div>
        <h2 className="text-base font-semibold leading-tight">NutritionGuide</h2>
        <p className="text-[11px] text-white/85">Food tips, not medical advice</p>
      </div>
    </header>
    <iframe
      src={CHAT_URL}
      title="NutritionGuide chat"
      className="w-full flex-1 border-none bg-white"
      allow="microphone; autoplay"
    />
  </section>
);

export default NutritionGuide;
