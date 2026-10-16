import React, { useCallback } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useLowSensory } from "./hooks/useLowSensory";
import { BreathingExercise } from "./components/BreathingExercise";
import { GroundingExercise } from "./components/GroundingExercise";
import { CalmToolsHome } from "./components/CalmToolsHome";

/** Mounted at /calm-tools/* inside a ProtectedRoute. Exit always goes back to the dashboard. */
export const CalmToolsRoutes: React.FC = () => {
  const navigate = useNavigate();
  const { lowSensory, preferenceError } = useLowSensory();
  const onExit = useCallback(() => navigate("/dashboard"), [navigate]);
  const common = { lowSensory, onExit, notice: preferenceError };

  return (
    <Routes>
      <Route index element={<CalmToolsHome {...common} />} />
      <Route path="breathing" element={<BreathingExercise {...common} />} />
      <Route path="grounding" element={<GroundingExercise {...common} />} />
      <Route path="*" element={<Navigate to="/calm-tools" replace />} />
    </Routes>
  );
};
