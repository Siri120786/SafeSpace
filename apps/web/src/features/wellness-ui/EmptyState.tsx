import React from "react";
import { BigButton } from "./BigButton";

export interface EmptyStateProps {
  /** Main friendly title. */
  title: string;
  /** Reassuring explanatory description. */
  description?: string;
  /** Optional gentle icon or decorative illustration element. */
  icon?: React.ReactNode;
  /** Optional simple action configuration. */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Optional custom action node slot. */
  actionNode?: React.ReactNode;
  /** Additional CSS class names. */
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  actionNode,
  className = "",
}) => {
  return (
    <div
      role="status"
      className={`text-center py-12 px-6 rounded-3xl bg-ivory-100/60 border border-olive-100/60 max-w-lg mx-auto space-y-4 ${className}`.trim()}
    >
      {icon && (
        <div
          data-decorative="true"
          className="w-16 h-16 mx-auto rounded-2xl bg-olive-50 text-deepGreen flex items-center justify-center text-3xl shadow-sm"
        >
          {icon}
        </div>
      )}
      <div className="space-y-1.5">
        <h3 className="font-display text-xl font-medium text-textHeading">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-textMuted font-light leading-relaxed max-w-md mx-auto">
            {description}
          </p>
        )}
      </div>

      {(action || actionNode) && (
        <div className="pt-2 flex justify-center">
          {action ? (
            <BigButton variant="gentle" onClick={action.onClick}>
              {action.label}
            </BigButton>
          ) : (
            actionNode
          )}
        </div>
      )}
    </div>
  );
};
