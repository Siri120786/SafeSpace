/**
 * SafeSpace ADHD Task Breakdown Component
 * Sprint 3 Workstream B
 *
 * Strictly user-controlled: no AI generation, and nothing here touches any child's routine.
 * Any future AI suggestion must go through caregiver approval.
 *
 * Allows users to break big tasks down into manageable, bite-sized steps,
 * reorder steps, edit labels, and tick them off to earn stars (idempotently).
 */

import React, { useEffect, useState } from "react";
import {
  BigButton,
  DeviceOnlyNote,
  EmptyState,
  ProgressBar,
  SoftBadge,
} from "../../../wellness-ui";
import {
  addTaskStep,
  calculateTaskProgress,
  editTaskStep,
  removeTaskStep,
  reorderTaskSteps,
  toggleTaskStep,
} from "../lib/taskLogic";
import {
  createRewardService,
  createTaskService,
} from "../services";
import type { TaskItem, TaskStep } from "../types";

export interface TaskBreakdownProps {
  className?: string;
  onStepCompleted?: (step: TaskStep) => void;
}

export const TaskBreakdown: React.FC<TaskBreakdownProps> = ({
  className = "",
  onStepCompleted,
}) => {
  const taskService = createTaskService();
  const rewardService = createRewardService();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [newStepLabel, setNewStepLabel] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const loadTasks = async () => {
    try {
      const list = await taskService.listTasks();
      setTasks(list);
      if (list.length > 0 && !activeTaskId) {
        setActiveTaskId(list[0].id);
      }
    } catch {
      // Graceful local error handling
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const activeTask = tasks.find((t) => t.id === activeTaskId) || tasks[0];

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      const created = await taskService.createTask(newTaskTitle.trim());
      setTasks((prev) => [created, ...prev]);
      setActiveTaskId(created.id);
      setNewTaskTitle("");
      setIsCreatingTask(false);
    } catch {
      // Graceful local error handling
    }
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask || !newStepLabel.trim()) return;

    const updatedSteps = addTaskStep(activeTask.steps, newStepLabel);
    const updatedTask = { ...activeTask, steps: updatedSteps };

    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    setNewStepLabel("");

    try {
      await taskService.updateTask(updatedTask);
    } catch {
      // Graceful local handling
    }
  };

  const handleToggleStep = async (stepId: string) => {
    if (!activeTask) return;

    const { updatedSteps, toggledStep, justCompleted } = toggleTaskStep(
      activeTask.steps,
      stepId
    );
    const updatedTask = { ...activeTask, steps: updatedSteps };

    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );

    try {
      await taskService.updateTask(updatedTask);

      if (justCompleted && toggledStep) {
        const todayKey = new Date().toISOString().slice(0, 10);
        // Idempotently award 1 star for completed task step
        await rewardService.awardStars("task_step", toggledStep.id, todayKey, 1);
        onStepCompleted?.(toggledStep);
      }
    } catch {
      // Graceful local handling
    }
  };

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    if (!activeTask) return;
    const reordered = reorderTaskSteps(activeTask.steps, fromIndex, toIndex);
    const updatedTask = { ...activeTask, steps: reordered };

    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );

    try {
      await taskService.updateTask(updatedTask);
    } catch {
      // Graceful local handling
    }
  };

  const handleRemoveStep = async (stepId: string) => {
    if (!activeTask) return;
    const filtered = removeTaskStep(activeTask.steps, stepId);
    const updatedTask = { ...activeTask, steps: filtered };

    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );

    try {
      await taskService.updateTask(updatedTask);
    } catch {
      // Graceful local handling
    }
  };

  const handleSaveEditStep = async (stepId: string) => {
    if (!activeTask || !editingLabel.trim()) {
      setEditingStepId(null);
      return;
    }

    const edited = editTaskStep(activeTask.steps, stepId, editingLabel);
    const updatedTask = { ...activeTask, steps: edited };

    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    setEditingStepId(null);

    try {
      await taskService.updateTask(updatedTask);
    } catch {
      // Graceful local handling
    }
  };

  const progress = activeTask
    ? calculateTaskProgress(activeTask.steps)
    : { completed: 0, total: 0, percent: 0 };

  return (
    <div
      className={`p-6 sm:p-8 rounded-4xl bg-white border border-olive-200/80 shadow-soft text-left font-sans space-y-6 ${className}`.trim()}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-olive-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
              Task Breakdown
            </span>
            <SoftBadge variant="info">User Controlled</SoftBadge>
          </div>
          <h3 className="font-display text-2xl font-bold text-textHeading mt-1">
            Bite-Sized Steps
          </h3>
          <p className="text-xs sm:text-sm text-textMuted font-light mt-0.5">
            Break big goals into gentle, manageable pieces. You are in full control.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreatingTask((prev) => !prev)}
            className="min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-semibold bg-olive-50/80 text-textBody border border-olive-200 hover:bg-olive-100 transition-all"
          >
            {isCreatingTask ? "Cancel" : "＋ New Task"}
          </button>
          <DeviceOnlyNote compact />
        </div>
      </div>

      {/* New Task Creation Form */}
      {isCreatingTask && (
        <form
          onSubmit={handleCreateTask}
          className="p-4 rounded-3xl bg-olive-50/60 border border-olive-200 flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="e.g. Organize my workspace, or Science Project"
            className="flex-1 p-3 rounded-2xl bg-white border border-olive-200 text-sm text-textHeading placeholder:text-textMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-500"
          />
          <BigButton variant="primary" type="submit" className="min-h-[44px]">
            Create Task
          </BigButton>
        </form>
      )}

      {/* Task Selector Tabs (if multiple tasks exist) */}
      {tasks.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => setActiveTaskId(task.id)}
              className={`min-h-[44px] px-4 py-2 rounded-2xl text-xs font-semibold border transition-all whitespace-nowrap ${
                task.id === activeTask?.id
                  ? "bg-darkBtn text-white border-darkBtn shadow-pill"
                  : "bg-olive-50/60 text-textBody border-olive-200 hover:bg-olive-100"
              }`}
            >
              {task.title}
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {tasks.length === 0 && !isCreatingTask && (
        <EmptyState
          title="No tasks broken down yet"
          description="Type a task you'd like to break into small, doable steps."
          icon="📝"
          action={{
            label: "Create a task breakdown",
            onClick: () => setIsCreatingTask(true),
          }}
        />
      )}

      {/* Active Task Body */}
      {activeTask && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h4 className="font-display text-xl font-bold text-textHeading">
              {activeTask.title}
            </h4>
            <span className="text-xs text-textMuted">
              {progress.completed} of {progress.total} steps done ({progress.percent}%)
            </span>
          </div>

          {/* Progress Bar */}
          {progress.total > 0 && (
            <ProgressBar
              value={progress.completed}
              max={progress.total}
              label={`${activeTask.title} progress`}
              showValue
              variant="deepGreen"
            />
          )}

          {/* Steps List */}
          <div className="space-y-2.5">
            {activeTask.steps.map((step, index) => (
              <div
                key={step.id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  step.isComplete
                    ? "bg-olive-50/40 border-olive-200/60 text-textMuted"
                    : "bg-white border-olive-200 shadow-sm"
                }`}
              >
                {/* Step Toggle & Label */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleStep(step.id)}
                    aria-label={`Mark step "${step.label}" as ${
                      step.isComplete ? "incomplete" : "complete"
                    }`}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all border shrink-0 ${
                      step.isComplete
                        ? "bg-deepGreen text-white border-deepGreen"
                        : "bg-white text-textMuted border-olive-300 hover:border-olive-500"
                    }`}
                  >
                    {step.isComplete ? "✓" : index + 1}
                  </button>

                  {editingStepId === step.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        className="p-2 text-sm rounded-xl border border-olive-300 w-full"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEditStep(step.id)}
                        className="px-3 py-1.5 bg-darkBtn text-white text-xs rounded-xl"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`text-sm font-medium break-words ${
                        step.isComplete ? "line-through text-textMuted" : "text-textHeading"
                      }`}
                    >
                      {step.label}
                    </span>
                  )}
                </div>

                {/* Step Actions: Reorder & Remove (48px+ touch targets) */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleReorder(index, index - 1)}
                    aria-label={`Move "${step.label}" up`}
                    className="min-w-[40px] min-h-[40px] p-2 text-xs rounded-xl hover:bg-olive-100 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={index === activeTask.steps.length - 1}
                    onClick={() => handleReorder(index, index + 1)}
                    aria-label={`Move "${step.label}" down`}
                    className="min-w-[40px] min-h-[40px] p-2 text-xs rounded-xl hover:bg-olive-100 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStepId(step.id);
                      setEditingLabel(step.label);
                    }}
                    aria-label={`Edit step "${step.label}"`}
                    className="min-w-[40px] min-h-[40px] p-2 text-xs rounded-xl hover:bg-olive-100 text-textMuted"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveStep(step.id)}
                    aria-label={`Remove step "${step.label}"`}
                    className="min-w-[40px] min-h-[40px] p-2 text-xs rounded-xl hover:bg-rose-50 text-rose-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Step Input */}
          <form
            onSubmit={handleAddStep}
            className="flex flex-col sm:flex-row gap-2 pt-2"
          >
            <input
              type="text"
              value={newStepLabel}
              onChange={(e) => setNewStepLabel(e.target.value)}
              placeholder="Add next gentle step (e.g. Gather supplies)"
              className="flex-1 p-3.5 rounded-2xl bg-olive-50/40 border border-olive-200 text-sm text-textHeading placeholder:text-textMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-500"
            />
            <BigButton variant="primary" type="submit" className="min-h-[48px]">
              Add Step
            </BigButton>
          </form>

          {/* All steps done celebration */}
          {progress.total > 0 && progress.completed === progress.total && (
            <div
              role="status"
              aria-live="polite"
              className="p-5 rounded-3xl bg-paleLime/40 border border-olive-300 text-center space-y-2 animate-fade-in"
            >
              <span className="text-3xl" aria-hidden="true">
                🎉
              </span>
              <h5 className="font-display text-lg font-bold text-deepGreen-800">
                All Steps Finished!
              </h5>
              {/* Content needing review: non-clinical supportive prompt */}
              <p className="text-xs sm:text-sm text-textMuted font-light max-w-sm mx-auto">
                You broke down this challenge and completed each step. Take pride in your effort!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
