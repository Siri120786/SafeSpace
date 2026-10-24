import React, { useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { useLowSensory } from "../calm-tools/hooks/useLowSensory";
import { useOptionalChildSpace } from "../child-space/ChildSpaceContext";
import { GamesProvider } from "./GamesContext";
import { FeelingsDetectiveGame } from "./components/FeelingsDetectiveGame";
import { GamesHome } from "./components/GamesHome";
import { ImagineCreateGame } from "./components/ImagineCreateGame";
import { MazeExplorerGame } from "./components/MazeExplorerGame";
import { MemoryMatchGame } from "./components/MemoryMatchGame";
import { PatternQuestGame } from "./components/PatternQuestGame";
import { catalog, isGameId } from "./lib/content";

interface RoutesProps {
  basePath: string;   // where Games Corner is mounted: /games (Individual) or /child/games (Child)
  homePath: string;   // where Exit goes: that person's home
  moodPath: string;   // the mood check-in page for that person
}

const GameRoute: React.FC<RoutesProps> = ({ basePath, moodPath }) => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  // Bumping the key starts a fresh round.
  const [round, setRound] = useState(0);
  if (!isGameId(gameId) || !catalog.games.find((g) => g.id === gameId)?.available) return <Navigate to={basePath} replace />;

  const common = { onExit: () => navigate(basePath), onAgain: () => setRound((n) => n + 1) };
  const game = (() => {
    switch (gameId) {
      case "memory-match":
        return <MemoryMatchGame {...common} />;
      case "pattern-quest":
        return <PatternQuestGame {...common} />;
      case "feelings-detective":
        return <FeelingsDetectiveGame {...common} onCheckMood={() => navigate(moodPath)} />;
      case "imagine-create":
        return <ImagineCreateGame {...common} />;
      case "maze-explorer":
        return <MazeExplorerGame {...common} />;
    }
  })();
  return <React.Fragment key={`${gameId}-${round}`}>{game}</React.Fragment>;
};

/**
 * Games Corner. Mounted inside a RoleRoute for adults (Individual) and inside
 * the child's space. Game rules and puzzles run on this device; progress is
 * saved locally first and to the account when the network allows.
 */
export const GamesRoutes: React.FC<RoutesProps> = (props) => {
  const { session } = useAuth();
  const { lowSensory } = useLowSensory();
  const child = useOptionalChildSpace();

  if (!session || (session.kind !== "auth_user" && session.kind !== "child")) return <Navigate to={props.homePath} replace />;

  return (
    <GamesProvider session={session} lowSensory={lowSensory} guard={child?.guard}>
      <Routes>
        <Route index element={<GamesHome basePath={props.basePath} homePath={props.homePath} />} />
        <Route path=":gameId" element={<GameRoute {...props} />} />
        <Route path="*" element={<Navigate to={props.basePath} replace />} />
      </Routes>
    </GamesProvider>
  );
};
