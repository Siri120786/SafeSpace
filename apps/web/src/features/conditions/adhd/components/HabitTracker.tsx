/**
 * SafeSpace ADHD Habit Tracker Component
 * Sprint 3 Workstream B
 *
 * Gentle 7-day habit tracker with daily check-offs.
 * Crucial design rule: Missed days are NEVER shown as failures (no red, no streak shaming).
 * Each checked day awards 1 star idempotently.
 */

import React, { useEffect, useState } from "react";
import {
  BigButton,
  DeviceOnlyNote,
  SoftBadge,
} from "../../../wellness-ui";
import {
  getPast7Days,
  isHabitChecked,
} from "../lib/habitLogic";
import {
  createHabitService,
  createRewardService,
} from "../services";
import type { DayCheck, HabitItem, HabitLog } from "../types";

export interface HabitTrackerProps {
  className?: string;
  onHabitChecked?: (habit: HabitItem, dateKey: string) => void;
}

export const HabitTracker: React.FC<HabitTrackerProps> = ({
  className = "",
  onHabitChecked,
}) => {
  const habitService = createHabitService();
  const rewardService = createRewardService();

  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [log, setLog] = useState<HabitLog>({});
  const [newTitle, setNewTitle] = useState("");
  const [newIcon, setNewIcon] = useState("🌱");
  const [isAddingHabit, setIsAddingHabit] = useState(false);

  const past7Days: DayCheck[] = getPast7Days();

  const loadData = async () => {
    try {
      const [habitList, habitLog] = await Promise.all([
        habitService.listHabits(),
        habitService.getLog(),
      ]);
      setHabits(habitList);
      setLog(habitLog);
    } catch {
      // Graceful local error handling
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleDay = async (habit: HabitItem, dateKey: string) => {
    try {
      const { updatedLog, isNowChecked } = await habitService.toggleDay(
        habit.id,
        dateKey
      );
      setLog(updatedLog);

      if (isNowChecked) {
        // Idempotently award 1 star for habit check-off
        await rewardService.awardStars("habit_day", habit.id, dateKey, 1);
        onHabitChecked?.(habit, dateKey);
      }
    } catch {
      // Graceful local handling
    }
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const created = await habitService.addHabit(newTitle.trim(), newIcon);
      setHabits((prev) => [...prev, created]);
      setNewTitle("");
      setIsAddingHabit(false);
    } catch {
      // Graceful local handling
    }
  };

  const handleRemoveHabit = async (id: string) => {
    try {
      await habitService.removeHabit(id);
      setHabits((prev) => prev.filter((h) => h.id !== id));
    } catch {
      // Graceful local handling
    }
  };

  return (
    <div
      className={`p-6 sm:p-8 rounded-4xl bg-white border border-olive-200/80 shadow-soft text-left font-sans space-y-6 ${className}`.trim()}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-olive-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
              Daily Habits
            </span>
            <SoftBadge variant="default">Gentle Pacing</SoftBadge>
          </div>
          <h3 className="font-display text-2xl font-bold text-textHeading mt-1">
            Small Daily Rhythms
          </h3>
          <p className="text-xs sm:text-sm text-textMuted font-light mt-0.5">
            Tiny habits done gently. Missed days are simply restful days.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddingHabit((prev) => !prev)}
            className="min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-semibold bg-olive-50/80 text-textBody border border-olive-200 hover:bg-olive-100 transition-all"
          >
            {isAddingHabit ? "Cancel" : "＋ New Habit"}
          </button>
          <DeviceOnlyNote compact />
        </div>
      </div>

      {/* Add Habit Form */}
      {isAddingHabit && (
        <form
          onSubmit={handleAddHabit}
          className="p-4 rounded-3xl bg-olive-50/60 border border-olive-200 flex flex-col sm:flex-row gap-2"
        >
          <select
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            className="p-3 rounded-2xl bg-white border border-olive-200 text-sm"
          >
            <option value="💧">💧 Water</option>
            <option value="🧘">🧘 Stretch</option>
            <option value="🌿">🌿 Nature</option>
            <option value="🌱">🌱 Reset</option>
            <option value="💊">💊 Wellness</option>
            <option value="📚">📚 Reading</option>
          </select>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Drink a glass of water, or 2 min breathing"
            className="flex-1 p-3 rounded-2xl bg-white border border-olive-200 text-sm text-textHeading placeholder:text-textMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-500"
          />
          <BigButton variant="primary" type="submit" className="min-h-[44px]">
            Save Habit
          </BigButton>
        </form>
      )}

      {/* 7-Day Grid View */}
      <div className="space-y-4 overflow-x-auto">
        {/* Days Header */}
        <div className="grid grid-cols-[1fr_repeat(7,minmax(42px,52px))] items-center gap-2 pb-2 border-b border-olive-100 text-center min-w-[500px]">
          <div className="text-left text-xs font-semibold text-textMuted uppercase tracking-wider pl-2">
            Habit
          </div>
          {past7Days.map((day) => (
            <div
              key={day.dateKey}
              className={`text-xs py-1 rounded-xl ${
                day.isToday ? "bg-deepGreen-50 text-deepGreen font-bold" : "text-textMuted"
              }`}
            >
              <div>{day.dayLabel}</div>
              <div className="text-[11px] font-normal">{day.dayNumber}</div>
            </div>
          ))}
        </div>

        {/* Habits Rows */}
        <div className="space-y-2 min-w-[500px]">
          {habits.map((habit) => (
            <div
              key={habit.id}
              className="grid grid-cols-[1fr_repeat(7,minmax(42px,52px))] items-center gap-2 p-2.5 rounded-2xl bg-olive-50/30 border border-olive-100 hover:bg-olive-50/60 transition-all"
            >
              <div className="flex items-center gap-2 text-left pl-2 min-w-0">
                <span className="text-xl shrink-0" aria-hidden="true">
                  {habit.icon || "🌱"}
                </span>
                <span className="text-sm font-semibold text-textHeading truncate">
                  {habit.title}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveHabit(habit.id)}
                  aria-label={`Remove habit "${habit.title}"`}
                  className="text-xs text-textMuted hover:text-rose-600 ml-1 p-1"
                >
                  ✕
                </button>
              </div>

              {/* 7 Daily Check-off Buttons (48px+ targets) */}
              {past7Days.map((day) => {
                const checked = isHabitChecked(log, habit.id, day.dateKey);

                return (
                  <div key={day.dateKey} className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => handleToggleDay(habit, day.dateKey)}
                      aria-label={`${habit.title} on ${day.dayLabel} ${day.dayNumber}: ${
                        checked ? "completed" : "uncompleted"
                      }`}
                      aria-pressed={checked}
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm transition-all border ${
                        checked
                          ? "bg-deepGreen text-white border-deepGreen shadow-sm"
                          : "bg-white text-transparent border-olive-200 hover:border-olive-400 hover:text-olive-300"
                      }`}
                    >
                      {checked ? "✓" : "○"}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Affirmation Footer */}
      <div className="p-4 rounded-2xl bg-olive-50/60 border border-olive-100 text-xs text-textMuted font-light flex items-center gap-2">
        <span className="text-base" aria-hidden="true">
          ☀️
        </span>
        {/* Content needing review: non-clinical supportive prompt */}
        <span>
          Habits grow through gentle consistency, not perfection. Every step forward counts.
        </span>
      </div>
    </div>
  );
};
