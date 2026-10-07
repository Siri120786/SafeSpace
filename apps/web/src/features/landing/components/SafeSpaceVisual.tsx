import React from "react";

export const SafeSpaceVisual: React.FC = () => {
  return (
    <div className="relative w-full max-w-lg mx-auto flex items-center justify-center p-4">
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-botanical-100/60 via-coral-100/40 to-ivory-200/50 rounded-full blur-2xl transform scale-95 motion-reduce:transform-none" />

      {/* Main Vector SVG Art */}
      <svg
        viewBox="0 0 500 450"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto relative z-10 drop-shadow-sm select-none"
        aria-hidden="true"
      >
        {/* Soft Organic Outer Ring / Enclosure */}
        <path
          d="M250 40C360.457 40 450 129.543 450 240C450 350.457 360.457 420 250 420C139.543 420 50 350.457 50 240C50 129.543 139.543 40 250 40Z"
          fill="#E2EEE7"
          fillOpacity="0.6"
        />

        {/* Inner Warm Ivory Base */}
        <path
          d="M250 70C343.888 70 420 146.112 420 240C420 333.888 343.888 400 250 400C156.112 400 80 333.888 80 240C80 146.112 156.112 70 250 70Z"
          fill="#FDFDFB"
        />

        {/* Soft Coral Arch Accent */}
        <path
          d="M250 110C316.274 110 370 163.726 370 230C370 296.274 316.274 350 250 350C183.726 350 130 296.274 130 230C130 163.726 183.726 110 250 110Z"
          fill="#FAE8E5"
          fillOpacity="0.7"
        />

        {/* Grounding Base Hills / Botanical Layer */}
        <path
          d="M100 340C150 310 210 330 260 300C310 270 380 300 420 340V370C420 386.569 406.569 400 390 400H110C93.4315 400 80 386.569 80 370V340H100Z"
          fill="#3A6351"
          fillOpacity="0.12"
        />

        {/* Botanical Plant / Safe Space Sanctuary Composition */}
        {/* Central Botanical Leaf Sprouts */}
        <path
          d="M250 180C250 180 280 220 280 260C280 276.569 266.569 290 250 290C233.431 290 220 276.569 220 260C220 220 250 180 250 180Z"
          fill="#3A6351"
        />
        <path
          d="M250 200C250 200 270 230 270 260C270 271.046 261.046 280 250 280C238.954 280 230 271.046 230 260C230 230 250 200 250 200Z"
          fill="#4A7C59"
        />

        {/* Left Side Organic Leaves */}
        <path
          d="M210 250C170 240 150 210 150 210C150 210 180 210 200 230C210 240 210 250 210 250Z"
          fill="#E87A64"
        />
        <path
          d="M200 280C160 280 140 250 140 250C140 250 170 250 190 270C200 280 200 280 200 280Z"
          fill="#2D5A46"
        />

        {/* Right Side Organic Leaves */}
        <path
          d="M290 250C330 240 350 210 350 210C350 210 320 210 300 230C290 240 290 250 290 250Z"
          fill="#E87A64"
        />
        <path
          d="M300 280C340 280 360 250 360 250C360 250 330 250 310 270C300 280 300 280 300 280Z"
          fill="#2D5A46"
        />

        {/* Glowing Warm Sun / Heart Symbol Above */}
        <circle cx="250" cy="150" r="22" fill="#F4E2B8" />
        <circle cx="250" cy="150" r="14" fill="#E87A64" fillOpacity="0.8" />

        {/* Floating Sparkles & Soft Orbs */}
        {/* Top Left Sparkle */}
        <path
          d="M120 120L123 130L133 133L123 136L120 146L117 136L107 133L117 130L120 120Z"
          fill="#3A6351"
          fillOpacity="0.7"
        />
        {/* Top Right Sparkle */}
        <path
          d="M380 130L383 137L390 140L383 143L380 150L377 143L370 140L377 137L380 130Z"
          fill="#E87A64"
          fillOpacity="0.8"
        />
        {/* Small Soft Orbs */}
        <circle cx="160" cy="170" r="6" fill="#4A7C59" fillOpacity="0.5" />
        <circle cx="340" cy="170" r="8" fill="#F4E2B8" />
        <circle cx="370" cy="270" r="5" fill="#3A6351" fillOpacity="0.4" />
        <circle cx="130" cy="290" r="7" fill="#E87A64" fillOpacity="0.4" />

        {/* Gentle Base Stem Connection */}
        <path
          d="M250 290V340"
          stroke="#2D5A46"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export default SafeSpaceVisual;
