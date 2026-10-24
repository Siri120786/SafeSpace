/**
 * Read aloud and dictation helpers. Run with:
 * tsx apps/web/tests/speech.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import type { RoutineWithSteps } from "@safespace/shared-types";
import {
  appendTranscript,
  dictationErrorText,
  langTag,
  pickWarmVoice,
  recognitionCtor,
  WARM_PITCH,
  WARM_RATE,
  reminderSpeech,
  routineSpeech,
  speakText,
  type Utterance,
} from "../src/features/speech/speech.ts";

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

test("AI Companion languages map to Indian voice tags; unknown falls back to English", () => {
  assert.equal(langTag("hi"), "hi-IN");
  assert.equal(langTag("ur"), "ur-IN");
  assert.equal(langTag(null), "en-IN");
});

test("speaking stops what's playing, then says the text with its language", () => {
  const calls: string[] = [];
  let spoken: Utterance | null = null;
  const speaker = { cancel: () => calls.push("cancel"), speak: (u: Utterance) => { calls.push("speak"); spoken = u; } };
  assert.equal(speakText("  Hello  ", speaker, (t) => ({ text: t }), { lang: "te-IN" }), true);
  assert.deepEqual(calls, ["cancel", "speak"]);
  assert.equal(spoken!.text, "Hello");
  assert.equal(spoken!.lang, "te-IN");
});

test("nothing to say, no speaker, or a failing speaker: false, never throws", () => {
  assert.equal(speakText("   ", { cancel() {}, speak() {} }, (t) => ({ text: t })), false);
  assert.equal(speakText("Hi", null, (t) => ({ text: t })), false);
  assert.equal(speakText("Hi", { cancel() {}, speak() { throw new Error("x"); } }, (t) => ({ text: t })), false);
});

test("the end callback fires when speaking finishes or fails", () => {
  let u: Utterance | null = null;
  let ended = 0;
  speakText("Hi", { cancel() {}, speak(x) { u = x; } }, (t) => ({ text: t }), { onEnd: () => ended++ });
  u!.onend!();
  u!.onerror!();
  assert.equal(ended, 2);
});

test("dictated words join what's typed, with sentence capitals and the length cap", () => {
  assert.equal(appendTranscript("", "today was good", 100), "Today was good");
  assert.equal(appendTranscript("I went out", "and played", 100), "I went out and played");
  assert.equal(appendTranscript("It rained.", "then it stopped", 100), "It rained. Then it stopped");
  assert.equal(appendTranscript("abc", "   ", 100), "abc");
  assert.equal(appendTranscript("abcd", "efgh", 6), "abcd e");
});

test("recognition is found under either name, or not at all", () => {
  class R {}
  assert.equal(recognitionCtor({ SpeechRecognition: R }), R);
  assert.equal(recognitionCtor({ webkitSpeechRecognition: R }), R);
  assert.equal(recognitionCtor({}), null);
  assert.equal(recognitionCtor(null), null);
});

test("dictation errors read plainly; silence and cancelling say nothing", () => {
  assert.match(dictationErrorText("not-allowed")!, /microphone is blocked/);
  assert.equal(dictationErrorText("no-speech"), null);
  assert.equal(dictationErrorText("aborted"), null);
  assert.match(dictationErrorText("something-new")!, /type instead/);
});

const routine = (steps: [string, string | null, boolean][]): Pick<RoutineWithSteps, "title" | "steps"> => ({
  title: "Morning",
  steps: steps.map(([label, time, done], i) => ({ id: `s${i}`, routineId: "r", label, scheduledTime: time, orderIndex: i, icon: null, completedOnDate: done })),
});

test("a routine is read as its title, then the steps still to do", () => {
  assert.equal(
    routineSpeech(routine([["Wake up", "07:00", true], ["Brush teeth", null, false], ["Breakfast", "07:30", false]])),
    "Morning. Brush teeth. Then breakfast at 07:30.",
  );
  assert.equal(routineSpeech(routine([["Wake up", null, true]])), "Morning. All done!");
});

test("a reminder is read as a reminder", () => {
  assert.equal(reminderSpeech({ reminder: { title: "Drink water" } as any }), "Reminder: Drink water.");
});

const v = (name: string, lang: string) => ({ name, lang });

test("Edge: the natural female Indian English voice wins over male and desktop voices", () => {
  const voices = [
    v("Microsoft Ravi - English (India)", "en-IN"),
    v("Microsoft Heera - English (India)", "en-IN"),
    v("Microsoft Prabhat Online (Natural) - English (India)", "en-IN"),
    v("Microsoft Neerja Online (Natural) - English (India)", "en-IN"),
    v("Microsoft Aria Online (Natural) - English (United States)", "en-US"),
  ];
  assert.equal(pickWarmVoice(voices, "en-IN")?.name, "Microsoft Neerja Online (Natural) - English (India)");
});

test("Chrome: a female Google voice, and 'female' is never mistaken for male", () => {
  const voices = [v("Google UK English Male", "en-GB"), v("Google UK English Female", "en-GB"), v("Microsoft David - English (United States)", "en-US")];
  assert.equal(pickWarmVoice(voices, "en-IN")?.name, "Google UK English Female");
});

test("Hindi picks Swara; another language's voices are never used", () => {
  const voices = [v("Microsoft Madhur Online (Natural) - Hindi (India)", "hi-IN"), v("Microsoft Swara Online (Natural) - Hindi (India)", "hi-IN"), v("Microsoft Neerja Online (Natural) - English (India)", "en-IN")];
  assert.equal(pickWarmVoice(voices, "hi-IN")?.name, "Microsoft Swara Online (Natural) - Hindi (India)");
  assert.equal(pickWarmVoice(voices, "te-IN"), null);
});

test("a female voice in the right language beats an exact-region male one", () => {
  const voices = [v("Microsoft Ravi - English (India)", "en-IN"), v("Samantha", "en_US")];
  assert.equal(pickWarmVoice(voices, "en-IN")?.name, "Samantha");
});

test("reading uses the chosen voice, a calm pace and a mid pitch", () => {
  let u: any = null;
  const voice = v("Microsoft Neerja Online (Natural) - English (India)", "en-IN");
  speakText("Hello", { cancel() {}, speak(x) { u = x; } }, (t) => ({ text: t }), { voice });
  assert.equal(u.voice, voice);
  assert.equal(u.lang, "en-IN");
  assert.equal(u.rate, WARM_RATE);
  assert.equal(u.pitch, WARM_PITCH);
  assert.ok(WARM_RATE < 1 && WARM_PITCH > 1 && WARM_PITCH < 1.2);
});

console.log(`${passed} speech checks`);
