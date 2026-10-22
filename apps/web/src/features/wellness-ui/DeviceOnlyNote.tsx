import React from "react";

export interface DeviceOnlyNoteProps {
  /** Optional feature name to customize the notice context. */
  featureName?: string;
  /** Optional custom explanation text. */
  customExplanation?: string;
  /** Render compact single-line style. Defaults to false. */
  compact?: boolean;
  /** Additional CSS class names. */
  className?: string;
}

export const DeviceOnlyNote: React.FC<DeviceOnlyNoteProps> = ({
  featureName,
  customExplanation,
  compact = false,
  className = "",
}) => {
  const explanation =
    customExplanation ??
    (featureName
      ? `Your ${featureName} progress is kept private on this device and is not saved to the cloud yet.`
      : "Your changes are kept private on this device and are not saved to the cloud yet.");

  if (compact) {
    return (
      <div
        role="note"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-olive-50/80 border border-olive-200/50 text-xs text-textMuted font-light ${className}`.trim()}
      >
        <span aria-hidden="true" className="text-deepGreen">
          🔒
        </span>
        <span className="font-medium text-textHeading">Saved on this device only</span>
      </div>
    );
  }

  return (
    <div
      role="note"
      className={`rounded-2xl p-3.5 bg-olive-50/70 border border-olive-200/60 text-left flex items-start gap-3 select-none ${className}`.trim()}
    >
      <div
        className="w-7 h-7 rounded-xl bg-white border border-olive-200/60 flex items-center justify-center shrink-0 text-sm shadow-xs"
        aria-hidden="true"
        data-decorative="true"
      >
        🔒
      </div>
      <div className="space-y-0.5 text-xs">
        <p className="font-semibold text-textHeading">Saved on this device only</p>
        <p className="text-textMuted font-light leading-relaxed">{explanation}</p>
      </div>
    </div>
  );
};
