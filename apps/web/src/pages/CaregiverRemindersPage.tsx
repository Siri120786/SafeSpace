import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import { listChildReminders, listChildRoutineSetup } from "@safespace/api-client";
import { Card } from "../components/ui/Card";
import { ReminderEditor } from "../features/builders";
import { CaregiverPageShell, caregiverChildPath, useCaregiverChild } from "../features/caregiver";
import { ROUTES } from "../routes";

// /caregiver/children/:childId/reminders: what the child is reminded about and
// when, with an optional heads-up before the time (P2). Any caregiver of the child can.
export const CaregiverRemindersPage: React.FC = () => {
  const { childId = "" } = useParams();
  const { child, error: childError } = useCaregiverChild(childId);
  const loadReminders = useCallback(() => listChildReminders(childId), [childId]);
  const loadRoutines = useCallback(() => listChildRoutineSetup(childId), [childId]);

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
      title={child ? `${name}'s reminders` : "Reminders"}
      subtitle={child ? `${name} sees these when they're due in their Child Space. Nothing is sent to a phone.` : undefined}
      backTo={caregiverChildPath(childId)}
      backLabel={child ? `Back to ${name}` : "Back"}
    >
      {childError === "failed" && <p role="alert" className="text-sm text-red-700">Couldn't load this child right now.</p>}
      {child && (
        <ReminderEditor
          target={{ kind: "child", childId }}
          loadReminders={loadReminders}
          loadRoutines={loadRoutines}
          livesElsewhereHint="if the child lives somewhere else"
        />
      )}
    </CaregiverPageShell>
  );
};

export default CaregiverRemindersPage;
