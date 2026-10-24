/**
 * SafeSpace ADHD Task Breakdown Pure Logic
 * Sprint 3 Workstream B
 *
 * Strictly user-controlled: no AI generation, and nothing here touches any child's routine.
 * Any future AI suggestion must go through caregiver approval.
 */

import type { TaskItem, TaskStep } from "../types";

/**
 * Reorders task steps immutably from one index to another.
 * Safely clamps target index within array bounds.
 */
export function reorderTaskSteps(
  steps: TaskStep[],
  fromIndex: number,
  toIndex: number
): TaskStep[] {
  if (
    fromIndex < 0 ||
    fromIndex >= steps.length ||
    toIndex < 0 ||
    toIndex >= steps.length ||
    fromIndex === toIndex
  ) {
    return [...steps];
  }

  const result = [...steps];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);

  return result.map((step, idx) => ({
    ...step,
    orderIndex: idx,
  }));
}

/**
 * Toggles a step's completion state.
 * Returns the updated steps, the modified step, and a boolean flag indicating if it was just completed.
 */
export function toggleTaskStep(
  steps: TaskStep[],
  stepId: string
): {
  updatedSteps: TaskStep[];
  toggledStep?: TaskStep;
  justCompleted: boolean;
} {
  let toggledStep: TaskStep | undefined;
  let justCompleted = false;

  const updatedSteps = steps.map((step) => {
    if (step.id === stepId) {
      const nextComplete = !step.isComplete;
      justCompleted = nextComplete;
      toggledStep = {
        ...step,
        isComplete: nextComplete,
        completedAt: nextComplete ? Date.now() : undefined,
      };
      return toggledStep;
    }
    return step;
  });

  return { updatedSteps, toggledStep, justCompleted };
}

/**
 * Adds a new step with sanitized label to the end of the steps list.
 */
export function addTaskStep(
  steps: TaskStep[],
  rawLabel: string,
  idGenerator = () => `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
): TaskStep[] {
  const label = rawLabel.trim();
  if (!label) return [...steps];

  const newStep: TaskStep = {
    id: idGenerator(),
    label,
    isComplete: false,
    orderIndex: steps.length,
  };

  return [...steps, newStep];
}

/**
 * Edits an existing step's label.
 */
export function editTaskStep(
  steps: TaskStep[],
  stepId: string,
  newLabel: string
): TaskStep[] {
  const sanitized = newLabel.trim();
  if (!sanitized) return [...steps];

  return steps.map((step) =>
    step.id === stepId ? { ...step, label: sanitized } : step
  );
}

/**
 * Removes a step by ID and re-indexes remaining steps.
 */
export function removeTaskStep(steps: TaskStep[], stepId: string): TaskStep[] {
  return steps
    .filter((step) => step.id !== stepId)
    .map((step, idx) => ({ ...step, orderIndex: idx }));
}

/**
 * Calculates step completion percentage.
 */
export function calculateTaskProgress(steps: TaskStep[]): {
  completed: number;
  total: number;
  percent: number;
} {
  const total = steps.length;
  if (total === 0) return { completed: 0, total: 0, percent: 0 };

  const completed = steps.filter((s) => s.isComplete).length;
  const percent = Math.round((completed / total) * 100);

  return { completed, total, percent };
}

export function createNewTaskItem(
  title: string,
  initialSteps: string[] = [],
  idGenerator = () => `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
): TaskItem {
  const steps: TaskStep[] = initialSteps
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label, idx) => ({
      id: `step-${idx}-${Date.now()}`,
      label,
      isComplete: false,
      orderIndex: idx,
    }));

  return {
    id: idGenerator(),
    title: title.trim() || "Untitled Task",
    steps,
    createdAt: Date.now(),
  };
}
