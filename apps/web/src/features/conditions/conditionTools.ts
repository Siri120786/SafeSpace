// The ADHD and autism tools (Manju's Workstream B, role-flow step 8c) and who
// sees them first. A person's own modules' tools sit on their home; the rest
// are under "More tools", so nothing is hidden, only ordered. Children's
// modules are the ones a caregiver assigned; an Individual's are the support
// areas they chose. No React here, so apps/web/tests/condition-tools.test.mts
// can check it.

import { ROUTINE_STEP_ICONS, type ModuleKey, type RoutineWithSteps } from "@safespace/shared-types";
import { dayPlan } from "../child-space/childHome";
import type { ScheduleStep } from "./autism/types";

export type ConditionToolKey = "schedule" | "feelings" | "countdown" | "focus";

export interface ConditionTool {
  key: ConditionToolKey;
  module: ModuleKey;
  label: string;
  emoji: string;
  blurb: string;
}

export const CONDITION_TOOLS: readonly ConditionTool[] = [
  { key: "focus", module: "adhd", label: "Focus Zone", emoji: "🎯", blurb: "Focus timers, small steps for big tasks, habits and stars." },
  { key: "schedule", module: "autism", label: "Schedule", emoji: "📅", blurb: "Today's routine, one step at a time: now, next, later." },
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

// The visual schedule shows the person's own routines for today (8d): the
// same steps, in the same time order, as Now / Next on the child's home.
// "Complete" means ticked today; routines are set up in the routine builder.
export function scheduleFromRoutines(routines: RoutineWithSteps[]): ScheduleStep[] {
  return dayPlan(routines).map((s, i) => ({
    id: s.stepId,
    label: s.label,
    timeEstimate: s.time ?? undefined,
    icon: s.icon ? ROUTINE_STEP_ICONS[s.icon].emoji : undefined,
    isComplete: s.done,
    orderIndex: i,
  }));
}

// Where each tool lives for a child and for an Individual.
export const childToolPath = (key: ConditionToolKey) => `/child/tools/${key}`;
export const individualToolPath = (key: ConditionToolKey) => `/tools/${key}`;
