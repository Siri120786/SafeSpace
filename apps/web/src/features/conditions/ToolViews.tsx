import React from "react";
import { Link } from "react-router-dom";
import { AdhdFocusZone } from "./adhd";
import { EmotionCards, TransitionCountdown } from "./autism";
import type { ConditionTool, ConditionToolKey } from "./conditionTools";

// One ADHD or autism tool, the same for children and Individuals (role-flow
// 8c). Each tool saves on this device for the signed-in person until step 8e
// moves it to the database.
export const ConditionToolView: React.FC<{ toolKey: ConditionToolKey }> = ({ toolKey }) => {
  switch (toolKey) {
    case "focus":
      return <AdhdFocusZone />;
    case "feelings":
      return <EmotionCards />;
    case "countdown":
      return <TransitionCountdown />;
  }
};

// "Your tools" then "More tools", as tiles. `tone` matches the page: the
// child space or an adult's pages.
export const ConditionToolList: React.FC<{
  mine: ConditionTool[];
  more: ConditionTool[];
  pathFor: (key: ConditionToolKey) => string;
  tone: "child" | "adult";
}> = ({ mine, more, pathFor, tone }) => {
  const heading = tone === "child" ? "font-display text-xl font-bold text-charcoal" : "font-display text-xl font-medium text-textHeading";
  const tile =
    tone === "child"
      ? "block h-full rounded-3xl bg-white p-5 shadow-card focus:outline-none focus:ring-2 focus:ring-botanical-700"
      : "block h-full rounded-2xl border border-olive-100 bg-white p-4 hover:bg-olive-50 focus:outline-none focus:ring-2 focus:ring-olive-500";
  // With only one group, the page title says it all: no heading.
  const section = (title: string | null, list: ConditionTool[], id: string) =>
    list.length > 0 && (
      <section aria-labelledby={title ? id : undefined} aria-label={title ? undefined : "Tools"} className="space-y-3">
        {title && <h2 id={id} className={heading}>{title}</h2>}
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((t) => (
            <li key={t.key}>
              <Link to={pathFor(t.key)} className={tile}>
                <span aria-hidden="true" className="text-3xl">{t.emoji}</span>
                <span className={`mt-1 block ${tone === "child" ? "font-display text-lg font-bold text-charcoal" : "font-medium text-textHeading"}`}>{t.label}</span>
                <span className={`block text-sm ${tone === "child" ? "text-charcoal/70" : "text-textMuted"}`}>{t.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  return (
    <div className="space-y-6">
      {section(more.length ? "Your tools" : null, mine, "condition-tools-mine")}
      {section(mine.length ? "More tools" : null, more, "condition-tools-more")}
    </div>
  );
};
