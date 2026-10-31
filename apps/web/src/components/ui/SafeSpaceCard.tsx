import React from "react";

interface SafeSpaceCardProps {
  children: React.ReactNode;
  className?: string;
  maxW?: "sm" | "md" | "lg" | "xl" | "4xl" | "7xl" | "full";
}

export const SafeSpaceCard: React.FC<SafeSpaceCardProps> = ({
  children,
  className = "",
  maxW = "md",
}) => {
  const maxWClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "4xl": "max-w-4xl",
    "7xl": "max-w-7xl",
    full: "w-full",
  };

  return (
    <div
      className={`w-full ${maxWClasses[maxW]} bg-white/85 backdrop-blur-xl rounded-[32px] border border-white/70 shadow-2xl p-6 sm:p-8 ${className}`}
    >
      {children}
    </div>
  );
};

export default SafeSpaceCard;
