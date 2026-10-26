import React from "react";
import type { SafetyNotice } from "@safespace/shared-types";

// What a child sees after writing something that tripped the crisis screen
// (journal, mood check-in note): the fixed safety message and, when their
// caregivers were alerted, the gentle note saying so. The server decides
// both (supabase/functions/_shared/safety.ts); this only shows them.
export const SafetyNoticeCard: React.FC<{ safety: SafetyNotice; onClose?: () => void }> = ({ safety, onClose }) => (
  <section role="alert" className="rounded-3xl border-2 border-sky-200 bg-sky-50 p-5 text-charcoal space-y-2">
    <h2 className="font-display text-lg font-bold">You're not alone</h2>
    <p className="text-sm leading-relaxed">{safety.message}</p>
    {safety.notice && <p className="text-sm font-semibold text-botanical-800">{safety.notice}</p>}
    {onClose && (
      <button
        type="button"
        onClick={onClose}
        className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-botanical-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-botanical-700"
      >
        OK
      </button>
    )}
  </section>
);

export default SafetyNoticeCard;
