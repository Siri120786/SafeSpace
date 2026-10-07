import React from "react";
import type { UserRole } from "@safespace/shared-types";
import { SafeSpaceInput } from "../../../components/ui/SafeSpaceInput";
import { SafeSpaceButton } from "../../../components/ui/SafeSpaceButton";

interface OnboardingBasicInfoStepProps {
  displayName: string;
  role: UserRole;
  onChangeDisplayName: (name: string) => void;
  onNext: () => void;
}

export const OnboardingBasicInfoStep: React.FC<OnboardingBasicInfoStepProps> = ({
  displayName,
  role,
  onChangeDisplayName,
  onNext,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const roleLabel = role === "caregiver" ? "Caregiver / Family Lead" : "Individual User";

  return (
    <div className="space-y-6">
      <div className="border-b border-botanical-900/10 pb-4">
        <h2 className="font-display text-2xl font-bold text-charcoal">Welcome to SafeSpace</h2>
        <p className="text-sm text-charcoal/70 mt-1">
          Let&apos;s personalize your experience. Tell us a bit about yourself.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <SafeSpaceInput
          label="Display Name"
          type="text"
          value={displayName}
          onChange={(e) => onChangeDisplayName(e.target.value)}
          placeholder="e.g. Alex Smith"
          helperText="This name will be used across your SafeSpace dashboard."
          autoFocus
        />

        <div className="p-4 rounded-2xl bg-botanical-50 border border-botanical-200/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-botanical-700 text-white flex items-center justify-center font-bold text-base shadow-sm">
              {role === "caregiver" ? "C" : "U"}
            </div>
            <div>
              <span className="text-xs font-bold text-botanical-800 uppercase tracking-wider">Account Role</span>
              <p className="text-sm font-semibold text-charcoal">{roleLabel}</p>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <SafeSpaceButton type="submit">
            Continue &rarr;
          </SafeSpaceButton>
        </div>
      </form>
    </div>
  );
};

export default OnboardingBasicInfoStep;
