import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getRecommendations } from "@safespace/api-client";
import type { AppSession, Recommendation, RecommendationKey } from "@safespace/shared-types";

// "Try this next": up to three rule-based suggestions on an Individual's or a
// child's home (the recommendations Edge Function). Each home passes where
// each suggestion goes; a key with no route (music turned off for a child,
// say) is left out. If suggestions can't load, the card simply isn't shown.

// Labels are tiles.<tile> in the locale files.
const LOOK: Record<RecommendationKey, { tile: string; emoji: string }> = {
  mood_check_in: { tile: "moodCheckIn", emoji: "🌱" },
  calm_space: { tile: "calmSpace", emoji: "🌊" },
  routines: { tile: "routines", emoji: "✅" },
  journal: { tile: "journal", emoji: "📓" },
  music: { tile: "music", emoji: "🎵" },
  games: { tile: "games", emoji: "🎲" },
  companion: { tile: "companion", emoji: "💬" },
  stories: { tile: "stories", emoji: "📖" },
};

export const TryNext: React.FC<{
  session: AppSession;
  routes: Partial<Record<RecommendationKey, string>>;
  title?: string;
}> = ({ session, routes, title: titleProp }) => {
  const { t } = useTranslation();
  const title = titleProp ?? t("home.tryNext");
  const [items, setItems] = useState<Recommendation[] | null>(null);

  useEffect(() => {
    let live = true;
    getRecommendations(session)
      .then((r) => live && setItems(r))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [session]);

  const shown = (items ?? []).filter((r) => routes[r.key]);
  if (shown.length === 0) return null;

  return (
    <section aria-label={title} className="rounded-3xl bg-white p-5 shadow-card">
      <h2 className="font-display text-xl font-bold mb-3 text-charcoal">{title}</h2>
      <ul className="space-y-2">
        {shown.map((r) => (
          <li key={r.key}>
            <Link
              to={routes[r.key]!}
              className="flex items-center gap-3 rounded-2xl bg-ivory-100 px-3 py-2.5 text-charcoal hover:bg-botanical-50 focus:outline-none focus:ring-2 focus:ring-botanical-700"
            >
              <span aria-hidden="true" className="text-2xl">{LOOK[r.key].emoji}</span>
              <span className="flex-1">
                <span className="block text-sm font-semibold">{t(`tiles.${LOOK[r.key].tile}`)}</span>
                <span className="block text-sm text-charcoal/70">{r.reason}</span>
              </span>
              <span aria-hidden="true" className="text-botanical-800">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default TryNext;
