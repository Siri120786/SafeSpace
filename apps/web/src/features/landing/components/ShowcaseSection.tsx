import React from "react";
import { BrainMascot } from "../../../components/vectors/BrainMascot";
import { MoodAvatar } from "../../../components/vectors/MoodAvatars";
import { Chip } from "../../../components/ui/Chip";
import { Slider } from "../../../components/ui/Slider";

export const ShowcaseSection: React.FC = () => {
  return (
    <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3.5 py-1.5 rounded-full">
          Product Preview
        </span>
        <h2 className="font-display text-3xl sm:text-4xl font-medium text-textHeading mt-3">
          A seamless experience across web & mobile
        </h2>
        <p className="text-base sm:text-lg text-textBody font-light mt-3">
          Take your safe space wherever you go — thoughtfully designed for your phone and desktop.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center justify-items-center">
        {/* Frame 1: Mobile Dashboard View */}
        <div className="w-[340px] sm:w-[375px] bg-[#0D0D0D] p-4 rounded-[48px] shadow-2xl border-4 border-black relative transform lg:-rotate-2 hover:rotate-0 transition-transform duration-500">
          {/* Dynamic Island / Notch */}
          <div className="w-28 h-5 bg-black rounded-full mx-auto mb-3" />

          {/* Screen Content Container */}
          <div className="bg-[#FAF7F2] rounded-[36px] p-5 text-left text-textHeading font-sans overflow-hidden space-y-4 border border-olive-100">
            {/* Header Greeting */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display text-lg font-medium text-textHeading">Hi, Emma 👋</h4>
                <p className="text-xs text-textMuted">How are you feeling today?</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-olive-500 text-white flex items-center justify-center font-semibold text-xs">
                E
              </div>
            </div>

            {/* Mind Input Box */}
            <div className="bg-white p-3.5 rounded-2xl border border-olive-100 shadow-sm text-xs text-textMuted">
              Write what's on your mind...
            </div>

            {/* Mood Avatars Row */}
            <div>
              <p className="text-xs font-medium text-textHeading mb-2">Your mood today</p>
              <div className="flex items-center justify-between">
                <MoodAvatar type="ecstatic" size={36} />
                <MoodAvatar type="happy" size={36} selected={true} />
                <MoodAvatar type="neutral" size={36} />
                <MoodAvatar type="sad" size={36} />
                <MoodAvatar type="stressed" size={36} />
                <MoodAvatar type="overwhelmed" size={36} />
              </div>
            </div>

            {/* Insight Card */}
            <div className="bg-white p-4 rounded-2xl border border-olive-100 shadow-card flex items-center gap-3">
              <BrainMascot stance="meditating" size={60} />
              <div>
                <span className="text-[10px] uppercase font-bold text-deepGreen">A small insight</span>
                <p className="text-xs text-textHeading font-medium">Rest is productive too.</p>
                <p className="text-[11px] text-textMuted">5 min guided pause</p>
              </div>
            </div>

            {/* Recommended Session Item */}
            <div className="bg-white p-3 rounded-2xl border border-olive-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-deepGreen-50 text-deepGreen flex items-center justify-center text-xs">
                  ▶
                </div>
                <div>
                  <p className="text-xs font-medium text-textHeading">Breathe & reset</p>
                  <p className="text-[10px] text-textMuted">5 min • Breathing</p>
                </div>
              </div>
              <Chip label="Start" variant="olive" size="sm" />
            </div>
          </div>
        </div>

        {/* Frame 2: Session Player Screen */}
        <div className="w-[340px] sm:w-[375px] bg-[#0D0D0D] p-4 rounded-[48px] shadow-2xl border-4 border-black relative transform lg:rotate-2 hover:rotate-0 transition-transform duration-500">
          {/* Notch */}
          <div className="w-28 h-5 bg-black rounded-full mx-auto mb-3" />

          {/* Player Screen Content */}
          <div className="bg-gradient-to-b from-cream to-paleLime rounded-[36px] p-5 text-center text-textHeading font-sans overflow-hidden space-y-4 border border-olive-100 flex flex-col items-center">
            {/* Header */}
            <div className="w-full flex items-center justify-between text-xs text-textMuted">
              <span className="cursor-pointer">← Back</span>
              <span className="font-medium text-textHeading">Now playing</span>
              <span className="opacity-0">←</span>
            </div>

            {/* Meditating Mascot on Leafy Hill */}
            <div className="py-2">
              <BrainMascot stance="meditating" size={140} />
            </div>

            {/* Title & Chips */}
            <div>
              <h4 className="font-display text-xl font-medium text-textHeading">Deep Calm</h4>
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <Chip label="5 min" variant="olive" size="sm" />
                <Chip label="Breathing" variant="green" size="sm" />
              </div>
            </div>

            {/* Timer */}
            <div className="font-display text-3xl font-medium text-textHeading tracking-wider">
              05:22
            </div>

            {/* Olive Slider */}
            <div className="w-full px-2">
              <Slider value={45} onChange={() => {}} />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 pt-1">
              <button className="w-10 h-10 rounded-full bg-white text-textHeading flex items-center justify-center text-xs shadow-sm">
                ⏮
              </button>
              <button className="w-12 h-12 rounded-full bg-darkBtn text-white flex items-center justify-center text-base shadow-pill">
                ⏸
              </button>
              <button className="w-10 h-10 rounded-full bg-white text-textHeading flex items-center justify-center text-xs shadow-sm">
                ⏭
              </button>
            </div>

            <p className="text-xs text-deepGreen font-medium pt-1">You're safe. Just breathe.</p>
          </div>
        </div>
      </div>
    </section>
  );
};
