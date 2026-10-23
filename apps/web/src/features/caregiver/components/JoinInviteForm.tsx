import React, { useState } from "react";
import { acceptCaregiverInvite, normaliseInviteCode } from "@safespace/api-client";
import { InputField } from "../../../components/ui/InputField";
import { Button } from "../../../components/ui/Button";

const INVITE_ERRORS: Record<string, string> = {
  invite_invalid: "That invite code isn't valid or has expired. Ask for a new one.",
  already_caregiver: "You already help look after this child.",
};

interface Props {
  onJoined: () => void;
  submitLabel?: string;
}

// Enter a one-time invite code from a child's primary caregiver to become a
// co-caregiver (docs/role-flow/CONTRACT.md section 4). Used in onboarding and
// at /caregiver/join.
export const JoinInviteForm: React.FC<Props> = ({ onJoined, submitLabel = "Join" }) => {
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = normaliseInviteCode(code).length === 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setError(null);
    setJoining(true);
    try {
      await acceptCaregiverInvite(code);
      onJoined();
    } catch (err: unknown) {
      const c = err instanceof Error ? err.message : "";
      setError(INVITE_ERRORS[c] ?? "Couldn't join with that code right now. Please try again.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-left">
      <InputField
        label="Invite code"
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="e.g. ABCD-2345"
        helperText="Codes work once and last 48 hours."
        autoComplete="off"
        autoFocus
      />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" variant="primary" fullWidth size="lg" disabled={!ready || joining}>
        {joining ? "Joining..." : submitLabel}
      </Button>
    </form>
  );
};
