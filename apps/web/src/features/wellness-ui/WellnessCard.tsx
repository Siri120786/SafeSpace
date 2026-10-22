import React from "react";

export interface WellnessCardProps {
  /** Optional title heading displayed inside the card header. */
  title?: string;
  /** Optional subtitle or descriptive text below the title. */
  subtitle?: string;
  /** Optional badge or pill element displayed in the top-right or header. */
  badge?: React.ReactNode;
  /** Optional primary action or button slot. */
  action?: React.ReactNode;
  /** Card body content. */
  children?: React.ReactNode;
  /** Visual presentation style. Defaults to "default". */
  variant?: "default" | "subtle" | "accent" | "bordered";
  /** Optional click handler making the card interactive. */
  onClick?: () => void;
  /** Marks the card as decorative, hiding it under simplified presentation mode. */
  dataDecorative?: boolean;
  /** Additional CSS class names. */
  className?: string;
  /** Accessible role override. Defaults to "region" or "button" if interactive. */
  role?: string;
  /** Accessible label for screen readers. */
  ariaLabel?: string;
}

const VARIANT_STYLES: Record<NonNullable<WellnessCardProps["variant"]>, string> = {
  default: "bg-white border-olive-100/80 shadow-card text-textHeading",
  subtle: "bg-ivory-100/90 border-olive-100/60 shadow-soft text-textHeading",
  accent: "bg-gradient-to-br from-cream/60 via-white to-paleLime/30 border-olive-200/80 shadow-card text-textHeading",
  bordered: "bg-white border-2 border-olive-300 shadow-none text-textHeading",
};

export const WellnessCard: React.FC<WellnessCardProps> = ({
  title,
  subtitle,
  badge,
  action,
  children,
  variant = "default",
  onClick,
  dataDecorative,
  className = "",
  role,
  ariaLabel,
}) => {
  const isClickable = typeof onClick === "function";
  const defaultRole = isClickable ? "button" : title ? "region" : undefined;
  const resolvedRole = role ?? defaultRole;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isClickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role={resolvedRole}
      aria-label={ariaLabel}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      data-decorative={dataDecorative ? "true" : undefined}
      className={`rounded-3xl p-6 border transition-all ${VARIANT_STYLES[variant]} ${
        isClickable
          ? "cursor-pointer hover:border-olive-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 focus-visible:ring-offset-2"
          : ""
      } ${className}`.trim()}
    >
      {(title || subtitle || badge || action) && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="space-y-1 text-left">
            {title && (
              <h3 className="font-display text-xl font-medium text-textHeading leading-snug">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs sm:text-sm text-textMuted font-light leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {badge}
            {action}
          </div>
        </div>
      )}
      {children}
    </div>
  );
};
