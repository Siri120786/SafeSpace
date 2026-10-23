/**
 * Talk board rules (role-flow 5c, docs/role-flow/CONTRACT.md section 7). Run with:
 * tsx apps/web/tests/talk-board.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import { HELP_PHRASE, TALK_BOARD_PHRASES } from "@safespace/shared-types";
import {
  EVERYDAY_PHRASES,
  PHRASE_EMOJI,
  helpFailed,
  helpMessage,
  speakPhrase,
} from "../src/features/child-space/talkBoard.ts";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (e) {
    console.log(`FAIL ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

test("every phrase has a picture; help is kept apart from the everyday ones", () => {
  for (const p of TALK_BOARD_PHRASES) assert.ok(PHRASE_EMOJI[p], p);
  assert.equal(EVERYDAY_PHRASES.length, TALK_BOARD_PHRASES.length - 1);
  assert.ok(!(EVERYDAY_PHRASES as readonly string[]).includes(HELP_PHRASE));
});

test("after help is sent, the child is told, and told to find a grown-up nearby", () => {
  assert.match(helpMessage({ kind: "sent" })!, /has been told/);
  assert.match(helpMessage({ kind: "sent" })!, /find a grown-up near you/);
});

test("a failure is never silent and always says to find a grown-up", () => {
  for (const s of [helpFailed(new Error("internal_error")), helpFailed(new Error("invalid_session")), helpFailed("x")]) {
    assert.match(helpMessage(s)!, /couldn't/);
    assert.match(helpMessage(s)!, /Find a grown-up near you now/);
  }
});

test("an ended session is named, so they know to sign in again", () => {
  assert.deepEqual(helpFailed(new Error("invalid_session")), { kind: "failed", sessionEnded: true });
  assert.match(helpMessage(helpFailed(new Error("invalid_session")))!, /sign in again/);
  assert.deepEqual(helpFailed(new Error("internal_error")), { kind: "failed", sessionEnded: false });
});

test("nothing to show before help is pressed; a status while sending", () => {
  assert.equal(helpMessage({ kind: "idle" }), null);
  assert.equal(helpMessage({ kind: "sending" }), "Telling your grown-up…");
});

test("speaking stops anything already speaking, then says the phrase a little slowly", () => {
  const calls: string[] = [];
  const speaker = { cancel: () => calls.push("cancel"), speak: (u: { text: string; rate?: number }) => calls.push(`speak:${u.text}:${u.rate}`) };
  assert.equal(speakPhrase("Too loud", speaker, (t) => ({ text: t })), true);
  assert.deepEqual(calls, ["cancel", "speak:Too loud:0.9"]);
});

test("a device that can't speak still works (returns false, no throw)", () => {
  assert.equal(speakPhrase("Yes", null, (t) => ({ text: t })), false);
  const broken = { cancel: () => {}, speak: () => { throw new Error("no voices"); } };
  assert.equal(speakPhrase("Yes", broken, (t) => ({ text: t })), false);
});

console.log(`${passed} talk-board checks`);
