import React, { useState } from "react";
import { setMySharing } from "@safespace/api-client";
import type { ChildSettings } from "@safespace/shared-types";
import { useChildSpace } from "./ChildSpaceContext";
import { ReadAloudButton } from "../speech";
import { MeadowPage } from "../landing/hero/MeadowPage";

interface Props {
  onAnswered: (s: ChildSettings) => void;
  // "question": asked once before home; "settings": changing it later.
  mode: "question" | "settings";
}

// The 15+ choice (docs/role-flow/CONTRACT.md D7, D8). Both answers carry the
// same weight; alerts are always shared, and the screen says so.
export const SharingChoice: React.FC<Props> = ({ onAnswered, mode }) => {
  const { session, settings, guard } = useChildSpace();
  const [saving, setSaving] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = settings.sharing === "shared" ? true : settings.sharing === "not_shared" ? false : null;

  async function choose(share: boolean) {
    setSaving(share);
    setError(null);
    try {
      onAnswered(await guard(setMySharing(session, share)));
    } catch {
      setError("That didn't save. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  const option = (share: boolean, title: string, text: string) => (
    <button
      type="button"
      onClick={() => choose(share)}
      disabled={saving !== null}
      aria-pressed={mode === "settings" ? current === share : undefined}
      className={`w-full rounded-2xl border-2 px-4 py-4 text-left focus:outline-none focus:ring-2 focus:ring-botanical-700 disabled:opacity-60 ${
        current === share && mode === "settings" ? "border-botanical-700 bg-botanical-50" : "border-botanical-900/10 bg-white"
      }`}
    >
      <span className="block font-display text-base font-bold text-charcoal">{saving === share ? "Saving…" : title}</span>
      <span className="block text-sm text-charcoal/70">{text}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-display text-xl font-bold text-charcoal">
          {mode === "question" ? "Before you start: one question" : "What your grown-ups can see"}
        </h2>
        <p className="text-sm text-charcoal/80">
          Do you want your grown-ups to see your check-ins, journal, routines and AI Companion chats?
        </p>
        <ReadAloudButton
          text={'Do you want your grown-ups to see your check-ins, journal, routines and AI Companion chats? You can choose "Yes, they can see them" or "No, keep them private". Either way, if you press I need help, your grown-ups are always told.'}
          label="Read the question aloud"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {option(true, "Yes, they can see them", "They'll see what you do in SafeSpace.")}
        {option(false, "No, keep them private", "They won't see your activity.")}
      </div>
      <p className="text-xs text-charcoal/70">
        Either way, if you press "I need help" your grown-ups are always told. You can change this any time in Settings.
      </p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
};

// Shown once, before home, until a 15+ child answers.
export const SharingQuestionScreen: React.FC<{ onAnswered: (s: ChildSettings) => void }> = ({ onAnswered }) => (
  <MeadowPage>
    <div className="w-full max-w-lg rounded-[32px] bg-white/85 backdrop-blur-xl border border-white/70 p-6 shadow-2xl">
      <SharingChoice mode="question" onAnswered={onAnswered} />
    </div>
  </MeadowPage>
);
