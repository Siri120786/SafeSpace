// The ADHD and autism tools from a caregiver's side (role-flow 8f): what the
// "Focus and feelings" card on a child's page shows, and the choices on the
// child's Tools page. Counts and lists only, never scores or labels; Manju's
// own stats and seven-day logic do the sums. No React here, so
// apps/web/tests/caregiver-tools.test.mts can check it.

import type { ChildToolsOverview, EmotionChoice, FocusTask, Habit, HabitCheck, StarGoal, StarTotals } from "@safespace/api-client";
import { aggregateFocusStats } from "./adhd/services/focusStatsService";
import { getPast7Days } from "./adhd/lib/habitLogic";
import { DEFAULT_REWARD_GOAL } from "./adhd/types";
import { DEFAULT_EMOTION_CARDS } from "./autism/emotionCardsData";
import { DEFAULT_AAC_TILES } from "./autism/services/aacService";

export function focusWeek(overview: Pick<ChildToolsOverview, "sessions">, nowMs = Date.now()) {
  const s = aggregateFocusStats(
    overview.sessions.map((r) => ({
      id: r.id, timestamp: Date.parse(r.endedAt), durationSeconds: r.durationSeconds, mode: r.mode, completed: r.completed,
    })),
    nowMs,
  );
  return { sessions: s.sessionsThisWeek, minutes: s.focusMinutesThisWeek, streakDays: s.streakDays };
}

// Unfinished tasks, newest first, up to three.
export function openTasks(tasks: FocusTask[], limit = 3) {
  return tasks
    .filter((t) => !t.isArchived && !(t.steps.length > 0 && t.steps.every((s) => s.isComplete)))
    .slice(0, limit)
    .map((t) => ({ id: t.id, title: t.title, done: t.steps.filter((s) => s.isComplete).length, total: t.steps.length }));
}

// Each habit's ticks for the last seven days (oldest first).
export function habitWeek(habits: Habit[], checks: HabitCheck[], nowMs = Date.now()) {
  const days = getPast7Days(nowMs);
  const ticked = new Set(checks.map((c) => `${c.habitId}|${c.day}`));
  return habits.filter((h) => !h.isArchived).map((h) => ({
    id: h.id,
    title: h.title,
    icon: h.icon,
    days: days.map((d) => ({ dateKey: d.dateKey, label: d.dayLabel, ticked: ticked.has(`${h.id}|${d.dateKey}`) })),
  }));
}

// Progress to the goal; no goal set means the default (as the database uses).
export function goalProgress(stars: StarTotals & { goal: StarGoal | null }) {
  const goal = stars.goal ?? { title: DEFAULT_REWARD_GOAL.title, targetStars: DEFAULT_REWARD_GOAL.targetStars, icon: DEFAULT_REWARD_GOAL.icon ?? null };
  return {
    title: goal.title,
    icon: goal.icon,
    target: goal.targetStars,
    current: stars.currentStars,
    lifetime: stars.lifetimeStars,
    percent: Math.min(100, Math.round((Math.max(0, stars.currentStars) / goal.targetStars) * 100)),
    isDefault: !stars.goal,
  };
}

// The latest feelings cards picked, each with its card's label and emoji.
export function recentFeelings(choices: EmotionChoice[], limit = 5) {
  return choices.slice(0, limit).map((c) => {
    const card = DEFAULT_EMOTION_CARDS.find((k) => k.id === c.cardId);
    return { id: c.id, label: card?.label ?? c.cardId, emoji: card?.emoji ?? "💬", at: c.createdAt };
  });
}

export function hasAnyToolActivity(o: ChildToolsOverview): boolean {
  return o.sessions.length + o.tasks.length + o.habits.length + o.feelings.length + o.stars.lifetimeStars > 0;
}

// The words a caregiver can rename on the child's talk board ("Build a
// sentence"). Not "help": help is always the "I need help" button.
export const RENAMEABLE_WORDS = DEFAULT_AAC_TILES.filter((t) => t.id !== "help");

// The labels to save: trimmed, at most 30 characters, and only the ones that
// differ from the word's own label (an empty box keeps the original).
export function wordLabelsToSave(edits: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const w of RENAMEABLE_WORDS) {
    const v = (edits[w.id] ?? "").trim().slice(0, 30);
    if (v && v !== w.label) out[w.id] = v;
  }
  return out;
}

// Countdown lengths offered, in minutes.
export const COUNTDOWN_MINUTES = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60] as const;

export const GOAL_ICONS = ["🎬", "🛝", "🍦", "🎨", "🧩", "📚", "🚲", "🎮", "🌳", "⭐"] as const;

export function validGoal(title: string, target: number): string | null {
  if (!title.trim() || title.trim().length > 60) return "Give the goal a name (up to 60 letters).";
  if (!Number.isInteger(target) || target < 1 || target > 100) return "Choose between 1 and 100 stars.";
  return null;
}
