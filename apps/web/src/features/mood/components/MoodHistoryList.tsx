// apps/web/src/features/mood/components/MoodHistoryList.tsx
// History list component displaying past mood check-in entries with loading, error, and empty states.

import React from "react";
import type { MoodCheckin } from "@safespace/shared-types";
import {
  MoodAvatar,
  MOOD_LIST,
  type MoodType,
} from "../../../components/vectors/MoodAvatars";
import { formatCheckInTime } from "../utils/moodLogic";
import type { MoodHistoryStatus } from "../hooks/useMoodCheckIn";
import { Button } from "../../../components/ui/Button";

interface MoodHistoryListProps {
  history: MoodCheckin[];
  status: MoodHistoryStatus;
  errorMessage: string | null;
  onRetry: () => void;
  title?: string; // default "My History"; caregiver views pass their own
}

export const MoodHistoryList: React.FC<MoodHistoryListProps> = ({
  history,
  status,
  errorMessage,
  onRetry,
  title = "My History",
}) => {
  if (status === "loading" && history.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 gap-3 text-center">
        <div className="w-8 h-8 border-3 border-olive-500/20 border-t-olive-600 rounded-full animate-spin" />
        <p className="text-sm font-medium text-textMuted">Loading your history…</p>
      </div>
    );
  }

  if (status === "error" && history.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-6 bg-red-50/40 border border-red-200/60 rounded-2xl text-center gap-3">
        <p className="text-sm text-red-700">
          {errorMessage || "Unable to load check-in history."}
        </p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try Again
        </Button>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 bg-ivory-100/60 border border-olive-100 rounded-2xl text-center gap-2">
        <span className="text-3xl" role="img" aria-label="sparkles">
          🌱
        </span>
        <h4 className="text-base font-semibold text-textHeading">No check-ins yet</h4>
        <p className="text-xs sm:text-sm text-textMuted max-w-xs">
          Whenever you're ready to check in, your previous reflections will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-base font-semibold text-textHeading">{title}</h3>
        <span className="text-xs text-textMuted">
          {history.length} {history.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div className="flex flex-col gap-3 max-h-[480px] overflow-y-auto pr-1">
        {history.map((entry) => {
          const moodOption = MOOD_LIST.find((m) => m.id === entry.mood);
          const moodLabel = moodOption ? moodOption.label : entry.mood;

          return (
            <article
              key={entry.id}
              className="flex flex-col p-4 bg-white/90 rounded-2xl border border-olive-100/80 shadow-sm transition-all hover:border-olive-200"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="shrink-0 pointer-events-none">
                    <MoodAvatar
                      type={entry.mood as MoodType}
                      size={36}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-textHeading">
                      {moodLabel}
                    </span>
                    <time
                      dateTime={entry.createdAt}
                      className="text-[11px] text-textMuted"
                    >
                      {formatCheckInTime(entry.createdAt)}
                    </time>
                  </div>
                </div>

                {entry.intensity !== null && entry.intensity !== undefined && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-olive-50 text-olive-700 border border-olive-200/50">
                    Intensity: {entry.intensity}/5
                  </span>
                )}
              </div>

              {entry.note && (
                <div className="mt-3 pt-2.5 border-t border-olive-100/50">
                  <p className="text-xs sm:text-sm text-textBody whitespace-pre-wrap break-words leading-relaxed">
                    {entry.note}
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};
