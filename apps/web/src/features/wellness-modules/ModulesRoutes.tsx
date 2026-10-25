import React, { useCallback } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useLowSensory } from "../calm-tools";
import { BrightDays, CalmSpace, CycleCare, ModulesHome, SafeHarbor } from "./components/ModuleScreens";
import { FoodModule, PcosPcodHub, PhysicalExercise } from "./components/PcosScreens";
import type { ModuleInfo } from "./lib/content";
import { OceanBreathing, OceanGrounding, calmSpacePath } from "../conditions/anxiety/ocean/OceanCalmPages";
// Calm Space's ocean look (loaded here, with the pages that use it).
import "../conditions/anxiety/ocean/ocean.css";
// The PCOS / PCOD pages' dusk hillside.
import "../conditions/pcos-pcod/dusk/dusk.css";

interface ModulesRoutesProps {
  // Defaults are the adult routes (/modules, exit to /dashboard). The child's
  // space mounts these at /child/modules and exits to /child (role-flow 5b).
  basePath?: string;
  homePath?: string;
  onlyKeys?: readonly ModuleInfo["key"][];
  showStoryWorkflow?: boolean;
}

/** Mounted at `${basePath}/*` inside a RoleRoute. Exit returns to homePath. */
export const ModulesRoutes: React.FC<ModulesRoutesProps> = ({
  basePath = "/modules",
  homePath = "/dashboard",
  onlyKeys,
  showStoryWorkflow,
}) => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { lowSensory, preferenceError } = useLowSensory();
  const onExit = useCallback(() => navigate(homePath), [navigate, homePath]);
  // Calm Space's own exercises go back to Calm Space.
  const backToCalmSpace = useCallback(() => navigate(calmSpacePath(basePath)), [navigate, basePath]);
  const role = session?.kind === "auth_user" ? session.profile.role : null;
  const common = { lowSensory, onExit, notice: preferenceError, paths: { base: basePath } };

  return (
    <Routes>
      <Route index element={<ModulesHome {...common} onlyKeys={onlyKeys} showStoryWorkflow={showStoryWorkflow} />} />
      <Route path="calm-space" element={<CalmSpace {...common} />} />
      <Route path="calm-space/breathing" element={<OceanBreathing lowSensory={lowSensory} notice={preferenceError} onExit={backToCalmSpace} base={basePath} />} />
      <Route path="calm-space/grounding" element={<OceanGrounding lowSensory={lowSensory} notice={preferenceError} onExit={backToCalmSpace} base={basePath} />} />
      <Route path="bright-days" element={<BrightDays {...common} />} />
      <Route path="safe-harbor" element={<SafeHarbor {...common} />} />
      <Route path="pcos-pcod" element={<PcosPcodHub {...common} role={role} />} />
      <Route path="pcos-pcod/cycle-care" element={<CycleCare {...common} role={role} session={session} />} />
      <Route path="pcos-pcod/exercise" element={<PhysicalExercise {...common} role={role} />} />
      <Route path="pcos-pcod/food" element={<FoodModule {...common} role={role} />} />
      <Route path="cycle-care" element={<Navigate to={`${basePath}/pcos-pcod/cycle-care`} replace />} />
      <Route path="*" element={<Navigate to={basePath} replace />} />
    </Routes>
  );
};
