import React from "react";
import { RoleNotice, useAuth } from "../features/auth";
import { AlertBanner, ChildrenPanel, LinkedUsersPanel } from "../features/caregiver";
import { CalmHome } from "../features/themes/calm/CalmKit";
import { useLowSensory } from "../features/calm-tools/hooks/useLowSensory";
import { ROUTES } from "../routes";

// The Caregiver home (routed with RoleRoute allow={["caregiver"]} in App.tsx),
// in the meadow look (the landing page's boy and puppy). Caregivers have no
// personal tools: only their children (docs/role-flow/CONTRACT.md).
export const CaregiverDashboardPage: React.FC = () => {
  const { session, logout } = useAuth();
  const { lowSensory } = useLowSensory();
  if (!session || session.kind !== "auth_user") return null;
  const displayName = session.profile.displayName || "Caregiver";

  return (
    <CalmHome
      stillOnly={lowSensory}
      eyebrow="Caregiver"
      greeting={`Hi, ${displayName}`}
      line="Your children's spaces and how their week is going."
      dayTitle="Your children"
      onSignOut={logout}
      tiles={[
        { to: ROUTES.CAREGIVER_STORIES, label: "Stories", emoji: "📖" },
        { to: ROUTES.CAREGIVER_ALERTS, label: "Alerts", emoji: "🔔" },
        { to: ROUTES.CAREGIVER_ADD_CHILD, label: "Add a child", emoji: "🧒" },
        { to: ROUTES.CAREGIVER_JOIN, label: "Join a family", emoji: "🤝" },
        { to: ROUTES.CAREGIVER_NUTRITION, label: "NutritionGuide", emoji: "🥕" },
        { to: ROUTES.PROFILE, label: "Profile", emoji: "👤" },
      ]}
      tilesLabel="Caregiver pages"
    >
      <RoleNotice />
      <AlertBanner alertsPath={ROUTES.CAREGIVER_ALERTS} />
      <ChildrenPanel addChildPath={ROUTES.CAREGIVER_ADD_CHILD} joinPath={ROUTES.CAREGIVER_JOIN} />
      <LinkedUsersPanel caregiverId={session.profile.id} />
    </CalmHome>
  );
};

export default CaregiverDashboardPage;
