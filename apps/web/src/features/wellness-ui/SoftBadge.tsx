import React from "react";

export interface SoftBadgeProps {
  /** Badge text or inner content. */
  children: React.ReactNode;
  /** Gentle semantic variant. Defaults to "default". */
  variant?: "default" | "success" | "warm" | "info" | "neutral";
  /** Size variant. Defaults to "sm". */
  size?: "sm" | "md";
  /** Optional prepended icon or emoji. */
  icon?: React.ReactNode;
  /** Additional CSS class names. */
  className?: string;
}

const BADGE_VARIANTS: Record<NonNullable<SoftBadgeProps["variant"]>, string> = {
  default: "bg-olive-50 text-deepGreen-700 border border-olive-200/60",
  success: "bg-deepGreen-50 text-deepGreen-800 border border-deepGreen-100",
  warm: "bg-cream text-charcoal border border-amber-200/60",
  info: "bg-botanical-50 text-botanical-800 border border-botanical-200/60",
  neutral: "bg-ivory-200 text-charcoal/80 border border-black/5",
};

const BADGE_SIZES: Record<NonNullable<SoftBadgeProps["size"]>, string> = {
  sm: "text-xs px-2.5 py-1",
  md: "text-sm px-3.5 py-1.5",
};

export const SoftBadge: React.FC<SoftBadgeProps> = ({
  children,
  variant = "default",
  size = "sm",
  icon,
  className = "",
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium tracking-wide ${BADGE_SIZES[size]} ${BADGE_VARIANTS[variant]} ${className}`.trim()}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
