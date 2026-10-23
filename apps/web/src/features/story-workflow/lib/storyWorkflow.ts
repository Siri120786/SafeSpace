/**
 * Pure story workflow rules: draft -> pending_approval -> approved / rejected.
 * No React, no DOM, no database. Only a caregiver may approve or reject.
 * The word list below is a BASIC placeholder check, not real content safety
 * (see docs/content-needing-review.md).
 */

export type StoryStatus = "draft" | "pending_approval" | "approved" | "rejected";

export interface Story {
  id: string;
  title: string;
  body: string;
  status: StoryStatus;
  rejectionReason?: string;
}

export const TITLE_MAX = 80;
export const BODY_MIN = 40;
export const BODY_MAX = 2000;

/** Placeholder list. Real validation needs review. */
const FLAGGED_TERMS = ["kill", "die", "hurt yourself", "suicide", "hate yourself", "stupid", "idiot"];

export function validateStory(title: string, body: string): string[] {
  const issues: string[] = [];
  const t = title.trim();
  const b = body.trim();
  if (t.length === 0) issues.push("Please add a title.");
  if (t.length > TITLE_MAX) issues.push(`The title must be ${TITLE_MAX} characters or fewer.`);
  if (b.length < BODY_MIN) issues.push(`The story needs at least ${BODY_MIN} characters so it can be read properly.`);
  if (b.length > BODY_MAX) issues.push(`The story must be ${BODY_MAX} characters or fewer.`);
  const lower = `${t} ${b}`.toLowerCase();
  const hit = FLAGGED_TERMS.find((w) => new RegExp(`\\b${w}\\b`).test(lower));
  if (hit) issues.push("This story has wording that needs a gentler rewrite before it can be sent for approval.");
  return issues;
}

export function createDraft(id: string, title: string, body: string): Story {
  return { id, title: title.trim(), body: body.trim(), status: "draft" };
}

export type TransitionResult = { ok: true; story: Story } | { ok: false; error: string };

export function submitForApproval(story: Story): TransitionResult {
  if (story.status !== "draft" && story.status !== "rejected") {
    return { ok: false, error: "Only a draft or a rejected story can be sent for approval." };
  }
  const issues = validateStory(story.title, story.body);
  if (issues.length > 0) return { ok: false, error: issues[0] };
  return { ok: true, story: { ...story, status: "pending_approval", rejectionReason: undefined } };
}

export function approveStory(story: Story, isCaregiver: boolean): TransitionResult {
  if (!isCaregiver) return { ok: false, error: "Only a caregiver can approve a story." };
  if (story.status !== "pending_approval") return { ok: false, error: "This story is not waiting for approval." };
  return { ok: true, story: { ...story, status: "approved" } };
}

export function rejectStory(story: Story, isCaregiver: boolean, reason: string): TransitionResult {
  if (!isCaregiver) return { ok: false, error: "Only a caregiver can reject a story." };
  if (story.status !== "pending_approval") return { ok: false, error: "This story is not waiting for approval." };
  const r = reason.trim();
  if (r.length === 0) return { ok: false, error: "Please give a short reason so the story can be improved." };
  return { ok: true, story: { ...story, status: "rejected", rejectionReason: r } };
}

export function canRead(story: Story): boolean {
  return story.status === "approved";
}

export const STATUS_LABELS: Record<StoryStatus, string> = {
  draft: "Draft",
  pending_approval: "Waiting for approval",
  approved: "Approved",
  rejected: "Needs changes",
};
