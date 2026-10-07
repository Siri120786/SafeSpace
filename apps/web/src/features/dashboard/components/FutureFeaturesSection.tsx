import React, { useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Chip } from "../../../components/ui/Chip";
import { Sparkle } from "../../../components/vectors/Sparkles";

export interface FutureFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
  badge: string;
}

export const FUTURE_FEATURES_LIST: FutureFeature[] = [
  {
    id: "mood_trends",
    title: "Mood Trends",
    description: "Visualize your emotional journey over weeks & months with gentle analytics.",
    icon: "📈",
    badge: "Coming Soon",
  },
  {
    id: "journal",
    title: "Guided Journaling",
    description: "Prompts for daily reflection, gratitude, and letting out heavy thoughts.",
    icon: "📖",
    badge: "Coming Soon",
  },
  {
    id: "sleep_stories",
    title: "Sleep Stories",
    description: "Soothing bedtime tales and ambient soundscapes for restful nights.",
    icon: "🌙",
    badge: "Coming Soon",
  },
  {
    id: "community",
    title: "Community Circles",
    description: "Safe, moderated, anonymous peer support circles for shared experiences.",
    icon: "🤝",
    badge: "Coming Soon",
  },
  {
    id: "therapist",
    title: "Talk to a Therapist",
    description: "Connect with certified, compassionate mental-health professionals.",
    icon: "💬",
    badge: "Coming Soon",
  },
];

export const FutureFeaturesSection: React.FC = () => {
  const [notified, setNotified] = useState<Record<string, boolean>>({});

  const toggleNotify = (id: string) => {
    setNotified((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-medium text-textHeading">Explore Coming Features</h3>
          <p className="text-xs text-textMuted font-light">
            New gentle tools being crafted for your SafeSpace journey.
          </p>
        </div>
        <Sparkle size={20} className="text-olive-500" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FUTURE_FEATURES_LIST.map((feat) => {
          const isNotified = notified[feat.id];
          return (
            <Card
              key={feat.id}
              className="p-5 bg-white/70 border border-olive-100 hover:border-olive-300 transition-all flex flex-col justify-between relative overflow-hidden"
            >
              <div>
                {/* Soft Lock / Sparkle Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{feat.icon}</span>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-olive-50 border border-olive-200/60 text-[11px] font-medium text-deepGreen">
                    <svg className="w-3 h-3 fill-current text-olive-600" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <span>{feat.badge}</span>
                  </div>
                </div>

                <h4 className="font-display text-base font-medium text-textHeading mb-1">
                  {feat.title}
                </h4>

                <p className="text-xs text-textBody/80 font-light leading-relaxed mb-4">
                  {feat.description}
                </p>
              </div>

              <div className="pt-2 border-t border-olive-100 flex items-center justify-between">
                <span className="text-[11px] text-textMuted font-light">Stay updated</span>
                <Chip
                  label={isNotified ? "Notified ✓" : "Notify me"}
                  variant={isNotified ? "green" : "neutral"}
                  size="sm"
                  onClick={() => toggleNotify(feat.id)}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
};
