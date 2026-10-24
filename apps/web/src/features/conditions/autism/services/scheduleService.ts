import { createLocalDeviceStore, LocalDeviceStore } from "../../../wellness-ui";
import type { ScheduleStep } from "../types";

export interface ScheduleService {
  /** Retrieves all schedule steps in order. */
  listSteps(): Promise<ScheduleStep[]>;
  /** Appends a new step to the schedule. */
  addStep(step: Omit<ScheduleStep, "id">): Promise<ScheduleStep>;
  /** Modifies properties of an existing step. */
  updateStep(id: string, updates: Partial<Omit<ScheduleStep, "id">>): Promise<ScheduleStep>;
  /** Deletes a step from the schedule. */
  removeStep(id: string): Promise<void>;
  /** Reorders steps according to the specified array of IDs. */
  reorder(stepIds: string[]): Promise<ScheduleStep[]>;
  /** Sets completion state for a step. */
  setComplete(id: string, isComplete: boolean): Promise<ScheduleStep>;
  /** Resets or populates schedule with default sample steps. */
  resetToSampleSteps(): Promise<ScheduleStep[]>;
}

const STORE_KEY = "autism.schedule";

export const DEFAULT_SAMPLE_STEPS: ScheduleStep[] = [
  { id: "step-1", label: "Morning stretch", icon: "🌱", timeEstimate: "5 mins", isComplete: false, orderIndex: 0 },
  { id: "step-2", label: "Brush teeth", icon: "🪥", timeEstimate: "3 mins", isComplete: false, orderIndex: 1 },
  { id: "step-3", label: "Get dressed", icon: "👕", timeEstimate: "5 mins", isComplete: false, orderIndex: 2 },
  { id: "step-4", label: "Eat breakfast", icon: "🥣", timeEstimate: "15 mins", isComplete: false, orderIndex: 3 },
  { id: "step-5", label: "Pack backpack", icon: "🎒", timeEstimate: "5 mins", isComplete: false, orderIndex: 4 },
];

function isValidScheduleArray(data: unknown): data is ScheduleStep[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      typeof item?.id === "string" &&
      typeof item?.label === "string" &&
      typeof item?.isComplete === "boolean" &&
      typeof item?.orderIndex === "number"
  );
}

/**
 * Local device implementation storing schedules in localStorage.
 * Shows a visible DeviceOnlyNote in the UI; never fakes cloud persistence.
 */
export class LocalScheduleService implements ScheduleService {
  private readonly store: LocalDeviceStore<ScheduleStep[]>;

  constructor(customStore?: LocalDeviceStore<ScheduleStep[]>) {
    this.store =
      customStore ??
      createLocalDeviceStore<ScheduleStep[]>(STORE_KEY, {
        validator: isValidScheduleArray,
      });
  }

  public async listSteps(): Promise<ScheduleStep[]> {
    const raw = this.store.get([]);
    return [...raw].sort((a, b) => a.orderIndex - b.orderIndex);
  }

  public async addStep(step: Omit<ScheduleStep, "id">): Promise<ScheduleStep> {
    const existing = await this.listSteps();
    const newId = `step-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newStep: ScheduleStep = {
      ...step,
      id: newId,
      orderIndex: existing.length,
    };
    const updated = [...existing, newStep];
    this.store.set(updated);
    return newStep;
  }

  public async updateStep(
    id: string,
    updates: Partial<Omit<ScheduleStep, "id">>
  ): Promise<ScheduleStep> {
    const existing = await this.listSteps();
    const index = existing.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`Schedule step with id ${id} not found`);
    }

    const updatedStep: ScheduleStep = {
      ...existing[index],
      ...updates,
      id,
    };
    existing[index] = updatedStep;
    this.store.set(existing);
    return updatedStep;
  }

  public async removeStep(id: string): Promise<void> {
    const existing = await this.listSteps();
    const filtered = existing
      .filter((s) => s.id !== id)
      .map((s, idx) => ({ ...s, orderIndex: idx }));
    this.store.set(filtered);
  }

  public async reorder(stepIds: string[]): Promise<ScheduleStep[]> {
    const existing = await this.listSteps();
    const stepMap = new Map(existing.map((s) => [s.id, s]));

    const reordered: ScheduleStep[] = [];
    stepIds.forEach((id, idx) => {
      const step = stepMap.get(id);
      if (step) {
        reordered.push({ ...step, orderIndex: idx });
        stepMap.delete(id);
      }
    });

    // Append any steps not specified in the reorder list
    stepMap.forEach((step) => {
      reordered.push({ ...step, orderIndex: reordered.length });
    });

    this.store.set(reordered);
    return reordered;
  }

  public async setComplete(id: string, isComplete: boolean): Promise<ScheduleStep> {
    return this.updateStep(id, { isComplete });
  }

  public async resetToSampleSteps(): Promise<ScheduleStep[]> {
    this.store.set(DEFAULT_SAMPLE_STEPS);
    return DEFAULT_SAMPLE_STEPS;
  }
}

/**
 * One-line swap point for a future backend API:
 * When Siri's real API is ready, replace `return new LocalScheduleService();`
 * with `return new ApiScheduleService();`.
 */
export function createScheduleService(): ScheduleService {
  return new LocalScheduleService();
}
