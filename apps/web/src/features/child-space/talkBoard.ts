// Pure rules for the talk board (docs/role-flow/CONTRACT.md section 7, D13).
// Phrases are spoken on the device and never stored, except "I need help",
// which raises an alert to every caregiver. No React or network, so
// apps/web/tests/talk-board.test.mts can check them.
import { HELP_PHRASE, TALK_BOARD_PHRASES, type TalkBoardPhrase } from "@safespace/shared-types";
import { isSessionEnded } from "./childHome";

export const PHRASE_EMOJI: Record<TalkBoardPhrase, string> = {
  "I need a break": "✋",
  "Too loud": "🔇",
  "I'm hungry": "🍎",
  "Not right now": "⏸️",
  Yes: "👍",
  No: "👎",
  "I feel happy": "😊",
  "I need help": "🆘",
};

// Every phrase except help, in the contract's order; help gets its own button.
export const EVERYDAY_PHRASES = TALK_BOARD_PHRASES.filter((p) => p !== HELP_PHRASE);

export type HelpState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }                         // a new alert, or the same one again within 2 minutes
  | { kind: "failed"; sessionEnded: boolean };

// What the child reads after pressing "I need help". Never silent: a failure
// always says to find a grown-up nearby.
export function helpMessage(state: HelpState): string | null {
  switch (state.kind) {
    case "idle":
      return null;
    case "sending":
      return "Telling your grown-up…";
    case "sent":
      return "Your grown-up has been told. If you need help right now, find a grown-up near you.";
    case "failed":
      return state.sessionEnded
        ? "We couldn't tell your grown-up because you need to sign in again. Find a grown-up near you now."
        : "We couldn't reach your grown-up. Find a grown-up near you now.";
  }
}

export function helpFailed(err: unknown): HelpState {
  return { kind: "failed", sessionEnded: isSessionEnded(err) };
}
