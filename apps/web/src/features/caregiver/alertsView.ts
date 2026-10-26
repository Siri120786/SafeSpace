// Pure display rules for caregiver alerts (docs/role-flow/CONTRACT.md section 7).
// No React or network here, so apps/web/tests/caregiver-alerts.test.mts can check them.
import type { AlertSource, CaregiverAlert } from "@safespace/shared-types";

// The red banner and the alerts page re-read alerts this often while open.
// In-app only: there is no live connection or push notification.
export const ALERT_POLL_MS = 60_000;

export const ALERT_SOURCE_LABELS: Record<AlertSource, string> = {
  aac_tap: "Pressed \"I need help\" on the talk board",
  check_in: "Something in a mood check-in note may mean they're struggling",
  journal_flag: "Something they wrote in their journal may mean they're struggling",
  feelings_card: "Pressed \"I want a grown-up\" on the feelings cards",
  companion_flag: "Something they wrote to the AI Companion may mean they're struggling",
};

// Safety alerts (the crisis screen matched what the child wrote). Their text
// says where it came from, never the child's words.
export const SAFETY_ALERT_SOURCES: readonly AlertSource[] = ["companion_flag", "journal_flag", "check_in"];

// Banner text for unreviewed alerts, or null when there are none.
export function alertBannerText(unreviewed: Pick<CaregiverAlert, "childName" | "source">[]): string | null {
  if (unreviewed.length === 0) return null;
  if (unreviewed.length === 1) {
    const [a] = unreviewed;
    const name = a.childName || "Your child";
    if (a.source === "aac_tap") return `${name} pressed "I need help".`;
    if (SAFETY_ALERT_SOURCES.includes(a.source)) return `Something ${name} wrote may mean they're struggling. Please check in gently.`;
    return `New alert for ${name}.`;
  }
  const names = [...new Set(unreviewed.map((a) => a.childName || "a child"))];
  const who = names.length <= 2 ? names.join(" and ") : `${names.slice(0, 2).join(", ")} and others`;
  return `${unreviewed.length} alerts need a look (${who}).`;
}

// "just now", "5 min ago", "3 h ago", then the date and time.
export function formatAlertTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return at.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Who marked it reviewed, from the viewer's point of view.
export function reviewedByText(alert: Pick<CaregiverAlert, "reviewedAt" | "reviewedBy">, myId: string): string | null {
  if (!alert.reviewedAt) return null;
  return alert.reviewedBy === myId ? "Reviewed by you" : "Reviewed by another caregiver";
}
