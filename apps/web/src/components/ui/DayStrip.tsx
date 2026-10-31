import React from "react";

// A calm timeline: one small square per day, oldest on the left, today on the
// right. Each row is one kind of activity with a plain-language sentence
// above it ("Checked in on 5 of 7 days"). A filled square means something
// happened that day; hovering (or a screen reader) gives the day's details.
// No axes or numbers to decode.

export interface StripDay {
  date: string;              // local "YYYY-MM-DD"
  color: string | null;      // fill, or null for an empty day
  detail: string;            // e.g. "Mon 20 Oct: 2 of 3 steps"
}

export interface StripRow {
  label: string;             // "Mood check-ins"
  summary: string;           // "Checked in on 5 of 7 days"
  days: StripDay[];
}

const dayName = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, opts);

export const formatStripDate = (iso: string) => dayName(iso, { weekday: "short", day: "numeric", month: "short" });

export const DayStrip: React.FC<{ rows: StripRow[]; legend?: { color: string; label: string }[] }> = ({ rows, legend }) => {
  const first = rows[0]?.days[0]?.date;
  const count = rows[0]?.days.length ?? 0;
  if (!first || count === 0) return null;
  // A month is slim bars (squares would shrink to dots); a week is squares.
  const gap = count > 14 ? "gap-[3px]" : "gap-1.5";
  const cell = count > 14 ? "h-7 rounded-[3px]" : "aspect-square rounded-[4px]";

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-sm font-semibold text-charcoal">{row.label}</p>
            <p className="text-sm text-charcoal/70">{row.summary}</p>
          </div>
          <div
            role="img"
            aria-label={`${row.label}: ${row.summary}`}
            className={`grid ${gap}`}
            style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
          >
            {row.days.map((d) => (
              <span
                key={d.date}
                title={d.detail}
                className={`${cell} border border-black/5`}
                style={{ background: d.color ?? "#EEF0EA" }}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-between text-xs text-charcoal/60">
        <span>{dayName(first, { day: "numeric", month: "short" })}</span>
        <span>Today</span>
      </div>
      {legend && legend.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-charcoal/70" aria-label="Colour key">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-3 rounded-[3px] border border-black/5" style={{ background: l.color }} />
              {l.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DayStrip;
