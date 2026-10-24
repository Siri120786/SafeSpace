import React, { useState } from "react";
import { useLocation } from "react-router-dom";

// Shown on a home page when someone signed in through the wrong choice on the
// login page ("You're signed in as a caregiver"): the account's own role wins.
export const RoleNotice: React.FC = () => {
  const location = useLocation();
  const message = (location.state as { roleNotice?: string } | null)?.roleNotice;
  const [dismissed, setDismissed] = useState(false);
  if (!message || dismissed) return null;
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-olive-200 bg-olive-50 px-4 py-3 text-sm text-deepGreen">
      <span>{message}</span>
      <button type="button" onClick={() => setDismissed(true)} className="text-xs font-medium underline">
        OK
      </button>
    </div>
  );
};

export default RoleNotice;
