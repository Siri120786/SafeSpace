import React from "react";

interface LeafProps {
  position?: "bottom-left" | "bottom-right" | "top-right" | "top-left";
  className?: string;
  size?: number;
}

export const LeafCluster: React.FC<LeafProps> = ({
  position = "bottom-left",
  className = "",
  size = 160,
}) => {
  const getTransform = () => {
    switch (position) {
      case "bottom-right":
        return "scaleX(-1)";
      case "top-right":
        return "rotate(180deg)";
      case "top-left":
        return "scaleY(-1)";
      default:
        return "none";
    }
  };

  return (
    <div
      className={`pointer-events-none select-none ${className}`}
      style={{ transform: getTransform() }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Main Stem */}
        <path
          d="M 10 150 Q 50 110 110 30"
          stroke="#678638"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Leaf 1 (Large Bottom Left) */}
        <path
          d="M 30 130 C 10 100 25 70 55 95 C 65 115 50 140 30 130 Z"
          fill="#8DA568"
          opacity="0.85"
        />
        <path d="M 30 130 Q 42 112 55 95" stroke="#3F5420" strokeWidth="1.5" />

        {/* Leaf 2 (Mid Right) */}
        <path
          d="M 60 100 C 85 80 110 95 90 120 C 70 125 55 115 60 100 Z"
          fill="#678638"
          opacity="0.9"
        />
        <path d="M 60 100 Q 75 110 90 120" stroke="#214434" strokeWidth="1.5" />

        {/* Leaf 3 (Top Small) */}
        <path
          d="M 90 55 C 80 35 100 20 115 35 C 120 50 105 65 90 55 Z"
          fill="#A8C47F"
          opacity="0.9"
        />

        {/* Decorative Berries */}
        <circle cx="50" cy="85" r="4.5" fill="#FD7289" />
        <circle cx="42" cy="78" r="3.5" fill="#FD7289" />
        <circle cx="58" cy="78" r="4" fill="#E0536C" />
      </svg>
    </div>
  );
};
