// apps/web/src/features/mood/__tests__/mood-logic.test.mts
// Standalone unit tests for mood check-in client logic.
// Compatible with both browser TypeScript compiler and Node/tsx runner.
// Run with: pnpm.cmd exec tsx apps/web/src/features/mood/__tests__/mood-logic.test.mts

import {
  prepareMoodCheckInPayload,
  getFriendlyErrorMessage,
  formatCheckInTime,
} from "../utils/moodLogic";
import {
  MOOD_VALUES,
  MOOD_INTENSITY_MIN,
  MOOD_INTENSITY_MAX,
  MOOD_NOTE_MAX_LENGTH,
} from "@safespace/shared-types";
import type { MoodValue } from "@safespace/shared-types";

// Lightweight assertions compatible with tsx and tsc (no @types/node required)
function assertEqual(actual: unknown, expected: unknown, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Assertion failed: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message?: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(message || `Assertion failed: expected ${expectedStr}, received ${actualStr}`);
  }
}

function assertMatch(actual: string, pattern: RegExp, message?: string) {
  if (!pattern.test(actual)) {
    throw new Error(message || `Assertion failed: "${actual}" did not match pattern ${pattern}`);
  }
}

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(err);
    const proc = (globalThis as unknown as { process?: { exitCode: number } }).process;
    if (proc) proc.exitCode = 1;
  }
};

// 1. Validation tests
test("accepts valid mood without intensity or note", () => {
  const result = prepareMoodCheckInPayload("happy");
  assertEqual(result.valid, true);
  if (result.valid) {
    assertDeepEqual(result.payload, { mood: "happy" });
  }
});

test("accepts every mood from MOOD_VALUES", () => {
  for (const m of MOOD_VALUES) {
    const result = prepareMoodCheckInPayload(m);
    assertEqual(result.valid, true);
  }
});

test("rejects invalid or missing mood", () => {
  const r1 = prepareMoodCheckInPayload(null);
  assertEqual(r1.valid, false);
  if (!r1.valid) assertEqual(r1.error, "invalid_mood");

  const r2 = prepareMoodCheckInPayload("ecstatic_unknown" as MoodValue);
  assertEqual(r2.valid, false);
  if (!r2.valid) assertEqual(r2.error, "invalid_mood");
});

test("validates intensity in range 1-5", () => {
  const valid = prepareMoodCheckInPayload("sad", 3);
  assertEqual(valid.valid, true);
  if (valid.valid) assertEqual(valid.payload.intensity, 3);

  const tooLow = prepareMoodCheckInPayload("sad", MOOD_INTENSITY_MIN - 1);
  assertEqual(tooLow.valid, false);
  if (!tooLow.valid) assertEqual(tooLow.error, "invalid_intensity");

  const tooHigh = prepareMoodCheckInPayload("sad", MOOD_INTENSITY_MAX + 1);
  assertEqual(tooHigh.valid, false);
  if (!tooHigh.valid) assertEqual(tooHigh.error, "invalid_intensity");

  const float = prepareMoodCheckInPayload("sad", 2.5);
  assertEqual(float.valid, false);
  if (!float.valid) assertEqual(float.error, "invalid_intensity");
});

test("trims note and drops blank/whitespace notes (undefined)", () => {
  const withBlank = prepareMoodCheckInPayload("happy", null, "   ");
  assertEqual(withBlank.valid, true);
  if (withBlank.valid) {
    assertEqual(withBlank.payload.note, undefined);
  }

  const withText = prepareMoodCheckInPayload("happy", null, "  Feeling calm and rested  ");
  assertEqual(withText.valid, true);
  if (withText.valid) {
    assertEqual(withText.payload.note, "Feeling calm and rested");
  }
});

test("rejects note over MOOD_NOTE_MAX_LENGTH", () => {
  const longNote = "a".repeat(MOOD_NOTE_MAX_LENGTH + 1);
  const result = prepareMoodCheckInPayload("happy", null, longNote);
  assertEqual(result.valid, false);
  if (!result.valid) {
    assertEqual(result.error, "note_too_long");
  }
});

test("accepts note at exactly MOOD_NOTE_MAX_LENGTH", () => {
  const maxNote = "a".repeat(MOOD_NOTE_MAX_LENGTH);
  const result = prepareMoodCheckInPayload("happy", null, maxNote);
  assertEqual(result.valid, true);
  if (result.valid) {
    assertEqual(result.payload.note?.length, MOOD_NOTE_MAX_LENGTH);
  }
});

// 2. Error mapping tests
test("maps known error codes to warm user messages", () => {
  const m1 = getFriendlyErrorMessage(new Error("invalid_mood"));
  assertMatch(m1, /how you're feeling/i);

  const m2 = getFriendlyErrorMessage(new Error("invalid_intensity"));
  assertMatch(m2, /between 1 and 5/i);

  const m3 = getFriendlyErrorMessage(new Error("note_too_long"));
  assertMatch(m3, /characters/i);

  const m4 = getFriendlyErrorMessage(new Error("unsupported_session"));
  assertMatch(m4, /sign in/i);

  const m5 = getFriendlyErrorMessage(new Error("Failed to fetch"));
  assertMatch(m5, /connection/i);

  const fallback = getFriendlyErrorMessage(new Error("unknown DB crash"));
  assertMatch(fallback, /couldn't save/i);
});

// 3. Date formatter test
test("formats recent dates cleanly", () => {
  const now = new Date();
  const formatted = formatCheckInTime(now.toISOString());
  assertMatch(formatted, /^Today at \d+:\d{2}\s(AM|PM)$/);
});

console.log(`\nAll ${passed} mood client logic checks passed.`);
