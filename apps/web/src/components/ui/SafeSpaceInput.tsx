import React from "react";

interface SafeSpaceInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string | null;
}

export const SafeSpaceInput = React.forwardRef<HTMLInputElement, SafeSpaceInputProps>(
  ({ label, helperText, error, className = "", id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-charcoal/80">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full px-4 py-3 bg-ivory-50 border rounded-2xl text-charcoal text-base placeholder-charcoal/40 transition-all focus:outline-none focus:ring-2 focus:ring-botanical-700 focus:bg-white ${
            error ? "border-coral-500 focus:ring-coral-500" : "border-botanical-900/15"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-coral-600 font-medium">{error}</p>}
        {helperText && !error && <p className="text-xs text-charcoal/60">{helperText}</p>}
      </div>
    );
  },
);

SafeSpaceInput.displayName = "SafeSpaceInput";

export default SafeSpaceInput;
