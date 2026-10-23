import React, { useCallback } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useLowSensory } from "../calm-tools";
import { BrightDays, CalmSpace, CycleCare, ModulesHome, SafeHarbor } from "./components/ModuleScreens";

/** Mounted at /modules/* inside a ProtectedRoute. Exit always returns to the dashboard. */
export const ModulesRoutes: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { lowSensory, preferenceError } = useLowSensory();
  const onExit = useCallback(() => navigate("/dashboard"), [navigate]);
  const role = session?.kind === "auth_user" ? session.profile.role : null;
  const common = { lowSensory, onExit, notice: preferenceError };

  return (
    <Routes>
      <Route index element={<ModulesHome {...common} />} />
      <Route path="calm-space" element={<CalmSpace {...common} />} />
      <Route path="bright-days" element={<BrightDays {...common} />} />
      <Route path="safe-harbor" element={<SafeHarbor {...common} />} />
      <Route path="cycle-care" element={<CycleCare {...common} role={role} />} />
      <Route path="*" element={<Navigate to="/modules" replace />} />
    </Routes>
  );
};
