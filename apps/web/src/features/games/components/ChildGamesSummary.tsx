import React, { useEffect, useState } from "react";
import { getChildGameSummary } from "@safespace/api-client";
import { catalog, text } from "../lib/content";
import { summarizeGameProgress, type GameSummaryRow } from "../lib/summary";

interface Props {
  childId: string;
  childName: string;
}

/** Caregiver view: which games a child has played. Read under the caregiver's own RLS. */
export const ChildGamesSummary: React.FC<Props> = ({ childId, childName }) => {
  const [rows, setRows] = useState<GameSummaryRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    getChildGameSummary(childId)
      .then((r) => active && setRows(summarizeGameProgress(r)))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [childId]);

  if (failed) return <p className="text-sm text-textMuted">Couldn't load games right now.</p>;
  if (!rows) return <p className="text-sm text-textMuted">{text("ui.loading")}</p>;
  if (rows.length === 0) return <p className="text-sm text-textMuted">{childName}: {text("ui.noGames")}</p>;

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {rows.map((r) => {
          const g = catalog.games.find((x) => x.id === r.gameId)!;
          return (
            <li key={r.gameId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-olive-50/50 px-4 py-3 text-sm text-textBody">
              <span aria-hidden="true" className="text-xl">{g.emoji}</span>
              <span className="font-medium text-textHeading">{text(g.titleKey)}</span>
              <span>{r.rounds} {text("ui.roundsDone")}</span>
              <span className="text-xs text-textMuted">
                {r.levels.join(", ")} · {text("ui.lastPlayed")} {new Date(r.lastPlayedAt).toLocaleDateString()}
              </span>
              {r.bestStars && <span role="img" aria-label={`${text("ui.bestStars")}: ${r.bestStars}`}>{"⭐".repeat(r.bestStars)}</span>}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-textMuted">Games are for fun. These are counts of rounds played, not an assessment of ability.</p>
    </div>
  );
};
