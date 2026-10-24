// Pure rules for managing a child: settings and caregivers (role-flow 4d,
// docs/role-flow/CONTRACT.md section 4). No React or network, so
// apps/web/tests/caregiver-manage.test.mts can check them. The database
// enforces the same permissions; these only decide what the page offers.
import type { ChildCaregiverRole, ChildTheme } from "@safespace/shared-types";

export type ManageAction =
  | "edit_details"      // name, birth month/year
  | "reset_pin"
  | "edit_modules"
  | "edit_appearance"   // theme, low-sensory default
  | "invite"
  | "remove_caregiver"
  | "leave";

// Contract section 4: who can do what.
const ALLOWED: Record<ManageAction, ChildCaregiverRole[]> = {
  edit_details: ["primary"],
  reset_pin: ["primary"],
  edit_modules: ["primary", "co_caregiver"],
  edit_appearance: ["primary", "co_caregiver"],
  invite: ["primary"],
  remove_caregiver: ["primary"],
  leave: ["co_caregiver"],
};

export function canDo(role: ChildCaregiverRole | undefined, action: ManageAction): boolean {
  return !!role && ALLOWED[action].includes(role);
}

export const THEME_LABELS: Record<ChildTheme, string> = {
  space: "🚀 Space",
  ocean: "🐠 Ocean",
  dinosaurs: "🦕 Dinosaurs",
  trains: "🚂 Trains",
};

// Friendly text for contract error codes on these pages.
export const MANAGE_ERRORS: Record<string, string> = {
  not_primary_caregiver: "Only the primary caregiver can do that.",
  pin_already_used_in_family: "Another child in the family already uses this PIN. Pick a different one.",
  invalid_input: "Check what you entered: birth month and year must give an age of 4 to 17.",
  invalid_request: "Enter a 4-digit PIN.",
  rate_limited: "There are already 5 open invite codes for this child. Wait for one to be used or expire.",
  not_found: "This child isn't one of yours, or no longer is.",
};

export function manageErrorText(err: unknown): string {
  const code = err instanceof Error ? err.message : "";
  return MANAGE_ERRORS[code] ?? "That didn't save. Please try again.";
}

// "ABCD2345" -> "ABCD-2345", easier to read out or type.
export function formatInviteCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

// "Works once, until Sat 25 Oct, 14:05" style text for a fresh invite.
export function inviteExpiryText(expiresAt: string): string {
  const at = new Date(expiresAt);
  const when = at.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return `Works once, until ${when}.`;
}

export function validatePinPair(pin: string, confirm: string): string | null {
  if (!/^\d{4}$/.test(pin)) return "The PIN must be 4 digits.";
  if (pin !== confirm) return "The two PINs don't match.";
  return null;
}
