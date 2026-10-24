import React, { useEffect, useState } from "react";
import {
  BigButton,
  DeviceOnlyNote,
  EmptyState,
  ErrorState,
  LoadingState,
  SoftBadge,
  useReducedMotion,
  WellnessCard,
} from "../../../wellness-ui";
import { createScheduleService } from "../services";
import type { ScheduleStep, ScheduleStepRole } from "../types";

// Where the steps come from when they are the person's own routines (role-
// flow 8d): today's steps from the routine schedule, ticked through routine
// completion. Then the grown-up editing, sample steps and "reset" are hidden:
// routines are set up in the routine builder, and ticks start fresh each day.
export interface ScheduleSource {
  load(): Promise<ScheduleStep[]>;
  setComplete(stepId: string, complete: boolean): Promise<void>;
  emptyText: string;
}

export interface VisualScheduleProps {
  className?: string;
  initialSteps?: ScheduleStep[];
  source?: ScheduleSource;
}

export const VisualSchedule: React.FC<VisualScheduleProps> = ({
  className = "",
  initialSteps,
  source,
}) => {
  const service = createScheduleService();
  const { reducedMotion } = useReducedMotion();

  const [steps, setSteps] = useState<ScheduleStep[]>(initialSteps ?? []);
  const [loading, setLoading] = useState(initialSteps === undefined);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // New step creation form in edit mode
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("🌱");

  const loadSteps = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = source ? await source.load() : await service.listSteps();
      setSteps(data);
    } catch {
      setError("We could not load your routine schedule right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSteps();
  }, []);

  const handleToggleComplete = async (step: ScheduleStep) => {
    if (source) {
      const done = !step.isComplete;
      setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, isComplete: done } : s)));
      try {
        await source.setComplete(step.id, done);
      } catch {
        setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, isComplete: !done } : s)));
        setError("That step didn't save. Please try again.");
      }
      return;
    }
    try {
      const updated = await service.setComplete(step.id, !step.isComplete);
      setSteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch {
      // Keep local state responsive
    }
  };

  const handleResetAll = async () => {
    try {
      const updated = await Promise.all(
        steps.map((s) => service.setComplete(s.id, false))
      );
      setSteps(updated);
    } catch {
      // Graceful local handling
    }
  };

  const handleLoadSamples = async () => {
    try {
      const samples = await service.resetToSampleSteps();
      setSteps(samples);
    } catch {
      setError("Could not load sample steps.");
    }
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    try {
      const created = await service.addStep({
        label: newLabel.trim(),
        icon: newIcon,
        isComplete: false,
        orderIndex: steps.length,
      });
      setSteps((prev) => [...prev, created]);
      setNewLabel("");
    } catch {
      setError("Could not add step.");
    }
  };

  const handleRemoveStep = async (id: string) => {
    try {
      await service.removeStep(id);
      setSteps((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("Could not delete step.");
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const newSteps = [...steps];
    const [moved] = newSteps.splice(index, 1);
    newSteps.splice(targetIndex, 0, moved);

    const reorderedIds = newSteps.map((s) => s.id);
    setSteps(newSteps);
    try {
      await service.reorder(reorderedIds);
    } catch {
      // Restore on failure
      loadSteps();
    }
  };

  // Derive Step Roles (Now, Next, Later, Done)
  let incompleteCount = 0;
  const stepsWithRoles = steps.map((step) => {
    if (step.isComplete) {
      return { ...step, role: "done" as ScheduleStepRole };
    }
    incompleteCount++;
    if (incompleteCount === 1) {
      return { ...step, role: "now" as ScheduleStepRole };
    }
    if (incompleteCount === 2) {
      return { ...step, role: "next" as ScheduleStepRole };
    }
    return { ...step, role: "later" as ScheduleStepRole };
  });

  const isAllDone = steps.length > 0 && steps.every((s) => s.isComplete);

  return (
    <div className={`space-y-6 text-left font-sans ${className}`.trim()}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-olive-100 pb-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
            Visual Schedule
          </span>
          <h3 className="font-display text-2xl font-bold text-textHeading mt-1">
            Today&apos;s Routine Steps
          </h3>
          <p className="text-xs sm:text-sm text-textMuted font-light mt-0.5">
            Follow along step-by-step. Tap any card when you are finished.
          </p>
        </div>
        {!source && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditMode((prev) => !prev)}
            aria-pressed={isEditMode}
            className={`min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-semibold border transition-all ${
              isEditMode
                ? "bg-darkBtn text-white border-darkBtn shadow-pill"
                : "bg-white text-textBody border-olive-200 hover:bg-olive-50"
            }`}
          >
            {isEditMode ? "Exit Edit Mode" : "Grown-Up Edit Mode"}
          </button>
          <DeviceOnlyNote compact />
        </div>
        )}
      </div>

      {loading ? (
        <LoadingState message="Loading your schedule steps..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadSteps} />
      ) : (
        <>
          {/* Empty State */}
      {steps.length === 0 && (
        source ? (
          <EmptyState title="Nothing on the schedule today" description={source.emptyText} icon="📅" />
        ) : (
          <EmptyState
            title="No steps in this schedule yet"
            description="You can build a custom schedule or load a set of friendly morning routine steps to get started."
            icon="📅"
            action={{
              label: "Load sample morning routine",
              onClick: handleLoadSamples,
            }}
          />
        )
      )}

      {/* All Done Celebration State */}
      {isAllDone && (
        <div
          role="status"
          aria-live="polite"
          className="p-6 sm:p-8 rounded-4xl bg-gradient-to-r from-olive-50 via-white to-paleLime/40 border border-olive-200 text-center space-y-3"
        >
          <span className="text-4xl" aria-hidden="true">
            🌟
          </span>
          <h4 className="font-display text-2xl font-bold text-deepGreen-800">
            All Done for Today!
          </h4>
          {/* Content needing review: non-clinical supportive prompt */}
          <p className="text-sm text-textMuted font-light max-w-md mx-auto">
            You completed every step in your routine. Take a peaceful breath and enjoy your day.
          </p>
          {!source && (
            <div className="pt-2 flex justify-center">
              <BigButton variant="gentle" onClick={handleResetAll}>
                Reset for tomorrow
              </BigButton>
            </div>
          )}
        </div>
      )}

      {/* Schedule Step Cards List */}
      {steps.length > 0 && (
        <div
          role="list"
          aria-label="Schedule steps"
          className="space-y-3"
        >
          {stepsWithRoles.map((step, index) => {
            const isClickable = !isEditMode;

            return (
              <div
                key={step.id}
                role="listitem"
                className="relative"
              >
                <div
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  aria-pressed={isClickable ? step.isComplete : undefined}
                  onClick={isClickable ? () => handleToggleComplete(step) : undefined}
                  onKeyDown={
                    isClickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleToggleComplete(step);
                          }
                        }
                      : undefined
                  }
                  className={`w-full p-4 sm:p-5 rounded-3xl border flex items-center justify-between gap-4 transition-all ${
                    isClickable
                      ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 focus-visible:ring-offset-2"
                      : ""
                  } ${
                    step.isComplete
                      ? "bg-ivory-100/60 border-olive-100/80 opacity-75"
                      : step.role === "now"
                      ? "bg-white border-2 border-olive-500 shadow-card"
                      : "bg-white border-olive-100 shadow-soft"
                  }`}
                >
                  <div className="flex items-center gap-3.5 sm:gap-4">
                    {/* Visual Icon / Check Indicator */}
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 transition-all ${
                        step.isComplete
                          ? "bg-deepGreen text-white"
                          : step.role === "now"
                          ? "bg-olive-100 text-deepGreen-800"
                          : "bg-ivory-100 text-textMuted"
                      }`}
                    >
                      {step.isComplete ? "✓" : step.icon || "🌱"}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-display text-base sm:text-lg font-semibold ${
                            step.isComplete
                              ? "line-through text-textMuted"
                              : "text-textHeading"
                          }`}
                        >
                          {step.label}
                        </span>
                        {step.timeEstimate && (
                          <span className="text-xs text-textMuted font-light">
                            • {step.timeEstimate}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-textMuted">
                        {step.isComplete
                          ? "Completed"
                          : isClickable
                          ? "Tap when done"
                          : "Order position " + (index + 1)}
                      </p>
                    </div>
                  </div>

                  {/* Role Status Tag or Edit Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isEditMode && (
                      <>
                        {step.role === "now" && (
                          <SoftBadge variant="warm">Now</SoftBadge>
                        )}
                        {step.role === "next" && (
                          <SoftBadge variant="info">Next</SoftBadge>
                        )}
                        {step.role === "later" && (
                          <SoftBadge variant="neutral">Later</SoftBadge>
                        )}
                        {step.role === "done" && (
                          <SoftBadge variant="success">Done ✓</SoftBadge>
                        )}
                      </>
                    )}

                    {isEditMode && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleMove(index, "up")}
                          disabled={index === 0}
                          aria-label={`Move ${step.label} up`}
                          className="w-9 h-9 rounded-xl border border-olive-200 text-xs font-bold disabled:opacity-30 hover:bg-olive-50"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(index, "down")}
                          disabled={index === steps.length - 1}
                          aria-label={`Move ${step.label} down`}
                          className="w-9 h-9 rounded-xl border border-olive-200 text-xs font-bold disabled:opacity-30 hover:bg-olive-50"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(step.id)}
                          aria-label={`Delete ${step.label}`}
                          className="w-9 h-9 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grown-Up Edit Form */}
      {isEditMode && (
        <form
          onSubmit={handleAddStep}
          className="p-5 rounded-3xl bg-ivory-100/90 border border-olive-200/80 space-y-4"
        >
          <h4 className="font-display text-sm font-bold text-textHeading">
            Add a New Step to the Routine
          </h4>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              aria-label="Select step emoji"
              className="p-3 rounded-2xl bg-white border border-olive-200 text-xl shrink-0"
            >
              <option value="🌱">🌱 Plant</option>
              <option value="🪥">🪥 Brush</option>
              <option value="👕">👕 Dress</option>
              <option value="🥣">🥣 Eat</option>
              <option value="🎒">🎒 Bag</option>
              <option value="📚">📚 Read</option>
              <option value="🚶">🚶 Walk</option>
              <option value="🌙">🌙 Sleep</option>
            </select>

            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Wash hands or Put shoes on"
              className="flex-1 p-3 rounded-2xl bg-white border border-olive-200 text-sm text-textHeading placeholder:text-textMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-500"
            />

            <BigButton variant="primary" type="submit">
              Add Step
            </BigButton>
          </div>
        </form>
      )}
        </>
      )}
    </div>
  );
};
