import React, { useEffect, useState } from "react";
import {
  BigButton,
  DeviceOnlyNote,
  SoftBadge,
  WellnessCard,
} from "../../../wellness-ui";
import { createEmotionCardsService } from "../services";
import type { EmotionCardItem, EmotionSelection } from "../types";

// Content needing review: non-clinical supportive prompt
export const DEFAULT_EMOTION_CARDS: EmotionCardItem[] = [
  {
    id: "happy",
    label: "Happy",
    emoji: "😊",
    sharedMoodValue: "happy",
    // Content needing review: non-clinical supportive prompt
    reassurance: "It feels wonderful to have a smiling heart today.",
  },
  {
    id: "calm",
    label: "Calm",
    emoji: "🌿",
    // Content needing review: non-clinical supportive prompt
    reassurance: "Your body is peaceful and resting like a gentle leaf.",
  },
  {
    id: "ecstatic",
    label: "Very Joyful",
    emoji: "✨",
    sharedMoodValue: "ecstatic",
    // Content needing review: non-clinical supportive prompt
    reassurance: "So much sparkle and energy inside you today!",
  },
  {
    id: "neutral",
    label: "In-Between",
    emoji: "☁️",
    sharedMoodValue: "neutral",
    // Content needing review: non-clinical supportive prompt
    reassurance: "It is completely okay to simply feel okay or in-between.",
  },
  {
    id: "sad",
    label: "Sad",
    emoji: "🌧️",
    sharedMoodValue: "sad",
    // Content needing review: non-clinical supportive prompt
    reassurance: "It's okay to feel sad. You don't have to rush your feelings.",
  },
  {
    id: "tired",
    label: "Tired",
    emoji: "🌙",
    // Content needing review: non-clinical supportive prompt
    reassurance: "Rest is gentle and productive. Take all the quiet time you need.",
  },
  {
    id: "stressed",
    label: "A Bit Full",
    emoji: "🫧",
    sharedMoodValue: "stressed",
    // Content needing review: non-clinical supportive prompt
    reassurance: "Things feel full right now. One slow, easy breath at a time.",
  },
  {
    id: "overwhelmed",
    label: "Too Much Noise",
    emoji: "🎧",
    sharedMoodValue: "overwhelmed",
    // Content needing review: non-clinical supportive prompt
    reassurance: "When things feel too big, it is okay to pause and soften the room.",
  },
  {
    id: "proud",
    label: "Proud",
    emoji: "⭐",
    // Content needing review: non-clinical supportive prompt
    reassurance: "You tried your best or did something kind, and that matters.",
  },
  {
    id: "curious",
    label: "Curious",
    emoji: "🔍",
    // Content needing review: non-clinical supportive prompt
    reassurance: "Your wondering mind is ready to explore gently.",
  },
];

export interface EmotionCardsProps {
  cards?: EmotionCardItem[];
  className?: string;
  onCardSelected?: (card: EmotionCardItem) => void;
}

export const EmotionCards: React.FC<EmotionCardsProps> = ({
  cards = DEFAULT_EMOTION_CARDS,
  className = "",
  onCardSelected,
}) => {
  const service = createEmotionCardsService();
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
          <BigButton
            variant="gentle"
            icon={<span>🤝</span>}
            onClick={() => setShowGrownUpMessage((prev) => !prev)}
            ariaLabel="Show helpful note about asking a grown-up"
          >
            I want a grown-up
          </BigButton>

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
              <button
                type="button"
                onClick={handleClearHistory}
                className="underline hover:text-textHeading ml-1 text-[11px]"
              >
                Clear
              </button>
            </div>
          )}
        </div>

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
