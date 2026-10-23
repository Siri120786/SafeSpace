/**
 * Caregiver child view wording (docs/role-flow/CONTRACT.md section 5). Run with:
 * tsx apps/web/tests/caregiver-child-view.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import {
  SHARING_LABELS,
  ROLE_LABELS,
  aiChatsNote,
  caregiverChildPath,
  hiddenActivityText,
} from "../src/features/caregiver/childView.ts";

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

const STATUSES = ["under_15", "not_asked", "shared", "not_shared"] as const;

test("every sharing status and caregiver role has a label", () => {
  for (const s of STATUSES) assert.ok(SHARING_LABELS[s].length > 0);
  assert.ok(ROLE_LABELS.primary.includes("primary") && ROLE_LABELS.co_caregiver.includes("co-caregiver"));
});

test("hidden activity is said plainly, never shown as an empty history", () => {
  assert.equal(hiddenActivityText("Leo"), "Leo has chosen not to share their activity.");
});

test("AI chats carry a read-only note saying why they're visible", () => {
  for (const s of ["under_15", "not_asked", "shared"] as const) {
    const note = aiChatsNote("Leo", s);
    assert.ok(note && note.includes("Leo") && /read-only/.test(note), s);
  }
});

test("no AI chats note when the young person chose not to share", () => {
  assert.equal(aiChatsNote("Leo", "not_shared"), null);
});

test("child detail path encodes the id", () => {
  assert.equal(caregiverChildPath("abc-123"), "/caregiver/children/abc-123");
  assert.equal(caregiverChildPath("a/b"), "/caregiver/children/a%2Fb");
});

console.log(`${passed} caregiver-child-view checks`);
