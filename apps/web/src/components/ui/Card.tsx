import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  onClick,
  hoverable = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-3xl p-6 md:p-8 shadow-card border border-white/60 backdrop-blur-sm transition-all duration-300 ${
        hoverable ? "hover:shadow-lg hover:-translate-y-1 cursor-pointer" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
};
