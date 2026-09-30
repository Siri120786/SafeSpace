import React from "react";
import { useAuth } from "../features/auth";

export const DashboardPage: React.FC = () => {
  const { session, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600 font-medium">Loading profile...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (session.kind === "child") {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl p-8 border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-slate-800">Child Space</h1>
            <button
              onClick={logout}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-semibold text-sm"
            >
              Exit Space
            </button>
          </div>
          <p className="text-slate-600">Child Space — Phase 1</p>
        </div>
      </div>
    );
  }

  if (session.kind === "caregiver") {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Caregiver Dashboard</h1>
              <p className="text-sm text-slate-500">Authenticated Caregiver Session</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-sm rounded-lg border border-rose-200"
            >
              Sign Out
            </button>
          </div>
          <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-xl mb-6">
            <h2 className="text-lg font-semibold text-indigo-900 mb-1">
              Caregiver Dashboard Foundation — Phase 1
            </h2>
            <p className="text-sm text-indigo-700">
              Authentication and identity foundation operating securely via Supabase Auth & PostgreSQL RLS.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { profile, user } = session;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {profile.role === "caregiver" ? "Caregiver Dashboard" : "User Dashboard"}
            </h1>
            <p className="text-sm text-slate-500">
              Logged in as {user.email} ({profile.role.toUpperCase()})
            </p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-sm rounded-lg border border-rose-200"
          >
            Sign Out
          </button>
        </div>

        <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-xl mb-6">
          <h2 className="text-lg font-semibold text-indigo-900 mb-1">
            {profile.role === "caregiver"
              ? "Caregiver Dashboard Foundation — Phase 1"
              : "User Dashboard Foundation — Phase 1"}
          </h2>
          <p className="text-sm text-indigo-700">
            Authentication, identity, profile management, and role-based routing are operating securely via Supabase Auth and PostgreSQL RLS.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-semibold block text-slate-800">User ID:</span>
            <code className="text-xs text-indigo-600 break-all">{profile.id}</code>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-semibold block text-slate-800">Onboarding State:</span>
            <span className="capitalize text-slate-700">{profile.onboardingState}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
