import React from "react";

interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  variant?: "olive" | "green" | "neutral" | "pink";
  size?: "sm" | "md";
  className?: string;
  icon?: React.ReactNode;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  active = false,
  onClick,
  variant = "olive",
  size = "md",
  className = "",
  icon,
}) => {
  const baseClasses =
    "inline-flex items-center gap-1.5 font-sans rounded-full transition-all duration-200 select-none";

  const sizeClasses = {
    sm: "px-3 py-1 text-xs font-medium",
    md: "px-4 py-2 text-xs md:text-sm font-medium",
  };

  const activeStyles = {
    olive: "bg-olive-500 text-white shadow-sm",
    green: "bg-deepGreen text-white shadow-sm",
    neutral: "bg-darkBtn text-white shadow-sm",
    pink: "bg-mascotPink text-white shadow-sm",
  };

  const inactiveStyles = {
    olive: "bg-olive-50 text-olive-700 hover:bg-olive-100 border border-olive-200/60",
    green: "bg-deepGreen-50 text-deepGreen-700 hover:bg-deepGreen-100 border border-deepGreen-200/60",
    neutral: "bg-white text-textBody hover:bg-black/5 border border-black/10",
    pink: "bg-mascotPink-soft text-mascotPink-dark hover:bg-mascotPink/20 border border-mascotPink/20",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`${baseClasses} ${sizeClasses[size]} ${
        active ? activeStyles[variant] : inactiveStyles[variant]
      } ${onClick ? "cursor-pointer active:scale-95" : "cursor-default"} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
    </button>
  );
};
