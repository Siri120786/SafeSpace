// apps/web/src/features/mood/pages/MoodCheckInPage.tsx
// Full feature page providing mood check-in reflection and history browsing.

import React, { useState } from "react";
import { useAuth } from "../../auth";
import { useMoodCheckIn } from "../hooks/useMoodCheckIn";
import { MoodCheckInForm } from "../components/MoodCheckInForm";
import { MoodHistoryList } from "../components/MoodHistoryList";
import { Card } from "../../../components/ui/Card";
import { Chip } from "../../../components/ui/Chip";
import { Button } from "../../../components/ui/Button";
import { SafetyNoticeCard } from "../../safety/SafetyNoticeCard";

interface MoodCheckInPageProps {
  onBack?: () => void;
}

export const MoodCheckInPage: React.FC<MoodCheckInPageProps> = ({ onBack }) => {
  const { session, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"checkin" | "history">("checkin");

  const {
    selectedMood,
    setSelectedMood,
    intensity,
    setIntensity,
    note,
    setNote,
    status,
    history,
    historyStatus,
    errorMessage,
    historyErrorMessage,
    saveCheckIn,
    refreshHistory,
    resetForm,
    safety,
    clearSafety,
  } = useMoodCheckIn(session);

  if (authLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-6 text-center">
        <div className="w-8 h-8 border-3 border-olive-500/20 border-t-olive-600 rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-textMuted ml-3">Loading SafeSpace…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-xl mx-auto p-4 sm:p-6 text-center">
        <Card className="flex flex-col items-center justify-center p-8 gap-4">
          <span className="text-4xl" role="img" aria-label="door">
            🌿
          </span>
          <h2 className="text-xl font-bold text-textHeading">Welcome to Mood Check-in</h2>
          <p className="text-sm text-textMuted max-w-sm">
            Please sign in to save your reflections and view your personal check-in history.
          </p>
          {onBack && (
            <Button size="md" variant="primary" onClick={onBack}>
              Return
            </Button>
          )}
        </Card>
      </div>
    );
  }

  return (
    <main className="w-full max-w-4xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6 font-sans">
      {/* Header Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back"
              className="p-2 rounded-full hover:bg-olive-50 border border-olive-200/60 text-textHeading transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-olive-500 outline-none"
            >
              <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-textHeading tracking-tight">
              Mood Check-in
            </h1>
            <p className="text-xs sm:text-sm text-textMuted mt-0.5">
              A gentle space to reflect on how you're feeling right now.
            </p>
          </div>
        </div>

        {/* View Switcher Chips (mobile & tablet) */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Chip
            label="Check In"
            active={activeTab === "checkin"}
            onClick={() => setActiveTab("checkin")}
            variant="olive"
            size="md"
          />
          <Chip
            label={`History (${history.length})`}
            active={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            variant="olive"
            size="md"
          />
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form View / Primary Panel */}
        <div
          className={`${
            activeTab === "checkin" ? "block" : "hidden lg:block"
          } lg:col-span-7`}
        >
          {safety && (
            <div className="mb-4">
              <SafetyNoticeCard safety={safety} onClose={clearSafety} />
            </div>
          )}
          <Card className="w-full">
            <MoodCheckInForm
              selectedMood={selectedMood}
              onSelectMood={setSelectedMood}
              intensity={intensity}
              onChangeIntensity={setIntensity}
              note={note}
              onChangeNote={setNote}
              status={status}
              errorMessage={errorMessage}
              onSave={saveCheckIn}
              onReset={resetForm}
            />
          </Card>
        </div>

        {/* History View / Secondary Panel */}
        <div
          className={`${
            activeTab === "history" ? "block" : "hidden lg:block"
          } lg:col-span-5`}
        >
          <Card className="w-full bg-[#FCFBF8]">
            <MoodHistoryList
              history={history}
              status={historyStatus}
              errorMessage={historyErrorMessage}
              onRetry={refreshHistory}
            />
          </Card>
        </div>
      </div>
    </main>
  );
};
