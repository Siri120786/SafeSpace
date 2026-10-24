/**
 * SafeSpace ADHD services backed by the database (role-flow 8e).
 *
 * The same interfaces as the device-only services, saving to the signed-in
 * person's account through @safespace/api-client: a child through the
 * focus-tools Edge Function, an Individual under RLS. The factories in
 * ./index.ts pick these whenever someone is signed in.
 *
 * Components create a fresh service on every render, so nothing here relies
 * on a cache: a habit tick reads the current state before changing it.
 */
import * as realApi from "@safespace/api-client";
import type { AppSession } from "@safespace/shared-types";
import type { FocusSessionRecord, FocusStatsSummary, HabitItem, HabitLog, RewardGoal, RewardState, TaskItem } from "../types";
import { DEFAULT_REWARD_GOAL } from "../types";
import { buildRewardEventKey, type RewardSource } from "../lib/rewardLogic";
import { DEFAULT_SAMPLE_HABITS } from "../lib/habitLogic";
import { aggregateFocusStats, type FocusStatsService } from "./focusStatsService";
import type { HabitService } from "./habitService";
import type { RewardService } from "./rewardService";
import type { TaskService } from "./taskService";

export type FocusToolsApi = Pick<
  typeof realApi,
  | "addFocusSession" | "listFocusSessions" | "clearMyFocusSessions"
  | "listFocusTasks" | "createFocusTask" | "updateFocusTask" | "deleteFocusTask"
  | "listHabits" | "addHabit" | "archiveHabit" | "setHabitCheck"
  | "getStars" | "awardStars" | "claimStarGoal" | "setMyStarGoal"
>;

const toRecord = (r: realApi.FocusSessionRecordRow): FocusSessionRecord => ({
  id: r.id,
  timestamp: Date.parse(r.endedAt),
  durationSeconds: r.durationSeconds,
  mode: r.mode,
  phase: r.phase ?? undefined,
  completed: r.completed,
  activityLabel: r.activityLabel ?? undefined,
});

export class RemoteFocusStatsService implements FocusStatsService {
  constructor(private session: AppSession, private api: FocusToolsApi = realApi) {}

  async recordSession(s: Omit<FocusSessionRecord, "id" | "timestamp">): Promise<FocusSessionRecord> {
    const row = await this.api.addFocusSession(this.session, {
      durationSeconds: Math.min(14400, Math.max(1, Math.round(s.durationSeconds))),
      mode: s.mode,
      phase: s.phase ?? null,
      completed: s.completed,
      activityLabel: s.activityLabel ?? null,
    });
    return toRecord(row);
  }

  async listSessions(): Promise<FocusSessionRecord[]> {
    return (await this.api.listFocusSessions(this.session)).map(toRecord);
  }

  async getStatsSummary(nowMs = Date.now()): Promise<FocusStatsSummary> {
    return aggregateFocusStats(await this.listSessions(), nowMs);
  }

  async clearStats(): Promise<void> {
    await this.api.clearMyFocusSessions(this.session);
  }
}

const toTask = (t: realApi.FocusTask): TaskItem => ({
  id: t.id,
  title: t.title,
  steps: t.steps.map((s) => ({ ...s, completedAt: s.completedAt ?? undefined })),
  createdAt: Date.parse(t.createdAt),
  isArchived: t.isArchived,
});

export class RemoteTaskService implements TaskService {
  constructor(private session: AppSession, private api: FocusToolsApi = realApi) {}

  async listTasks(): Promise<TaskItem[]> {
    return (await this.api.listFocusTasks(this.session)).map(toTask);
  }

  async getTask(id: string): Promise<TaskItem | null> {
    return (await this.listTasks()).find((t) => t.id === id) ?? null;
  }

  async createTask(title: string, initialSteps: string[] = []): Promise<TaskItem> {
    const steps = initialSteps
      .map((label) => label.trim())
      .filter(Boolean)
      .map((label, i) => ({ id: `step-${Date.now().toString(36)}-${i}`, label, isComplete: false, orderIndex: i }));
    return toTask(await this.api.createFocusTask(this.session, title, steps));
  }

