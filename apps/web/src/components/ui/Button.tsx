import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "olive";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  children,
  fullWidth = false,
  className = "",
  disabled = false,
  ...props
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-sans font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-olive-500 focus:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none cursor-pointer";

  const sizeClasses = {
    sm: "px-4 py-2 text-xs md:text-sm gap-1.5",
    md: "px-6 py-3 text-sm md:text-base gap-2",
    lg: "px-8 py-4 text-base md:text-lg gap-2.5 shadow-pill",
  };

  const variantClasses = {
    primary: "bg-darkBtn hover:bg-black text-white shadow-pill",
    secondary: "bg-olive-500 hover:bg-olive-600 text-white shadow-sm",
    olive: "bg-deepGreen hover:bg-deepGreen-700 text-white shadow-sm",
    outline: "bg-white/80 hover:bg-white text-textHeading border border-olive-200 shadow-sm",
    ghost: "bg-transparent text-textBody hover:bg-black/5 hover:text-textHeading",
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
