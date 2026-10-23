import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { landingFor } from "../roleRouting";

interface GuestRouteProps {
  children: React.ReactNode;
}

export const GuestRoute: React.FC<GuestRouteProps> = ({ children }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600 font-medium">Loading...</div>
      </div>
    );
  }

  // Already signed in: onboarding if unfinished, otherwise the role's home.
  const landing = landingFor(session);
  if (landing) return <Navigate to={landing} replace />;

  return <>{children}</>;
};

export default GuestRoute;
