/**
 * SafeSpace ADHD Habit Tracker Service
 * Sprint 3 Workstream B
 *
 * Local device persistence for daily habit check-offs.
 * Backed by LocalDeviceStore for habits list ("safespace.ws-b.adhd.habits")
 * and habit logs ("safespace.ws-b.adhd.habit-log").
 */

import { LocalDeviceStore } from "../../../wellness-ui";
import { DEFAULT_SAMPLE_HABITS, toggleHabitLog } from "../lib/habitLogic";
import type { HabitItem, HabitLog } from "../types";

export interface HabitService {
  listHabits(): Promise<HabitItem[]>;
  addHabit(title: string, icon?: string): Promise<HabitItem>;
  removeHabit(id: string): Promise<void>;
  getLog(): Promise<HabitLog>;
  toggleDay(
    habitId: string,
    dateKey: string
  ): Promise<{ updatedLog: HabitLog; isNowChecked: boolean }>;
  resetToSampleHabits(): Promise<HabitItem[]>;
}

export const HABITS_FEATURE_KEY = "adhd.habits";
export const HABIT_LOG_FEATURE_KEY = "adhd.habit-log";

export class LocalHabitService implements HabitService {
  private habitStore: LocalDeviceStore<HabitItem[]>;
  private logStore: LocalDeviceStore<HabitLog>;

  constructor(
    customHabitStore?: LocalDeviceStore<HabitItem[]>,
    customLogStore?: LocalDeviceStore<HabitLog>
  ) {
    this.habitStore =
      customHabitStore ??
      new LocalDeviceStore<HabitItem[]>(HABITS_FEATURE_KEY, {
        validator: (data): data is HabitItem[] => Array.isArray(data),
      });

    this.logStore =
      customLogStore ??
      new LocalDeviceStore<HabitLog>(HABIT_LOG_FEATURE_KEY, {
        validator: (data): data is HabitLog =>
          typeof data === "object" && data !== null && !Array.isArray(data),
      });
  }

  async listHabits(): Promise<HabitItem[]> {
    const list = this.habitStore.get([]);
    if (list.length === 0) {
      return this.resetToSampleHabits();
    }
    return list;
  }

  async addHabit(title: string, icon = "🌱"): Promise<HabitItem> {
    const habits = await this.listHabits();
    const newHabit: HabitItem = {
      id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim() || "Gentle habit",
      icon,
      createdAt: Date.now(),
    };
    const updated = [...habits, newHabit];
    this.habitStore.set(updated);
    return newHabit;
  }

  async removeHabit(id: string): Promise<void> {
    const habits = await this.listHabits();
    const updated = habits.filter((h) => h.id !== id);
    this.habitStore.set(updated);
  }

  async getLog(): Promise<HabitLog> {
    return this.logStore.get({});
  }

  async toggleDay(
    habitId: string,
    dateKey: string
  ): Promise<{ updatedLog: HabitLog; isNowChecked: boolean }> {
    const currentLog = await this.getLog();
    const { updatedLog, isNowChecked } = toggleHabitLog(currentLog, habitId, dateKey);
    this.logStore.set(updatedLog);
    return { updatedLog, isNowChecked };
  }

  async resetToSampleHabits(): Promise<HabitItem[]> {
    const samples: HabitItem[] = DEFAULT_SAMPLE_HABITS.map((h, idx) => ({
      ...h,
      id: `sample-habit-${idx + 1}`,
      createdAt: Date.now(),
    }));
    this.habitStore.set(samples);
    return samples;
  }
}
