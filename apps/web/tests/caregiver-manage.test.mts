/**
 * Managing a child: who can do what, and the wording (role-flow 4d,
 * docs/role-flow/CONTRACT.md section 4). Run with:
 * tsx apps/web/tests/caregiver-manage.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import {
  canDo,
  formatInviteCode,
  inviteExpiryText,
  manageErrorText,
  validatePinPair,
} from "../src/features/caregiver/manage.ts";

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

test("primary only: details, PIN reset, invites, removing caregivers", () => {
  for (const a of ["edit_details", "reset_pin", "invite", "remove_caregiver"] as const) {
    assert.equal(canDo("primary", a), true, a);
    assert.equal(canDo("co_caregiver", a), false, a);
  }
});

test("any caregiver: modules and appearance", () => {
  for (const a of ["edit_modules", "edit_appearance"] as const) {
    assert.equal(canDo("primary", a), true, a);
    assert.equal(canDo("co_caregiver", a), true, a);
  }
});

test("only a co-caregiver can leave; the primary can't", () => {
  assert.equal(canDo("co_caregiver", "leave"), true);
  assert.equal(canDo("primary", "leave"), false);
});

test("no role means nothing is offered", () => {
  assert.equal(canDo(undefined, "edit_modules"), false);
});

test("contract errors read as plain sentences; unknown ones get a fallback", () => {
  assert.match(manageErrorText(new Error("not_primary_caregiver")), /Only the primary/);
  assert.match(manageErrorText(new Error("pin_already_used_in_family")), /already uses this PIN/);
  assert.match(manageErrorText(new Error("rate_limited")), /5 open invite codes/);
  assert.equal(manageErrorText(new Error("weird")), "That didn't save. Please try again.");
  assert.equal(manageErrorText("not an error"), "That didn't save. Please try again.");
});

test("invite codes are shown in two halves", () => {
  assert.equal(formatInviteCode("ABCD2345"), "ABCD-2345");
  assert.equal(formatInviteCode("SHORT"), "SHORT");
});

test("invite expiry says it works once", () => {
  assert.match(inviteExpiryText("2026-10-25T14:05:00Z"), /^Works once, until .+\.$/);
});

test("PIN reset needs 4 digits, typed twice the same", () => {
  assert.equal(validatePinPair("12a4", "12a4"), "The PIN must be 4 digits.");
  assert.equal(validatePinPair("1234", "1243"), "The two PINs don't match.");
  assert.equal(validatePinPair("1234", "1234"), null);
});

console.log(`${passed} caregiver-manage checks`);
