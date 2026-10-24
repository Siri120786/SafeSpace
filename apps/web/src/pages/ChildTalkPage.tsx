import React, { useState } from "react";
import { Link } from "react-router-dom";
import { raiseHelpAlert } from "@safespace/api-client";
import { HELP_PHRASE, type TalkBoardPhrase } from "@safespace/shared-types";
import {
  ChildPageShell,
  EVERYDAY_PHRASES,
  PHRASE_EMOJI,
  helpFailed,
  helpMessage,
  speakPhrase,
  useChildSpace,
  type HelpState,
} from "../features/child-space";
import { ROUTES } from "../routes";

const speaker = () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);
const utterance = (t: string) => new SpeechSynthesisUtterance(t);

// /child/talk: tap a phrase to hear it. Nothing is saved, except that
// "I need help" alerts every caregiver straight away (no "are you sure?"; a
// repeat within 2 minutes is the same alert). In-app only.
export const ChildTalkPage: React.FC = () => {
  const { session } = useChildSpace();
  const [last, setLast] = useState<TalkBoardPhrase | null>(null);
  const [help, setHelp] = useState<HelpState>({ kind: "idle" });

  function say(p: TalkBoardPhrase) {
    setLast(p);
    speakPhrase(p, speaker(), utterance);
  }

  async function needHelp() {
    say(HELP_PHRASE);
    setHelp({ kind: "sending" });
    try {
      // Not wrapped in the session-ended redirect: if this fails, the child
      // must stay here and read what to do, not be sent to the PIN page.
      await raiseHelpAlert(session);
      setHelp({ kind: "sent" });
    } catch (e) {
      setHelp(helpFailed(e));
    }
  }

  const message = helpMessage(help);
  return (
    <ChildPageShell title="Talk board" backTo={ROUTES.CHILD_HOME}>
      <p className="text-sm text-charcoal/80">Tap a picture to say it out loud.</p>

      <div aria-live="polite" className="min-h-[3.5rem] rounded-3xl bg-white px-5 py-3 text-center shadow-card">
        {last && (
          <p className="font-display text-3xl font-bold">
            <span aria-hidden="true">{PHRASE_EMOJI[last]} </span>
            {last}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {EVERYDAY_PHRASES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => say(p)}
            className="flex min-h-[7rem] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-botanical-900/10 bg-white p-3 text-center shadow-card focus:outline-none focus:ring-4 focus:ring-botanical-700"
          >
            <span aria-hidden="true" className="text-5xl">{PHRASE_EMOJI[p]}</span>
            <span className="font-display text-lg font-bold">{p}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={needHelp}
        disabled={help.kind === "sending"}
        className="flex w-full items-center justify-center gap-3 rounded-3xl bg-red-600 px-5 py-6 text-white shadow-card focus:outline-none focus:ring-4 focus:ring-red-300 disabled:opacity-80"
      >
        <span aria-hidden="true" className="text-5xl">{PHRASE_EMOJI[HELP_PHRASE]}</span>
        <span className="font-display text-2xl font-bold">{HELP_PHRASE}</span>
      </button>

      {message && (
        <div
          role={help.kind === "failed" ? "alert" : "status"}
          className={`rounded-3xl px-5 py-4 text-base font-semibold ${help.kind === "failed" ? "bg-red-50 text-red-800 border-2 border-red-300" : "bg-botanical-50 text-botanical-800"}`}
        >
          <p>{message}</p>
          {help.kind === "failed" && help.sessionEnded && (
            <Link to={ROUTES.CHILD_PIN} className="mt-2 inline-block underline">Sign in again</Link>
          )}
        </div>
      )}

      <p className="text-xs text-charcoal/70">
        Your grown-ups see "I need help" in SafeSpace. It doesn't phone or text anyone.
      </p>
    </ChildPageShell>
  );
};

export default ChildTalkPage;
