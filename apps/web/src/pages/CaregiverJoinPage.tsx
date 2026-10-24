import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { CaregiverPageShell, JoinInviteForm } from "../features/caregiver";
import { ROUTES } from "../routes";

// /caregiver/join: become a co-caregiver with a one-time invite code from the
// child's primary caregiver (docs/role-flow/CONTRACT.md section 4).
export const CaregiverJoinPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <CaregiverPageShell
      title="Join with an invite code"
      subtitle="Another caregiver gave you an 8-character code for their child."
      backTo={ROUTES.CAREGIVER_HOME}
    >
      <Card className="p-6">
        <JoinInviteForm onJoined={() => navigate(ROUTES.CAREGIVER_HOME)} />
      </Card>
    </CaregiverPageShell>
  );
};

export default CaregiverJoinPage;
