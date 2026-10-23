import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import { listChildRoutineSetup } from "@safespace/api-client";
import { Card } from "../components/ui/Card";
import { RoutineEditor } from "../features/builders";
import { CaregiverPageShell, caregiverChildPath, useCaregiverChild } from "../features/caregiver";
import { ROUTES } from "../routes";

// /caregiver/children/:childId/routines: set up a child's routines
// (docs/role-flow/CONTRACT.md D4). Any caregiver of the child can.
export const CaregiverRoutinesPage: React.FC = () => {
  const { childId = "" } = useParams();
  const { child, error: childError } = useCaregiverChild(childId);
  const load = useCallback(() => listChildRoutineSetup(childId), [childId]);

  if (childError === "not_found") {
    return (
      <CaregiverPageShell title="Child not found" backTo={ROUTES.CAREGIVER_HOME}>
        <Card><p className="text-textBody">This child isn't one of yours, or no longer is.</p></Card>
      </CaregiverPageShell>
    );
  }

  const name = child?.name ?? "";
  return (
    <CaregiverPageShell
      title={child ? `${name}'s routines` : "Routines"}
      subtitle={child ? `${name} sees today's routines and ticks off each step.` : undefined}
      backTo={caregiverChildPath(childId)}
      backLabel={child ? `Back to ${name}` : "Back"}
    >
      {childError === "failed" && <p role="alert" className="text-sm text-red-700">Couldn't load this child right now.</p>}
      {child && (
        <RoutineEditor
          target={{ kind: "child", childId }}
          load={load}
          emptyText="No routines yet. A morning or bedtime routine is a good place to start."
          pausedNote="Paused: hidden from the child"
        />
      )}
    </CaregiverPageShell>
  );
};

export default CaregiverRoutinesPage;
