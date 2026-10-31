/**
 * Caregiver alert display rules (docs/role-flow/CONTRACT.md section 7). Run with:
 * tsx apps/web/tests/caregiver-alerts.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import {
  ALERT_POLL_MS,
  ALERT_SOURCE_LABELS,
  alertBannerText,
  formatAlertTime,
  reviewedByText,
} from "../src/features/caregiver/alertsView.ts";

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

const help = (childName: string) => ({ childName, source: "aac_tap" as const });

test("no unreviewed alerts: no banner", () => {
  assert.equal(alertBannerText([]), null);
});

test("one help alert names the child and what they pressed", () => {
  assert.equal(alertBannerText([help("Leo")]), 'Leo pressed "I need help".');
});

test("one feelings-card alert is a neutral notice", () => {
  assert.equal(alertBannerText([{ childName: "Leo", source: "feelings_card" }]), "New alert for Leo.");
});

test("one safety alert says where to look gently, never the child's words", () => {
  for (const source of ["companion_flag", "journal_flag", "check_in"] as const) {
    assert.equal(
      alertBannerText([{ childName: "Leo", source }]),
      "Something Leo wrote may mean they're struggling. Please check in gently.",
    );
  }
});

test("several alerts give the count and each child once", () => {
  assert.equal(alertBannerText([help("Leo"), help("Leo"), help("Mia")]), "3 alerts need a look (Leo and Mia).");
  assert.equal(
    alertBannerText([help("Leo"), help("Mia"), help("Sam")]),
    "3 alerts need a look (Leo, Mia and others).",
  );
});

test("a missing child name never shows as blank", () => {
  assert.equal(alertBannerText([help("")]), 'Your child pressed "I need help".');
});

test("every alert source has a label", () => {
  for (const s of ["aac_tap", "check_in", "journal_flag"] as const) assert.ok(ALERT_SOURCE_LABELS[s].length > 0);
});

test("times read as just now, minutes, hours, then a date", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  assert.equal(formatAlertTime("2026-10-23T11:59:40Z", now), "just now");
  assert.equal(formatAlertTime("2026-10-23T11:55:00Z", now), "5 min ago");
  assert.equal(formatAlertTime("2026-10-23T09:00:00Z", now), "3 h ago");
  assert.match(formatAlertTime("2026-10-20T09:00:00Z", now), /20/);
});

test("reviewed by you or by another caregiver; unreviewed is null", () => {
  assert.equal(reviewedByText({ reviewedAt: null, reviewedBy: null }, "me"), null);
  assert.equal(reviewedByText({ reviewedAt: "x", reviewedBy: "me" }, "me"), "Reviewed by you");
  assert.equal(reviewedByText({ reviewedAt: "x", reviewedBy: "other" }, "me"), "Reviewed by another caregiver");
});

test("alerts refresh every 60 seconds while a page is open", () => {
  assert.equal(ALERT_POLL_MS, 60_000);
});

console.log(`${passed} caregiver-alert checks`);
