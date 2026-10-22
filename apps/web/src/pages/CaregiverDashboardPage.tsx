import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { LeafCluster } from "../components/vectors/LeafFrame";
import { ChildrenPanel } from "../features/caregiver";
import { ROUTES } from "../routes";

// Caregiver-only (routed with allowedRoles={["caregiver"]} in App.tsx).
export const CaregiverDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-[#FAF7F2] to-paleLime/30 text-textHeading font-sans pb-16 relative overflow-x-hidden">
      <LeafCluster position="top-right" size={180} className="fixed top-0 right-0 opacity-40 pointer-events-none" />
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-medium text-textHeading">Family</h1>
            <p className="text-sm text-textMuted font-light mt-1">Your children's spaces and how their week is going.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.DASHBOARD)}>
            ← Back to dashboard
          </Button>
        </div>
        <ChildrenPanel />
      </div>
    </div>
  );
};

export default CaregiverDashboardPage;
