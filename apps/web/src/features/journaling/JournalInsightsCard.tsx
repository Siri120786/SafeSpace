import React, { useEffect, useState } from "react";
import type { JournalInsights } from "@safespace/shared-types";

// "Your month in the journal": rule-based insights from the journal-analysis
// Edge Function (counts and everyday themes, never anything diagnostic). The
// writer sees the fixed safety message instead of themes when a recent entry
// tripped the crisis screen. If insights can't load, the card isn't shown.

export const JournalInsightsCard: React.FC<{
  load: () => Promise<JournalInsights>;
  title?: string;
  // Words for the person the card is about ("You" or a child's name).
  who?: string;
  reloadKey?: unknown;
}> = ({ load, title = "Your month in the journal", who = "You", reloadKey }) => {
  const [data, setData] = useState<JournalInsights | null>(null);

  useEffect(() => {
    let live = true;
    load().then((d) => live && setData(d)).catch(() => live && setData(null));
    return () => {
      live = false;
    };
    // `load` is recreated by callers each render; reload on reloadKey instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  if (!data) return null;

  if (data.safetyMessage) {
    return (
      <section aria-label={title} role="note" className="rounded-3xl border-2 border-sky-200 bg-sky-50 p-5 text-charcoal">
        <h2 className="font-display text-lg font-bold mb-2">You're not alone</h2>
        <p className="text-sm leading-relaxed">{data.safetyMessage}</p>
      </section>
    );
  }

  if (data.entries === 0) return null;

  return (
    <section aria-label={title} className="rounded-3xl bg-white p-5 shadow-card text-charcoal">
      <h2 className="font-display text-lg font-bold mb-3">{title}</h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat value={data.entries} label={data.entries === 1 ? "entry" : "entries"} />
        <Stat value={data.daysWritten} label={data.daysWritten === 1 ? "day written" : "days written"} />
        <Stat value={data.gratitudeEntries} label="gratitude" />
      </div>
      {data.gratitudeStreakDays >= 2 && (
        <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm">
          🌟 {who === "You" ? "You've" : `${who} has`} written something grateful {data.gratitudeStreakDays} days in a row.
        </p>
      )}
      {data.themes.length > 0 && (
        <div className="mt-3">
          <p className="text-sm text-charcoal/70 mb-2">{who === "You" ? "You" : who} wrote most about</p>
          <ul className="flex flex-wrap gap-2">
            {data.themes.map((t) => (
              <li key={t.key} className="rounded-full bg-botanical-50 px-3 py-1.5 text-sm font-semibold text-botanical-800">
                <span aria-hidden="true">{t.emoji} </span>
                {t.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

const Stat: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="rounded-2xl bg-ivory-100 px-2 py-3">
    <p className="font-display text-2xl font-bold">{value}</p>
    <p className="text-xs text-charcoal/70">{label}</p>
  </div>
);

export default JournalInsightsCard;
