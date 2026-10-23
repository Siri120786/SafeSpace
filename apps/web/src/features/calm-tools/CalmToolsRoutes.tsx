import React, { useCallback } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useLowSensory } from "./hooks/useLowSensory";
import { BreathingExercise } from "./components/BreathingExercise";
import { GroundingExercise } from "./components/GroundingExercise";
import { CalmToolsHome } from "./components/CalmToolsHome";

interface CalmToolsRoutesProps {
  basePath?: string;   // where this is mounted: /calm-tools (Individual) or /child/calm-tools (Child)
  homePath?: string;   // where Exit goes: that person's home
}

/** Mounted inside a RoleRoute. Exit goes back to the home of whoever is using it. */
export const CalmToolsRoutes: React.FC<CalmToolsRoutesProps> = ({ basePath = "/calm-tools", homePath = "/dashboard" }) => {
  const navigate = useNavigate();
  const { lowSensory, preferenceError } = useLowSensory();
  const onExit = useCallback(() => navigate(homePath), [navigate, homePath]);
  const common = { lowSensory, onExit, notice: preferenceError };

  return (
    <Routes>
      <Route index element={<CalmToolsHome {...common} basePath={basePath} />} />
      <Route path="breathing" element={<BreathingExercise {...common} />} />
      <Route path="grounding" element={<GroundingExercise {...common} />} />
      <Route path="*" element={<Navigate to={basePath} replace />} />
    </Routes>
  );
};