  async updateTask(task: TaskItem): Promise<TaskItem> {
    return toTask(await this.api.updateFocusTask(this.session, {
      id: task.id,
      title: task.title,
      steps: task.steps.map((s) => ({ ...s, completedAt: s.completedAt ?? null })),
      isArchived: !!task.isArchived,
    }));
  }

  async deleteTask(id: string): Promise<void> {
    await this.api.deleteFocusTask(this.session, id);
  }
}

const toHabit = (h: realApi.Habit): HabitItem => ({
  id: h.id,
  title: h.title,
  icon: h.icon ?? undefined,
  createdAt: Date.parse(h.createdAt),
  isArchived: h.isArchived,
});

const toLog = (checks: realApi.HabitCheck[]): HabitLog => {
  const log: HabitLog = {};
  for (const c of checks) (log[c.habitId] ??= {})[c.day] = true;
  return log;
};

export class RemoteHabitService implements HabitService {
  constructor(private session: AppSession, private api: FocusToolsApi = realApi) {}

  // Removed habits are archived (their history stays), so they're not listed.
  async listHabits(): Promise<HabitItem[]> {
    return (await this.api.listHabits(this.session)).habits.filter((h) => !h.isArchived).map(toHabit);
  }

  async addHabit(title: string, icon = "🌱"): Promise<HabitItem> {
    return toHabit(await this.api.addHabit(this.session, title, icon));
  }

  async removeHabit(id: string): Promise<void> {
    await this.api.archiveHabit(this.session, id);
  }

  async getLog(): Promise<HabitLog> {
    return toLog((await this.api.listHabits(this.session)).checks);
  }

  async toggleDay(habitId: string, dateKey: string): Promise<{ updatedLog: HabitLog; isNowChecked: boolean }> {
    const log = await this.getLog();
    const isNowChecked = !log[habitId]?.[dateKey];
    await this.api.setHabitCheck(this.session, habitId, dateKey, isNowChecked);
    const updatedLog: HabitLog = { ...log, [habitId]: { ...(log[habitId] ?? {}) } };
    if (isNowChecked) updatedLog[habitId][dateKey] = true;
    else delete updatedLog[habitId][dateKey];
    return { updatedLog, isNowChecked };
  }

  // Only on request: nothing is added to an account automatically.
  async resetToSampleHabits(): Promise<HabitItem[]> {
    const added: HabitItem[] = [];
    for (const h of DEFAULT_SAMPLE_HABITS) added.push(await this.addHabit(h.title, h.icon));
    return added;
  }
}

export class RemoteRewardService implements RewardService {
  constructor(private session: AppSession, private api: FocusToolsApi = realApi) {}

  // No goal yet: the same default the database uses when claiming (10 stars).
  async getState(): Promise<RewardState> {
    const s = await this.api.getStars(this.session);
    const goal: RewardGoal = s.goal
      ? { id: "goal", title: s.goal.title, targetStars: s.goal.targetStars, icon: s.goal.icon ?? undefined }
      : DEFAULT_REWARD_GOAL;
    return { currentStars: s.currentStars, lifetimeStars: s.lifetimeStars, goal, awardedEventKeys: [] };
  }

  async awardStars(source: RewardSource, sourceId: string, dateKey: string, count = 1) {
    const r = await this.api.awardStars(this.session, buildRewardEventKey(source, sourceId, dateKey), count);
    return { updatedState: await this.getState(), wasAwarded: r.awarded };
  }

  // Adults only: a child's goal is set by a caregiver.
  async setGoal(goal: Partial<RewardGoal>): Promise<RewardState> {
    const current = (await this.getState()).goal;
    await this.api.setMyStarGoal(this.session, {
      title: goal.title ?? current.title,
      targetStars: goal.targetStars ?? current.targetStars,
      icon: goal.icon ?? current.icon ?? null,
    });
    return this.getState();
  }

  async claimReward() {
    const r = await this.api.claimStarGoal(this.session);
    return { updatedState: await this.getState(), success: r.claimed };
  }

  // Stars are a history in the database; there is no reset.
  async reset(): Promise<void> {
    throw new Error("unsupported");
  }
}
