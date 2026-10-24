import React, { useEffect, useState } from "react";
import {
  BigButton,
  DeviceOnlyNote,
  SoftBadge,
} from "../../../wellness-ui";
import {
  createAacService,
  DEFAULT_AAC_TILES,
} from "../services";
import type { AacTile } from "../types";

export interface AacBoardProps {
  className?: string;
  tiles?: AacTile[];
}

const CATEGORY_COLORS = {
  needs: "bg-amber-50/80 border-amber-200 text-amber-900",
  social: "bg-olive-50/80 border-olive-200 text-deepGreen-800",
  feelings: "bg-rose-50/80 border-rose-200 text-rose-900",
  actions: "bg-blue-50/80 border-blue-200 text-blue-900",
};

export const AacBoard: React.FC<AacBoardProps> = ({
  className = "",
  tiles = DEFAULT_AAC_TILES,
}) => {
  const service = createAacService();

  const [sentenceStrip, setSentenceStrip] = useState<AacTile[]>([]);
  const [activeTile, setActiveTile] = useState<AacTile | null>(null);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);

  useEffect(() => {
    service
      .getConfig()
      .then((cfg) => setCustomLabels(cfg.customLabels))
      .catch(() => {});
  }, []);

  const getTileLabel = (tile: AacTile): string => {
    return customLabels[tile.id] || tile.label;
  };

  const handleTileTap = (tile: AacTile) => {
    const customized = { ...tile, label: getTileLabel(tile) };
    setActiveTile(customized);
    setSentenceStrip((prev) => [...prev, customized]);
  };

  const handleClear = () => {
    setSentenceStrip([]);
    setActiveTile(null);
  };

  const handleBackspace = () => {
    setSentenceStrip((prev) => prev.slice(0, -1));
  };

  // Speak button handler — only ever speaks upon explicit user tap (NEVER autoplays)
  const handleSpeak = () => {
    if (sentenceStrip.length === 0) return;
    const textToSpeak = sentenceStrip.map((t) => t.label).join(" ");

    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !window.speechSynthesis
    ) {
      setSpeechNotice("Text-to-speech is not supported on this device/browser.");
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 0.9; // Gently paced speech
      utterance.onend = () => setSpeechNotice(null);
      window.speechSynthesis.speak(utterance);
    } catch {
      setSpeechNotice("Could not play speech on this browser.");
    }
  };

  return (
    <div className={`space-y-6 text-left font-sans ${className}`.trim()}>
      {/* Header and Device Note */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-olive-100 pb-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
            AAC Communication Board
          </span>
          <h3 className="font-display text-2xl font-bold text-textHeading mt-1">
            Tap to Express Thoughts & Needs
          </h3>
          <p className="text-xs sm:text-sm text-textMuted font-light mt-0.5">
            Select words to build your message. Tap Speak to read it aloud.
          </p>
        </div>
        <DeviceOnlyNote compact />
      </div>

      {/* Sentence Strip Container */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-olive-200/80 shadow-soft space-y-3">
        <div className="flex items-center justify-between text-xs text-textMuted border-b border-olive-100/60 pb-2">
          <span>Sentence Strip</span>
          <span>{sentenceStrip.length} words chosen</span>
        </div>

        {/* Word Chips Row */}
        <div
          role="region"
          aria-label="Current sentence"
          className="min-h-[58px] p-2.5 rounded-2xl bg-ivory-100/80 border border-olive-100 flex items-center gap-2 flex-wrap overflow-x-auto"
        >
          {sentenceStrip.length === 0 ? (
            <p className="text-xs sm:text-sm text-textMuted font-light italic px-2">
              Tap any tile below to start building your sentence...
            </p>
          ) : (
            sentenceStrip.map((item, index) => (
              <span
                key={`${item.id}-${index}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-olive-200 shadow-xs text-sm font-medium text-textHeading"
              >
                <span>{item.emoji}</span>
                <span>{item.label}</span>
              </span>
            ))
          )}
        </div>

        {/* Action Controls (Speak, Backspace, Clear) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <BigButton
              variant="primary"
              icon={<span>🔊</span>}
              onClick={handleSpeak}
              disabled={sentenceStrip.length === 0}
              ariaLabel="Read sentence strip aloud"
            >
              Speak
            </BigButton>

            <BigButton
              variant="gentle"
              onClick={handleBackspace}
              disabled={sentenceStrip.length === 0}
              ariaLabel="Remove last word"
            >
              ← Backspace
            </BigButton>
          </div>

          <button
            type="button"
            onClick={handleClear}
            disabled={sentenceStrip.length === 0}
            className="text-xs font-semibold text-textMuted hover:text-red-600 disabled:opacity-40 px-3 py-2"
          >
            Clear Sentence
          </button>
        </div>

        {speechNotice && (
          <p className="text-xs text-amber-800 font-medium pt-1">
            {speechNotice}
          </p>
        )}
      </div>

      {/* Large Featured Phrase Banner (Visual confirmation) */}
      {activeTile && (
        <div
          role="status"
          aria-live="polite"
          className="p-5 rounded-3xl bg-olive-50 border border-olive-200/80 flex items-center gap-4 animate-fade-in"
        >
          <span className="text-4xl" aria-hidden="true">
            {activeTile.emoji}
          </span>
          <div className="space-y-0.5">
            <span className="text-xs uppercase tracking-wider font-semibold text-deepGreen">
              Current phrase
            </span>
            <p className="font-display text-2xl font-bold text-textHeading">
              {activeTile.label}
            </p>
          </div>
        </div>
      )}

      {/* Grid of AAC Tiles (48px+ targets) */}
      <div
        role="group"
        aria-label="AAC communication tiles"
        className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3.5"
      >
        {tiles.map((tile) => {
          const displayLabel = getTileLabel(tile);
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => handleTileTap(tile)}
              className={`min-h-[96px] p-4 rounded-3xl border text-center transition-all flex flex-col items-center justify-center gap-2 shadow-soft hover:shadow-card active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 focus-visible:ring-offset-2 ${
                CATEGORY_COLORS[tile.category]
              }`}
            >
              <span className="text-3xl" aria-hidden="true">
                {tile.emoji}
              </span>
              <span className="font-display text-sm font-semibold tracking-wide">
                {displayLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
