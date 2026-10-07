import React from "react";

interface SparkleProps {
  size?: number;
  color?: string;
  className?: string;
}

export const Sparkle: React.FC<SparkleProps> = ({
  size = 24,
  color = "#8DA568",
  className = "",
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`animate-pulse ${className}`}
    >
      {/* 4-point Sparkle */}
      <path
        d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z"
        fill={color}
      />
    </svg>
  );
};
