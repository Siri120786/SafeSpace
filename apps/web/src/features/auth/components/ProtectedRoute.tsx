import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "@safespace/shared-types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600 font-medium">Loading session...</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Adult user onboarding status gating
  if (session.kind === "auth_user") {
    const isOnboardingRoute = location.pathname === "/onboarding";

    if (session.profile.onboardingState === "pending" && !isOnboardingRoute) {
      return <Navigate to="/onboarding" replace />;
    }

    if (session.profile.onboardingState === "completed" && isOnboardingRoute) {
      return <Navigate to="/dashboard" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(session.profile.role)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
