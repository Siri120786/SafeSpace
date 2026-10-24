// Pure wording for the caregiver's view of a child (docs/role-flow/CONTRACT.md
// section 5). No React or network, so apps/web/tests/caregiver-child-view.test.mts can check it.
import type { ChildCaregiverRole, ChildSharingStatus } from "@safespace/shared-types";

export const SHARING_LABELS: Record<ChildSharingStatus, string> = {
  under_15: "Under 15: you see their activity",
  not_asked: "15+: hasn't chosen yet, so it's shared",
  shared: "15+: chose to share with you",
  not_shared: "15+: chose not to share",
};

export const ROLE_LABELS: Record<ChildCaregiverRole, string> = {
  primary: "You're the primary caregiver",
  co_caregiver: "You're a co-caregiver",
};

// Shown instead of an empty history, which could be mistaken for no activity.
export function hiddenActivityText(name: string): string {
  return `${name} has chosen not to share their activity.`;
}

// Why the caregiver can read the AI chats at all; null when they can't.
export function aiChatsNote(name: string, sharing: ChildSharingStatus): string | null {
  switch (sharing) {
    case "under_15":
      return `You can read these because ${name} is under 15. They're read-only.`;
    case "not_asked":
      return `${name} is 15 or over and hasn't chosen yet, so these are shared for now. They're read-only.`;
    case "shared":
      return `${name} chose to share with you. These are read-only.`;
    case "not_shared":
      return null;
  }
}

// "/caregiver/children/<id>[/section]"; the id is URL-encoded.
export function caregiverChildPath(childId: string, section?: "routines" | "reminders" | "settings" | "caregivers" | "tools"): string {
  return `/caregiver/children/${encodeURIComponent(childId)}${section ? `/${section}` : ""}`;
}
