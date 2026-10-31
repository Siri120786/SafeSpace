import React, { useState, useEffect } from "react";
import { BrainMascot } from "../vectors/BrainMascot";
import { Chip } from "./Chip";
import { Slider } from "./Slider";
import { LeafCluster } from "../vectors/LeafFrame";

interface SessionPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  durationMinutes?: number;
  category?: string;
}

export const SessionPlayerModal: React.FC<SessionPlayerProps> = ({
  isOpen,
  onClose,
  title = "Deep Calm",
  durationMinutes = 5,
  category = "Breathing",
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(durationMinutes * 60);
  const [volume, setVolume] = useState(80);
  const [bgSound, setBgSound] = useState<"Rain" | "Waves" | "Forest">("Rain");

  useEffect(() => {
    setSecondsRemaining(durationMinutes * 60);
  }, [durationMinutes]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, secondsRemaining]);

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercentage =
    ((durationMinutes * 60 - secondsRemaining) / (durationMinutes * 60)) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md font-sans select-none animate-fade-in">
      <div className="relative w-full max-w-md bg-white/90 backdrop-blur-xl rounded-4xl p-6 sm:p-8 shadow-2xl border border-white overflow-hidden text-center text-textHeading">
        {/* Botanical Framing */}
        <LeafCluster position="bottom-left" size={160} className="absolute bottom-0 left-0 opacity-60" />
        <LeafCluster position="bottom-right" size={160} className="absolute bottom-0 right-0 opacity-60" />

        {/* Header Bar */}
        <div className="relative z-10 flex items-center justify-between mb-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-xs sm:text-sm font-medium text-textBody hover:text-deepGreen transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back</span>
          </button>

          <span className="text-xs uppercase tracking-wider font-semibold text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
            Now Playing
          </span>

          <button
            onClick={onClose}
            className="text-textMuted hover:text-textHeading text-xl font-bold p-1"
          >
            &times;
          </button>
        </div>

        {/* Meditating Brain on a Leafy Hill */}
        <div className="relative z-10 my-4 py-4 flex flex-col items-center justify-center">
          <div className="relative p-6 rounded-full bg-white/70 border border-white shadow-card">
            <BrainMascot stance="meditating" size={160} />
          </div>
        </div>

        {/* Title & Category Chips */}
        <div className="relative z-10 space-y-2">
          <h3 className="font-display text-2xl font-medium text-textHeading">{title}</h3>
          <div className="flex items-center justify-center gap-2">
            <Chip label={`${durationMinutes} min`} variant="olive" size="sm" />
            <Chip label={category} variant="green" size="sm" />
          </div>
        </div>

        {/* Digital Timer */}
        <div className="relative z-10 my-4 font-display text-4xl font-medium text-textHeading tracking-widest">
          {formatTime(secondsRemaining)}
        </div>

        {/* Custom Olive Progress Slider */}
        <div className="relative z-10 px-2 my-4">
          <Slider
            value={progressPercentage}
            onChange={(val) => {
              const newSecs = Math.floor((1 - val / 100) * (durationMinutes * 60));
              setSecondsRemaining(newSecs);
            }}
          />
        </div>

        {/* Playback Controls */}
        <div className="relative z-10 flex items-center justify-center gap-6 my-4">
          <button
            onClick={() => setSecondsRemaining((prev) => Math.min(durationMinutes * 60, prev + 15))}
            className="w-10 h-10 rounded-full bg-white text-textHeading flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all text-xs font-semibold"
          >
            -15s
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-14 h-14 rounded-full bg-darkBtn text-white flex items-center justify-center shadow-pill hover:scale-105 active:scale-95 transition-all text-lg"
          >
            {isPlaying ? "⏸" : "▶"}
          </button>

          <button
            onClick={() => setSecondsRemaining((prev) => Math.max(0, prev - 15))}
            className="w-10 h-10 rounded-full bg-white text-textHeading flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all text-xs font-semibold"
          >
            +15s
          </button>
        </div>

        {/* Volume & Ambient Sound Selector */}
        <div className="relative z-10 flex items-center justify-center gap-2 pt-2 border-t border-olive-100">
          <Chip
            label={`Volume ${volume}%`}
            variant="neutral"
            size="sm"
            onClick={() => setVolume((prev) => (prev >= 100 ? 20 : prev + 20))}
          />
          <Chip
            label={`Sound: ${bgSound}`}
            variant="olive"
            size="sm"
            onClick={() =>
              setBgSound((prev) => (prev === "Rain" ? "Waves" : prev === "Waves" ? "Forest" : "Rain"))
            }
          />
        </div>

        <p className="relative z-10 text-xs font-medium text-deepGreen mt-4">
          "You're safe. Just breathe."
        </p>
      </div>
    </div>
  );
};
