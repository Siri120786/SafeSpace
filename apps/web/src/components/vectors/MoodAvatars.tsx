import React from "react";

export type MoodType = "ecstatic" | "happy" | "neutral" | "sad" | "stressed" | "overwhelmed";

export interface MoodOption {
  id: MoodType;
  label: string;
  color: string;
  bgClass: string;
  borderColor: string;
}

export const MOOD_LIST: MoodOption[] = [
  { id: "ecstatic", label: "Ecstatic", color: "#FFD966", bgClass: "bg-[#FFF9E6]", borderColor: "#F7C948" },
  { id: "happy", label: "Happy", color: "#8DA568", bgClass: "bg-[#F4F7EE]", borderColor: "#8DA568" },
  { id: "neutral", label: "Neutral", color: "#E0D7C6", bgClass: "bg-[#FAF7F2]", borderColor: "#C7BCA5" },
  { id: "sad", label: "Down", color: "#A4C2F4", bgClass: "bg-[#EFF4FC]", borderColor: "#6D9EEB" },
  { id: "stressed", label: "Stressed", color: "#D9D2E9", bgClass: "bg-[#F3F0F8]", borderColor: "#B4A7D6" },
  { id: "overwhelmed", label: "Overwhelmed", color: "#F6B26B", bgClass: "bg-[#FDF3E7]", borderColor: "#E69138" },
];

interface Props {
  type: MoodType;
  size?: number;
  className?: string;
  selected?: boolean;
}

export const MoodAvatar: React.FC<Props> = ({ type, size = 48, className = "", selected = false }) => {
  const mood = MOOD_LIST.find((m) => m.id === type) || MOOD_LIST[1];

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
        selected ? "scale-110 shadow-lg ring-4 ring-offset-2 ring-olive-500" : "hover:scale-105"
      } ${className}`}
    >
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="30" fill={mood.color} stroke={mood.borderColor} strokeWidth="2.5" />

        {type === "ecstatic" && (
          <g stroke="#231F20" strokeWidth="3" strokeLinecap="round">
            {/* Curved closed joyful eyes */}
            <path d="M 20 26 Q 26 18 32 26" />
            <path d="M 32 26 Q 38 18 44 26" />
            {/* Big Open Smile */}
            <path d="M 22 36 Q 32 50 42 36 Z" fill="#231F20" />
            <circle cx="20" cy="32" r="3.5" fill="#FF7B93" opacity="0.6" />
            <circle cx="44" cy="32" r="3.5" fill="#FF7B93" opacity="0.6" />
          </g>
        )}

        {type === "happy" && (
          <g stroke="#231F20" strokeWidth="3" strokeLinecap="round">
            <circle cx="22" cy="26" r="3" fill="#231F20" />
            <circle cx="42" cy="26" r="3" fill="#231F20" />
            <path d="M 22 36 Q 32 46 42 36" fill="none" />
            <circle cx="18" cy="32" r="3" fill="#678638" opacity="0.3" />
            <circle cx="46" cy="32" r="3" fill="#678638" opacity="0.3" />
          </g>
        )}

        {type === "neutral" && (
          <g stroke="#231F20" strokeWidth="3" strokeLinecap="round">
            <circle cx="22" cy="26" r="3" fill="#231F20" />
            <circle cx="42" cy="26" r="3" fill="#231F20" />
            <line x1="24" y1="40" x2="40" y2="40" />
          </g>
        )}

        {type === "sad" && (
          <g stroke="#231F20" strokeWidth="3" strokeLinecap="round">
            <circle cx="22" cy="28" r="3" fill="#231F20" />
            <circle cx="42" cy="28" r="3" fill="#231F20" />
            <path d="M 24 42 Q 32 34 40 42" fill="none" />
            {/* Tear drop */}
            <path d="M 44 32 Q 46 36 44 38 C 42 38 42 36 44 32 Z" fill="#6D9EEB" stroke="none" />
          </g>
        )}

        {type === "stressed" && (
          <g stroke="#231F20" strokeWidth="3" strokeLinecap="round">
            {/* Worried brows */}
            <line x1="18" y1="20" x2="26" y2="24" />
            <line x1="46" y1="20" x2="38" y2="24" />
            <circle cx="22" cy="28" r="3" fill="#231F20" />
            <circle cx="42" cy="28" r="3" fill="#231F20" />
            <path d="M 24 42 Q 28 38 32 42 T 40 42" fill="none" />
          </g>
        )}

        {type === "overwhelmed" && (
          <g stroke="#231F20" strokeWidth="3" strokeLinecap="round">
            {/* Spiral/dizzy or wide eyes */}
            <circle cx="22" cy="26" r="4.5" fill="none" strokeWidth="2.5" />
            <circle cx="22" cy="26" r="1.5" fill="#231F20" />
            <circle cx="42" cy="26" r="4.5" fill="none" strokeWidth="2.5" />
            <circle cx="42" cy="26" r="1.5" fill="#231F20" />
            {/* O-mouth */}
            <ellipse cx="32" cy="40" rx="5" ry="7" fill="#231F20" />
          </g>
        )}
      </svg>
    </div>
  );
};
