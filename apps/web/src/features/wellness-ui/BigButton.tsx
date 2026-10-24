import React from "react";

export interface BigButtonProps {
  /** Button content label or elements. */
  children: React.ReactNode;
  /** Click handler. */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Button style variant. Defaults to "primary". */
  variant?: "primary" | "secondary" | "ghost" | "gentle";
  /** Whether the button is disabled. */
  disabled?: boolean;
  /** HTML button type. Defaults to "button". */
  type?: "button" | "submit" | "reset";
  /** Accessible label for screen readers. */
  ariaLabel?: string;
  /** Optional icon to prepend. */
  icon?: React.ReactNode;
  /** Stretches the button to 100% width. */
  fullWidth?: boolean;
  /** Additional CSS class names. */
  className?: string;
}

const BUTTON_VARIANTS: Record<NonNullable<BigButtonProps["variant"]>, string> = {
  primary: "bg-darkBtn text-white hover:bg-neutral-800 shadow-pill active:scale-[0.98]",
  secondary: "bg-olive-500 text-white hover:bg-olive-600 shadow-card active:scale-[0.98]",
  gentle: "bg-olive-50 text-deepGreen-700 hover:bg-olive-100 border border-olive-200/80 active:scale-[0.98]",
  ghost: "bg-transparent text-textBody hover:bg-black/5 border border-olive-200/50 active:scale-[0.98]",
};

export const BigButton: React.FC<BigButtonProps> = ({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  type = "button",
  ariaLabel,
  icon,
  fullWidth = false,
  className = "",
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      className={`min-h-[48px] min-w-[48px] px-6 py-3 rounded-2xl font-display font-medium text-base inline-flex items-center justify-center gap-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 focus-visible:ring-offset-2 ${
        fullWidth ? "w-full" : "w-auto"
      } ${
        disabled
          ? "opacity-50 cursor-not-allowed pointer-events-none"
          : "cursor-pointer"
      } ${BUTTON_VARIANTS[variant]} ${className}`.trim()}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
