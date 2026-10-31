import React from "react";
import { BrainMascot } from "../../../components/vectors/BrainMascot";
import { MoodAvatar } from "../../../components/vectors/MoodAvatars";
import { Chip } from "../../../components/ui/Chip";
import { Slider } from "../../../components/ui/Slider";
import { useTranslation } from "react-i18next";
import "../hero/meadowSections.css";

// "A peek inside": two phone previews of the app, in frosted frames.
export const ShowcaseSection: React.FC = () => {
  const { t } = useTranslation();
  return (
  <section className="ms-section" aria-labelledby="ms-showcase">
    <div className="ms-head">
      <p className="ms-kicker ms-display">{t("landing.showcase.kicker")}</p>
      <h2 id="ms-showcase" className="ms-title ms-display">
        <span>{t("landing.showcase.line1")}</span>
        <span>{t("landing.showcase.line2")}</span>
      </h2>
      <p className="ms-lead">{t("landing.showcase.lead")}</p>
    </div>

    <div className="ms-phones">
      {/* Today */}
      <div className="ms-phone">
        <div className="ms-phone-screen bg-[#FAF7F2] p-5 text-left space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="ms-display text-lg text-[#3f6b40]">{t("landing.showcase.hi", { name: "Emma" })} 👋</h4>
              <p className="text-xs text-textMuted">{t("landing.showcase.howFeeling")}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#5b875c] text-white flex items-center justify-center font-semibold text-xs">E</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-olive-100 shadow-sm text-xs text-textMuted">
            {t("landing.showcase.writePrompt")}
          </div>
          <div>
            <p className="text-xs font-medium text-textHeading mb-2">{t("landing.showcase.moodToday")}</p>
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
              <span className="text-[10px] uppercase font-bold text-[#3f6b40]">{t("landing.showcase.reminder")}</span>
              <p className="text-xs text-textHeading font-medium">{t("landing.showcase.rest")}</p>
              <p className="text-[11px] text-textMuted">{t("landing.showcase.pause")}</p>
            </div>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-olive-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-deepGreen-50 text-deepGreen flex items-center justify-center text-xs">▶</div>
              <div>
                <p className="text-xs font-medium text-textHeading">{t("landing.showcase.breathe")}</p>
                <p className="text-[10px] text-textMuted">{t("landing.showcase.breatheMeta")}</p>
              </div>
            </div>
            <Chip label={t("landing.showcase.start")} variant="olive" size="sm" />
          </div>
        </div>
      </div>

      {/* Now playing */}
      <div className="ms-phone">
        <div className="ms-phone-screen bg-gradient-to-b from-[#dcecf8] to-[#e8f3d8] p-5 text-center flex flex-col items-center space-y-4">
          <div className="w-full flex items-center justify-between text-xs text-textMuted">
            <span>← {t("common.back")}</span>
            <span className="font-medium text-textHeading">{t("landing.showcase.nowPlaying")}</span>
            <span className="opacity-0">←</span>
          </div>
          <div className="py-2">
            <BrainMascot stance="meditating" size={140} />
          </div>
          <div>
            <h4 className="ms-display text-xl text-[#3f6b40]">{t("landing.showcase.deepCalm")}</h4>
            <div className="flex items-center justify-center gap-2 mt-1.5">
              <Chip label={t("landing.showcase.fiveMin")} variant="olive" size="sm" />
              <Chip label={t("landing.showcase.breathing")} variant="green" size="sm" />
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
          <p className="text-xs text-[#3f6b40] font-medium pt-1">{t("landing.showcase.safe")}</p>
        </div>
      </div>
    </div>
  </section>
  );
};
