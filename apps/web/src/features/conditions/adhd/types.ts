/**
 * SafeSpace ADHD Focus Zone Types
 * Sprint 3 Workstream B
 *
 * Non-clinical, supportive types for focus timers, Pomodoro cycles, and local stats.
 */

export type FocusTimerStatus = "idle" | "running" | "paused" | "completed";

export interface FocusTimerState {
  durationSeconds: number;
  remainingSeconds: number;
  status: FocusTimerStatus;
  activityLabel?: string;
}

export type PomodoroPhase = "focus" | "shortBreak" | "longBreak";
export type PomodoroStatus = "idle" | "running" | "paused" | "phaseCompleted";

export interface PomodoroConfig {
  /** Focus length in minutes: clamped to safe bounds [1, 60], default 25 */
  focusMinutes: number;
  /** Short break length in minutes: clamped to safe bounds [1, 30], default 5 */
  shortBreakMinutes: number;
  /** Long break length in minutes: clamped to safe bounds [5, 60], default 15 */
  longBreakMinutes: number;
  /** Completed focus cycles before triggering a long break: default 4 */
  cyclesBeforeLongBreak: number;
}

export interface PomodoroState {
  config: PomodoroConfig;
  currentPhase: PomodoroPhase;
  /** 1-based cycle counter for current cycle run (1 .. cyclesBeforeLongBreak) */
  currentCycle: number;
  /** Lifetime count of completed focus cycles in this session */
  completedCycles: number;
  /** Remaining seconds in the current phase */
  remainingSeconds: number;
  /** Total phase seconds for progress calculation */
  phaseDurationSeconds: number;
  status: PomodoroStatus;
}

export interface FocusSessionRecord {
  id: string;
  timestamp: number;
  durationSeconds: number;
  mode: "simple" | "pomodoro";
  phase?: PomodoroPhase;
  completed: boolean;
  activityLabel?: string;
}

export interface FocusStatsSummary {
  sessionsToday: number;
  focusMinutesToday: number;
  sessionsThisWeek: number;
  focusMinutesThisWeek: number;
  streakDays: number;
}

export const FOCUS_PRESET_SECONDS = {
  fiveMin: 300,
  tenMin: 600,
  fifteenMin: 900,
  twentyFiveMin: 1500,
} as const;

export const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
};

// ─── Task Breakdown ───────────────────────────────────────────────────────────

export interface TaskStep {
  id: string;
  label: string;
  isComplete: boolean;
  orderIndex: number;
  completedAt?: number;
}

export interface TaskItem {
  id: string;
  title: string;
  steps: TaskStep[];
  createdAt: number;
  isArchived?: boolean;
}

// ─── Habit Tracker ────────────────────────────────────────────────────────────

export interface HabitItem {
  id: string;
  title: string;
  icon?: string;
  createdAt: number;
  isArchived?: boolean;
}

/** Map of habitId -> dateKey ("YYYY-MM-DD") -> completed */
export type HabitLog = Record<string, Record<string, boolean>>;

export interface DayCheck {
  dateKey: string;
  dayLabel: string;
  dayNumber: number;
  isToday: boolean;
}

// ─── Rewards & Progress ───────────────────────────────────────────────────────

export interface RewardGoal {
  id: string;
  title: string;
  targetStars: number;
  icon?: string;
}

export interface RewardState {
  currentStars: number;
  lifetimeStars: number;
  goal: RewardGoal;
  /** Unique event keys (`${source}:${sourceId}:${dateKey}`) to enforce idempotency */
  awardedEventKeys: string[];
}

export const DEFAULT_REWARD_GOAL: RewardGoal = {
  id: "default-goal",
  title: "Fun Movie or Game Night",
  targetStars: 10,
  icon: "🎬",
};

export const INITIAL_REWARD_STATE: RewardState = {
  currentStars: 0,
  lifetimeStars: 0,
  goal: DEFAULT_REWARD_GOAL,
  awardedEventKeys: [],
};

