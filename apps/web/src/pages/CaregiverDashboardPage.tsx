import React from "react";
import { useTranslation } from "react-i18next";
import { RoleNotice, useAuth } from "../features/auth";
import { AlertBanner, ChildrenPanel, LinkedUsersPanel } from "../features/caregiver";
import { CalmHome } from "../features/themes/calm/CalmKit";
import { useLowSensory } from "../features/calm-tools/hooks/useLowSensory";
import { ROUTES } from "../routes";

// The Caregiver home (routed with RoleRoute allow={["caregiver"]} in App.tsx),
// in the meadow look (the landing page's boy and puppy). Caregivers have no
// personal tools: only their children (docs/role-flow/CONTRACT.md).
export const CaregiverDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { session, logout } = useAuth();
  const { lowSensory } = useLowSensory();
  if (!session || session.kind !== "auth_user") return null;
  const displayName = session.profile.displayName || t("home.caregiver.fallbackName");

  return (
    <CalmHome
      stillOnly={lowSensory}
      eyebrow={t("home.caregiver.eyebrow")}
      greeting={t("home.greeting", { name: displayName })}
      line={t("home.caregiver.line")}
      dayTitle={t("home.caregiver.dayTitle")}
      onSignOut={logout}
      tiles={[
        { to: ROUTES.CAREGIVER_STORIES, label: t("tiles.stories"), emoji: "📖" },
        { to: ROUTES.CAREGIVER_ALERTS, label: t("tiles.alerts"), emoji: "🔔" },
        { to: ROUTES.CAREGIVER_ADD_CHILD, label: t("tiles.addChild"), emoji: "🧒" },
        { to: ROUTES.CAREGIVER_JOIN, label: t("tiles.joinFamily"), emoji: "🤝" },
        { to: ROUTES.CAREGIVER_NUTRITION, label: t("tiles.nutrition"), emoji: "🥕" },
        { to: ROUTES.PROFILE, label: t("tiles.profile"), emoji: "👤" },
      ]}
      tilesLabel={t("home.caregiver.tilesLabel")}
    >
      <RoleNotice />
      <AlertBanner alertsPath={ROUTES.CAREGIVER_ALERTS} />
      <ChildrenPanel addChildPath={ROUTES.CAREGIVER_ADD_CHILD} joinPath={ROUTES.CAREGIVER_JOIN} />
      <LinkedUsersPanel caregiverId={session.profile.id} />
    </CalmHome>
  );
};

export default CaregiverDashboardPage;
