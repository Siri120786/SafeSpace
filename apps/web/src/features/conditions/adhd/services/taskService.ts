/**
 * SafeSpace ADHD Task Breakdown Service
 * Sprint 3 Workstream B
 *
 * Local device persistence for user-defined task breakdowns.
 * Backed by LocalDeviceStore with the "safespace.ws-b.adhd.tasks" key.
 */

import { LocalDeviceStore } from "../../../wellness-ui";
import { createNewTaskItem } from "../lib/taskLogic";
import type { TaskItem } from "../types";

export interface TaskService {
  listTasks(): Promise<TaskItem[]>;
  getTask(id: string): Promise<TaskItem | null>;
  createTask(title: string, initialSteps?: string[]): Promise<TaskItem>;
  updateTask(task: TaskItem): Promise<TaskItem>;
  deleteTask(id: string): Promise<void>;
}

export const TASKS_FEATURE_KEY = "adhd.tasks";

export class LocalTaskService implements TaskService {
  private store: LocalDeviceStore<TaskItem[]>;

  constructor(customStore?: LocalDeviceStore<TaskItem[]>) {
    this.store =
      customStore ??
      new LocalDeviceStore<TaskItem[]>(TASKS_FEATURE_KEY, {
        validator: (data): data is TaskItem[] => Array.isArray(data),
      });
  }

  async listTasks(): Promise<TaskItem[]> {
    return this.store.get([]);
  }

  async getTask(id: string): Promise<TaskItem | null> {
    const tasks = await this.listTasks();
    return tasks.find((t) => t.id === id) ?? null;
  }

  async createTask(title: string, initialSteps: string[] = []): Promise<TaskItem> {
    const tasks = await this.listTasks();
    const newTask = createNewTaskItem(title, initialSteps);
    const updated = [newTask, ...tasks];
    this.store.set(updated);
    return newTask;
  }

  async updateTask(task: TaskItem): Promise<TaskItem> {
    const tasks = await this.listTasks();
    const updated = tasks.map((t) => (t.id === task.id ? task : t));
    this.store.set(updated);
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    const tasks = await this.listTasks();
    const updated = tasks.filter((t) => t.id !== id);
    this.store.set(updated);
  }
}
