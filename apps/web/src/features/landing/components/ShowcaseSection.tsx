import React from "react";
import { BrainMascot } from "../../../components/vectors/BrainMascot";
import { MoodAvatar } from "../../../components/vectors/MoodAvatars";
import { Chip } from "../../../components/ui/Chip";
import { Slider } from "../../../components/ui/Slider";
import "../hero/meadowSections.css";

// "A peek inside": two phone previews of the app, in frosted frames.
export const ShowcaseSection: React.FC = () => (
  <section className="ms-section" aria-labelledby="ms-showcase">
    <div className="ms-head">
      <p className="ms-kicker ms-display">A PEEK INSIDE</p>
      <h2 id="ms-showcase" className="ms-title ms-display">
        <span>WITH YOU ON YOUR PHONE</span>
        <span>AND YOUR LAPTOP</span>
      </h2>
      <p className="ms-lead">Your calm corner goes wherever you do, and picks up right where you left it.</p>
    </div>

    <div className="ms-phones">
      {/* Today */}
      <div className="ms-phone">
        <div className="ms-phone-screen bg-[#FAF7F2] p-5 text-left space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="ms-display text-lg text-[#3f6b40]">Hi, Emma 👋</h4>
              <p className="text-xs text-textMuted">How are you feeling today?</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#5b875c] text-white flex items-center justify-center font-semibold text-xs">E</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-olive-100 shadow-sm text-xs text-textMuted">
            Write what's on your mind...
          </div>
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
          <div className="bg-white p-4 rounded-2xl border border-olive-100 shadow-card flex items-center gap-3">
            <BrainMascot stance="meditating" size={60} />
            <div>
              <span className="text-[10px] uppercase font-bold text-[#3f6b40]">A small reminder</span>
              <p className="text-xs text-textHeading font-medium">Rest is productive too.</p>
              <p className="text-[11px] text-textMuted">5 min guided pause</p>
            </div>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-olive-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-deepGreen-50 text-deepGreen flex items-center justify-center text-xs">▶</div>
              <div>
                <p className="text-xs font-medium text-textHeading">Breathe &amp; reset</p>
                <p className="text-[10px] text-textMuted">5 min • Breathing</p>
              </div>
            </div>
            <Chip label="Start" variant="olive" size="sm" />
          </div>
        </div>
      </div>

      {/* Now playing */}
      <div className="ms-phone">
        <div className="ms-phone-screen bg-gradient-to-b from-[#dcecf8] to-[#e8f3d8] p-5 text-center flex flex-col items-center space-y-4">
          <div className="w-full flex items-center justify-between text-xs text-textMuted">
            <span>← Back</span>
            <span className="font-medium text-textHeading">Now playing</span>
            <span className="opacity-0">←</span>
          </div>
          <div className="py-2">
            <BrainMascot stance="meditating" size={140} />
          </div>
          <div>
            <h4 className="ms-display text-xl text-[#3f6b40]">Deep Calm</h4>
            <div className="flex items-center justify-center gap-2 mt-1.5">
              <Chip label="5 min" variant="olive" size="sm" />
              <Chip label="Breathing" variant="green" size="sm" />
            </div>
          </div>
          <div className="ms-display text-3xl text-textHeading tracking-wider">05:22</div>
          <div className="w-full px-2" aria-hidden="true">
            <Slider value={45} onChange={() => {}} />
          </div>
          <div className="flex items-center justify-center gap-4 pt-1" aria-hidden="true">
            <span className="w-10 h-10 rounded-full bg-white text-textHeading flex items-center justify-center text-xs shadow-sm">⏮</span>
            <span className="w-12 h-12 rounded-full bg-[#5b875c] text-white flex items-center justify-center text-base shadow-pill">⏸</span>
            <span className="w-10 h-10 rounded-full bg-white text-textHeading flex items-center justify-center text-xs shadow-sm">⏭</span>
          </div>
          <p className="text-xs text-[#3f6b40] font-medium pt-1">You're safe. Just breathe.</p>
        </div>
      </div>
    </div>
  </section>
);
