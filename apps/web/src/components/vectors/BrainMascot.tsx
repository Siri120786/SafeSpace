import React from "react";

interface Props {
  stance?: "happy" | "meditating" | "peeking" | "waving" | "celebrating";
  className?: string;
  showBubble?: boolean;
  bubbleText?: string;
  size?: number | string;
}

export const BrainMascot: React.FC<Props> = ({
  stance = "happy",
  className = "",
  showBubble = false,
  bubbleText = "How are you feeling today?",
  size = 180,
}) => {
  return (
    <div className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}>
      {/* Speech Bubble */}
      {showBubble && stance !== "peeking" && (
        <div className="absolute -top-12 z-20 animate-bounce-gentle">
          <div className="relative bg-white text-textHeading font-medium text-xs md:text-sm px-4 py-2 rounded-2xl shadow-soft border border-olive-100 flex items-center gap-1.5 whitespace-nowrap">
            <svg className="w-4 h-4 text-mascotPink fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span>{bubbleText}</span>
            {/* Bubble Tail */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 border-r border-b border-olive-100" />
          </div>
        </div>
      )}

      {/* SVG Mascot Graphic */}
      <svg
        width={size}
        height={typeof size === "number" ? size * 0.95 : size}
        viewBox="0 0 240 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-md transition-transform duration-300 hover:scale-105"
      >
        <defs>
          <radialGradient id="mascotGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FF94A8" />
            <stop offset="60%" stopColor="#FD7289" />
            <stop offset="100%" stopColor="#E0536C" />
          </radialGradient>

          <filter id="softGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <linearGradient id="auraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8DA568" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#678638" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Aura Ring for Meditating */}
        {stance === "meditating" && (
          <g className="animate-pulse">
            <circle cx="120" cy="110" r="95" fill="url(#auraGrad)" stroke="#8DA568" strokeWidth="2" strokeDasharray="6 6" />
            <path d="M 50 110 Q 120 70 190 110" stroke="#8DA568" strokeWidth="1.5" strokeOpacity="0.4" fill="none" />
          </g>
        )}

        {/* Brain Body Lobes */}
        <g filter="url(#softGlow)">
          {/* Main Rounded Brain Mass */}
          {/* Left Lobe Top */}
          <path
            d="M 65 95 C 45 65 60 30 95 35 C 110 20 135 25 145 40 C 165 25 195 45 180 80 C 205 95 200 135 175 145 C 160 165 125 170 110 155 C 80 170 45 150 45 120 C 35 105 45 95 65 95 Z"
            fill="url(#mascotGrad)"
          />

          {/* Brain Fissure Crease Lines (Organic details) */}
          <path d="M 80 50 Q 100 65 90 85 T 110 110" stroke="#E0536C" strokeWidth="3.5" strokeLinecap="round" opacity="0.4" />
          <path d="M 155 50 Q 140 70 150 90 T 130 115" stroke="#E0536C" strokeWidth="3.5" strokeLinecap="round" opacity="0.4" />
          <path d="M 70 100 Q 95 110 85 130" stroke="#E0536C" strokeWidth="3.5" strokeLinecap="round" opacity="0.4" />
          <path d="M 165 105 Q 145 120 155 135" stroke="#E0536C" strokeWidth="3.5" strokeLinecap="round" opacity="0.4" />

          {/* Rosy Cheeks */}
          <ellipse cx="78" cy="118" rx="11" ry="7" fill="#FF5271" opacity="0.45" />
          <ellipse cx="162" cy="118" rx="11" ry="7" fill="#FF5271" opacity="0.45" />

          {/* EYES */}
          {stance === "meditating" ? (
            /* Peaceful Closed Eyes */
            <g stroke="#231F20" strokeWidth="4" strokeLinecap="round">
              <path d="M 82 104 Q 92 114 102 104" fill="none" />
              <path d="M 138 104 Q 148 114 158 104" fill="none" />
              {/* Cute Lashes */}
              <line x1="82" y1="104" x2="78" y2="108" />
              <line x1="158" y1="104" x2="162" y2="108" />
            </g>
          ) : (
            /* Big Shiny Happy Eyes */
            <g>
              {/* Left Eye */}
              <circle cx="92" cy="102" r="12" fill="#231F20" />
              <circle cx="89" cy="98" r="4.5" fill="white" />
              <circle cx="95" cy="105" r="2" fill="white" />

              {/* Right Eye */}
              <circle cx="148" cy="102" r="12" fill="#231F20" />
              <circle cx="145" cy="98" r="4.5" fill="white" />
              <circle cx="151" cy="105" r="2" fill="white" />
            </g>
          )}

          {/* MOUTH */}
          {stance === "meditating" ? (
            <path d="M 112 118 Q 120 123 128 118" stroke="#231F20" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          ) : stance === "celebrating" || stance === "happy" ? (
            /* Happy Open Smile with tongue */
            <g>
              <path d="M 106 116 Q 120 134 134 116 Z" fill="#231F20" />
              <path d="M 113 124 Q 120 120 127 124 Q 120 133 113 124 Z" fill="#FF7B93" />
            </g>
          ) : (
            /* Gentle Gentle Smile */
            <path d="M 110 118 Q 120 126 130 118" stroke="#231F20" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          )}

          {/* ARMS & FEET / STANCE POSES */}
          {stance === "meditating" ? (
            /* Cross-legged Lotus Feet & Resting Hands */
            <g>
              {/* Hands resting on knees */}
              <circle cx="55" cy="148" r="9" fill="#FD7289" />
              <circle cx="185" cy="148" r="9" fill="#FD7289" />
              {/* Cross legs */}
              <path d="M 65 150 Q 120 175 175 150 Q 120 160 65 150 Z" fill="#E0536C" />
            </g>
          ) : stance === "waving" ? (
            /* Waving Right Hand */
            <g>
              <path d="M 55 125 Q 35 120 40 105" stroke="#FD7289" strokeWidth="12" strokeLinecap="round" fill="none" />
              <path d="M 185 125 Q 210 100 205 85" stroke="#FD7289" strokeWidth="12" strokeLinecap="round" fill="none" />
              {/* Waving sparkle lines */}
              <path d="M 215 75 L 225 70" stroke="#8DA568" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 210 65 L 218 58" stroke="#8DA568" strokeWidth="2.5" strokeLinecap="round" />
              {/* Little Standing Feet */}
              <ellipse cx="98" cy="162" rx="10" ry="6" fill="#E0536C" />
              <ellipse cx="142" cy="162" rx="10" ry="6" fill="#E0536C" />
            </g>
          ) : stance === "celebrating" ? (
            /* Both Arms Up in Joy */
            <g>
              <path d="M 55 120 Q 30 90 35 75" stroke="#FD7289" strokeWidth="12" strokeLinecap="round" fill="none" />
              <path d="M 185 120 Q 210 90 205 75" stroke="#FD7289" strokeWidth="12" strokeLinecap="round" fill="none" />
              {/* Feet */}
              <ellipse cx="98" cy="162" rx="10" ry="6" fill="#E0536C" />
              <ellipse cx="142" cy="162" rx="10" ry="6" fill="#E0536C" />
            </g>
          ) : stance === "peeking" ? (
            /* Hands resting on bottom frame */
            <g>
              <ellipse cx="75" cy="150" rx="12" ry="8" fill="#E0536C" />
              <ellipse cx="165" cy="150" rx="12" ry="8" fill="#E0536C" />
            </g>
          ) : (
            /* Default Happy Open Arms */
            <g>
              <path d="M 52 122 Q 32 110 38 98" stroke="#FD7289" strokeWidth="12" strokeLinecap="round" fill="none" />
              <path d="M 188 122 Q 208 110 202 98" stroke="#FD7289" strokeWidth="12" strokeLinecap="round" fill="none" />
              {/* Standing Feet */}
              <ellipse cx="96" cy="162" rx="10" ry="6" fill="#E0536C" />
              <ellipse cx="144" cy="162" rx="10" ry="6" fill="#E0536C" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};
