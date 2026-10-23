import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { LeafCluster } from "../components/vectors/LeafFrame";
import { RoleNotice, useAuth } from "../features/auth";
import { ChildrenPanel, LinkedUsersPanel } from "../features/caregiver";
import { ROUTES } from "../routes";

// The Caregiver home (routed with RoleRoute allow={["caregiver"]} in App.tsx).
// Caregivers have no personal tools: only their children (docs/role-flow/CONTRACT.md).
export const CaregiverDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  if (!session || session.kind !== "auth_user") return null;
  const displayName = session.profile.displayName || "Caregiver";

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-[#FAF7F2] to-paleLime/30 text-textHeading font-sans pb-16 relative overflow-x-hidden">
      <LeafCluster position="top-right" size={180} className="fixed top-0 right-0 opacity-40 pointer-events-none" />
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <RoleNotice />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-medium text-textHeading">Hi, {displayName}</h1>
            <p className="text-sm text-textMuted font-light mt-1">Your children's spaces and how their week is going.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.PROFILE)}>
              Profile
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="text-red-500">
              Sign out
            </Button>
          </div>
        </div>
        <ChildrenPanel />
        <LinkedUsersPanel caregiverId={session.profile.id} />
      </div>
    </div>
  );
};

export default CaregiverDashboardPage;
