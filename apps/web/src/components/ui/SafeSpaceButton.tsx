import React from "react";

interface SafeSpaceButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export const SafeSpaceButton: React.FC<SafeSpaceButtonProps> = ({
  variant = "primary",
  size = "md",
  children,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyle =
    "inline-flex items-center justify-center font-bold rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const variants = {
    primary:
      "bg-botanical-700 hover:bg-botanical-800 text-white shadow-sm hover:shadow focus:ring-botanical-700",
    secondary:
      "bg-ivory-100 hover:bg-ivory-200 text-botanical-800 border border-botanical-200 focus:ring-botanical-700",
    ghost:
      "bg-transparent hover:bg-botanical-100/50 text-charcoal/80 hover:text-botanical-800 focus:ring-botanical-700",
    danger:
      "bg-coral-50 hover:bg-coral-100 text-coral-600 border border-coral-200 focus:ring-coral-500",
  };

  const sizes = {
    sm: "px-4 py-2 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
  };

  return (
    <button
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default SafeSpaceButton;
