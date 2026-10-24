import React, { useEffect, useState } from "react";
import {
  BigButton,
  DeviceOnlyNote,
  SoftBadge,
  WellnessCard,
} from "../../../wellness-ui";
import { createEmotionCardsService } from "../services";
import type { EmotionCardItem, EmotionSelection } from "../types";
import { DEFAULT_EMOTION_CARDS } from "../emotionCardsData";
import { helpFailed, helpMessage, type HelpState } from "../../../child-space/talkBoard";

// The card list lives in ../emotionCardsData.ts (role-flow 8e), so the
// database-backed service can use it too; re-exported here as before.
export { DEFAULT_EMOTION_CARDS } from "../emotionCardsData";

export interface EmotionCardsProps {
  cards?: EmotionCardItem[];
  className?: string;
  onCardSelected?: (card: EmotionCardItem) => void;
  // "I want a grown-up" (role-flow 8e): for a child, raises the same caregiver
  // alert as the talk board's "I need help"; "hidden" for an Individual, who
  // has no caregiver. Without it, the button only shows a note on screen.
  grownUp?: { raise: () => Promise<unknown> } | "hidden";
  // Children can't clear their feelings choices (like mood check-ins).
  canClearHistory?: boolean;
}

export const EmotionCards: React.FC<EmotionCardsProps> = ({
  cards = DEFAULT_EMOTION_CARDS,
  className = "",
  onCardSelected,
  grownUp,
  canClearHistory = true,
}) => {
  const service = createEmotionCardsService();
  const [help, setHelp] = useState<HelpState>({ kind: "idle" });
  const askGrownUp = async () => {
    if (!grownUp || grownUp === "hidden") return;
    setHelp({ kind: "sending" });
    try {
      await grownUp.raise();
      setHelp({ kind: "sent" });
    } catch (e) {
      setHelp(helpFailed(e));
    }
  };
  const helpText = helpMessage(help);
  const [selectedCard, setSelectedCard] = useState<EmotionCardItem | null>(null);
  const [recentSelections, setRecentSelections] = useState<EmotionSelection[]>([]);
  const [showGrownUpMessage, setShowGrownUpMessage] = useState(false);

  useEffect(() => {
    service.getRecentSelections().then(setRecentSelections).catch(() => {});
  }, []);

  const handleCardClick = async (card: EmotionCardItem) => {
    setSelectedCard(card);
    onCardSelected?.(card);
    try {
      const recorded = await service.recordSelection(card);
      setRecentSelections((prev) => [
        recorded,
        ...prev.filter((p) => p.cardId !== card.id),
      ]);
    } catch {
      // Graceful local handling
    }
  };

  const handleClearHistory = async () => {
    await service.clearRecentSelections();
    setRecentSelections([]);
  };

  return (
    <div className={`space-y-6 text-left ${className}`.trim()}>
      {/* Top Context & Privacy Note */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-bold text-textHeading">
            How are you feeling right now?
          </h3>
          <p className="text-xs sm:text-sm text-textMuted font-light mt-1">
            Pick any card that matches your feelings. All feelings are welcome.
          </p>
        </div>
        <DeviceOnlyNote compact />
      </div>

      {/* Confirmation Banner */}
      {selectedCard && (
        <div
          role="status"
          aria-live="polite"
          className="p-5 rounded-3xl bg-gradient-to-r from-olive-50 via-white to-paleLime/40 border border-olive-200/80 shadow-soft flex items-center justify-between gap-4 animate-fade-in"
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl sm:text-4xl" aria-hidden="true">
              {selectedCard.emoji}
            </span>
            <div className="space-y-0.5">
              <span className="text-xs uppercase tracking-wider font-semibold text-deepGreen">
                You chose: {selectedCard.label}
              </span>
              <p className="text-sm font-medium text-textHeading">
                {selectedCard.reassurance}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedCard(null)}
            className="text-textMuted hover:text-textHeading text-sm font-semibold p-2 rounded-xl hover:bg-black/5"
            aria-label="Dismiss feeling notice"
          >
            ✕
          </button>
        </div>
      )}

      {/* Emotion Cards Grid */}
      <div
        role="group"
        aria-label="Emotion card choices"
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5"
      >
        {cards.map((card) => {
          const isSelected = selectedCard?.id === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleCardClick(card)}
              aria-pressed={isSelected}
              className={`min-h-[110px] p-4 rounded-3xl border text-center transition-all flex flex-col items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 focus-visible:ring-offset-2 ${
                isSelected
                  ? "bg-olive-50 border-olive-400 shadow-card ring-1 ring-olive-400 scale-[1.02]"
                  : "bg-white hover:bg-ivory-50 border-olive-100/90 shadow-soft hover:border-olive-300"
              }`}
            >
              <span className="text-3xl" aria-hidden="true">
                {card.emoji}
              </span>
              <span className="font-display text-sm font-medium text-textHeading leading-tight">
                {card.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grown-Up Message Button (Visual support only — no alerts or emergency calls) */}
      <div className="pt-2 border-t border-olive-100/80 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {grownUp !== "hidden" && (
            <BigButton
              variant="gentle"
              icon={<span>🤝</span>}
              onClick={grownUp ? askGrownUp : () => setShowGrownUpMessage((prev) => !prev)}
              disabled={help.kind === "sending"}
              ariaLabel={grownUp ? "Tell my grown-up I want them" : "Show helpful note about asking a grown-up"}
            >
              I want a grown-up
            </BigButton>
          )}

          {recentSelections.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-textMuted">
              <span>Recent choices:</span>
              <div className="flex gap-1.5 flex-wrap">
                {recentSelections.slice(0, 4).map((rec) => (
                  <SoftBadge key={`${rec.cardId}-${rec.selectedAt}`} size="sm" variant="neutral">
                    {rec.emoji} {rec.label}
                  </SoftBadge>
                ))}
              </div>
              {canClearHistory && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="underline hover:text-textHeading ml-1 text-[11px]"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* After "I want a grown-up" raised an alert: what happened, never silent */}
        {helpText && (
          <div
            role={help.kind === "failed" ? "alert" : "status"}
            aria-live="polite"
            className={`p-4 rounded-2xl text-sm font-semibold ${help.kind === "failed" ? "bg-red-50 text-red-800 border border-red-300" : "bg-olive-50 text-deepGreen border border-olive-200"}`}
          >
            {helpText}
          </div>
        )}

        {/* Purely on-screen gentle reassurance message */}
        {showGrownUpMessage && (
          <div
            role="status"
            aria-live="polite"
            className="p-4 rounded-2xl bg-cream/70 border border-amber-200/60 text-xs sm:text-sm text-charcoal/90 space-y-1"
          >
            <p className="font-semibold text-textHeading">
              It is always okay to ask for company or help.
            </p>
            {/* Content needing review: non-clinical supportive prompt */}
            <p className="font-light text-textBody">
              You can show this screen to a parent, caregiver, or teacher and tell them
              how you feel. Take a gentle breath — you are never in trouble for sharing your feelings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
