import React from "react";
import { BigButton } from "./BigButton";

export interface ErrorStateProps {
  /** Friendly error heading. Defaults to a gentle non-clinical title. */
  title?: string;
  /** Gentle error explanation or reassurance. */
  message: string;
  /** Optional callback to retry the failed action. */
  onRetry?: () => void;
  /** Accessible text for the retry button. Defaults to "Try again". */
  retryLabel?: string;
  /** Additional CSS class names. */
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Take a moment",
  message,
  onRetry,
  retryLabel = "Try again",
  className = "",
}) => {
  return (
    <div
      role="alert"
      className={`rounded-3xl p-6 bg-olive-50/90 border border-olive-200 text-textHeading max-w-lg mx-auto text-center space-y-4 ${className}`.trim()}
    >
      <div
        data-decorative="true"
        className="w-12 h-12 mx-auto rounded-2xl bg-white text-olive-600 flex items-center justify-center text-xl shadow-sm"
      >
        🌿
      </div>

      <div className="space-y-1">
        <h3 className="font-display text-lg font-medium text-textHeading">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-textBody font-light leading-relaxed">
          {message}
        </p>
      </div>

      {onRetry && (
        <div className="pt-2 flex justify-center">
          <BigButton variant="primary" onClick={onRetry}>
            {retryLabel}
          </BigButton>
        </div>
      )}
    </div>
  );
};
