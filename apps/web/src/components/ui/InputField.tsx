import React, { useState } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  isPassword?: boolean;
}

export const InputField: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  isPassword = false,
  className = "",
  type = "text",
  id,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5 text-left font-sans">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-textHeading">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          id={inputId}
          type={isPassword ? (showPassword ? "text" : "password") : type}
          className={`w-full px-4 py-3.5 rounded-2xl bg-white border text-textHeading placeholder:text-textMuted/60 text-sm md:text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-olive-500 focus:border-transparent ${
            error ? "border-red-400 bg-red-50/20" : "border-olive-200/80 shadow-sm"
          } ${className}`}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 text-xs font-medium text-textMuted hover:text-textHeading focus:outline-none transition-colors"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        )}
      </div>

      {error ? (
        <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5">
          <svg className="w-3.5 h-3.5 shrink-0 fill-current" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p className="text-xs text-textMuted mt-0.5">{helperText}</p>
      ) : null}
    </div>
  );
};
