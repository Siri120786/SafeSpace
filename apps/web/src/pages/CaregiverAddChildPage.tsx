import React from "react";
import { useNavigate } from "react-router-dom";
import { AddChildForm, CaregiverPageShell } from "../features/caregiver";
import { ROUTES } from "../routes";

// /caregiver/add-child: the caller becomes the child's primary caregiver.
export const CaregiverAddChildPage: React.FC = () => {
  const navigate = useNavigate();
  const home = () => navigate(ROUTES.CAREGIVER_HOME);
  return (
    <CaregiverPageShell
      title="Add a child"
      subtitle="They'll sign in on their own device with your family code and the PIN you choose."
      backTo={ROUTES.CAREGIVER_HOME}
    >
      <AddChildForm onAdded={home} onCancel={home} />
    </CaregiverPageShell>
  );
};

export default CaregiverAddChildPage;
