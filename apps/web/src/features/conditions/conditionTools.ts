// The ADHD and autism tools (Manju's Workstream B, role-flow step 8c) and who
// sees them first. A person's own modules' tools sit on their home; the rest
// are under "More tools", so nothing is hidden, only ordered. Children's
// modules are the ones a caregiver assigned; an Individual's are the support
// areas they chose. No React here, so apps/web/tests/condition-tools.test.mts
// can check it.

import type { ModuleKey } from "@safespace/shared-types";

export type ConditionToolKey = "focus" | "feelings" | "countdown";

export interface ConditionTool {
  key: ConditionToolKey;
  module: ModuleKey;
  label: string;
  emoji: string;
  blurb: string;
}

export const CONDITION_TOOLS: readonly ConditionTool[] = [
  { key: "focus", module: "adhd", label: "Focus Zone", emoji: "🎯", blurb: "Focus timers, small steps for big tasks, habits and stars." },
  { key: "feelings", module: "autism", label: "Feelings", emoji: "💛", blurb: "Pick a card to show how you feel." },
  { key: "countdown", module: "autism", label: "Countdown", emoji: "⏳", blurb: "A calm countdown before something changes." },
];

export function findConditionTool(key: string | undefined): ConditionTool | null {
  return CONDITION_TOOLS.find((t) => t.key === key) ?? null;
}

// The person's own tools first, the others for "More tools".
export function splitConditionTools(modules: readonly ModuleKey[]): { mine: ConditionTool[]; more: ConditionTool[] } {
  const mine = CONDITION_TOOLS.filter((t) => modules.includes(t.module));
  const more = CONDITION_TOOLS.filter((t) => !modules.includes(t.module));
  return { mine, more };
}

// Where each tool lives for a child and for an Individual.
export const childToolPath = (key: ConditionToolKey) => `/child/tools/${key}`;
export const individualToolPath = (key: ConditionToolKey) => `/tools/${key}`;
