import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { AppRole } from "@safespace/shared-types";
import { useAuth } from "../hooks/useAuth";
import { decideRoute } from "../roleRouting";
import { MeadowNote, MeadowPage } from "../../landing/hero/MeadowPage";

interface RoleRouteProps {
  allow: AppRole[];
  children: React.ReactNode;
}

// Renders the route only for the roles in `allow`. Everyone else is sent to
// the right place (see roleRouting.ts): signed out -> sign-in, unfinished
// onboarding -> /onboarding, another role -> their own home.
export const RoleRoute: React.FC<RoleRouteProps> = ({ allow, children }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <MeadowPage>
        <MeadowNote>Loading...</MeadowNote>
      </MeadowPage>
    );
  }

  const decision = decideRoute(session, allow, location.pathname);
  if (decision.kind === "redirect") {
    return <Navigate to={decision.to} state={{ from: location }} replace />;
  }
  return <>{children}</>;
};

export default RoleRoute;
