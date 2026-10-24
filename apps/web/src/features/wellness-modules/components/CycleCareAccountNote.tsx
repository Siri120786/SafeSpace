import React, { useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { useCycleCareStore } from "./useCycleCarePart";

// Shown at the top of the PCOS / PCOD screens when there's something to say
// about the person's saved data: it couldn't load, or Cycle Care notes from
// before (kept in this browser, not in any account) are still here. Those old
// notes can't be tied to a person, so whoever finds them chooses: save them to
// their account (only the parts their account doesn't have yet) or delete them.
export const CycleCareAccountNote: React.FC = () => {
  const store = useCycleCareStore();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!store) return null;

  if (store.status === "failed") {
    return (
      <Card className="border border-amber-200 bg-amber-50/60">
        <p role="alert" className="text-sm text-textBody">
          Your saved PCOS / PCOD data didn't load just now. Check your connection and open this page again. Changes made now may not be saved.
        </p>
      </Card>
    );
  }

  if (store.status !== "ready" || !store.legacy) return null;
  const act = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    setFailed(false);
    try {
      await fn();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="space-y-3 border border-olive-200">
      <h2 className="font-display text-lg text-textHeading">Notes from before</h2>
      <p className="text-sm text-textBody">
        Some PCOS / PCOD notes were saved in this browser before they moved to accounts. They might be yours, or
        someone else's who used this device. Save them to your account, or delete them from this device.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="olive" disabled={busy} onClick={() => act(() => store.adoptLegacy())}>
          Save them to my account
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => store.discardLegacy())}>
          Delete them
        </Button>
        {failed && <span role="alert" className="text-sm text-red-700">That didn't work. Please try again.</span>}
      </div>
    </Card>
  );
};
