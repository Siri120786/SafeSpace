import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, ProtectedRoute, GuestRoute } from "./features/auth";
import { AccessibilityProvider } from "./features/profile";
import { CalmToolsRoutes } from "./features/calm-tools";
import { ROUTES } from "./routes";

import RoleChoicePage from "./pages/RoleChoicePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import OnboardingPage from "./pages/OnboardingPage";
import ProfilePage from "./pages/ProfilePage";
import ChildPinPage from "./pages/ChildPinPage";
import UserViewPage from "./pages/UserViewPage";
import CaregiverDashboardPage from "./pages/CaregiverDashboardPage";
import { MoodCheckInPage } from "./features/mood";

function MoodCheckInPageWrapper() {
  const navigate = useNavigate();
  return <MoodCheckInPage onBack={() => navigate(-1)} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AccessibilityProvider>
          <Routes>
          {/* Public / Landing Route */}
          <Route path="/" element={<RoleChoicePage />} />

          {/* Guest Only Routes (Redirect to /dashboard if logged in) */}
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <GuestRoute>
                <SignupPage />
              </GuestRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <GuestRoute>
                <ForgotPasswordPage />
              </GuestRoute>
            }
          />
          <Route
            path="/reset-password"
            element={<ResetPasswordPage />}
          />

          {/* Child Pin Login Route */}
          <Route
            path="/child/pin"
            element={
              <ChildPinPage
                onBack={() => window.history.back()}
                onVerified={() => window.location.assign("/child/dashboard")}
              />
            }
          />
          <Route
            path="/child/dashboard"
            element={
              <UserViewPage
                onLogOut={() => window.location.assign("/")}
              />
            }
          />

          {/* Protected Onboarding Flow */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Role-Based Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Caregiver-only: family code, children, per-child overview */}
          <Route
            path={ROUTES.CAREGIVER_DASHBOARD}
            element={
              <ProtectedRoute allowedRoles={["caregiver"]}>
                <CaregiverDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Calm Tools (breathing, grounding) */}
          <Route
            path="/calm-tools/*"
            element={
              <ProtectedRoute>
                <CalmToolsRoutes />
              </ProtectedRoute>
            }
          />

          {/* Protected Profile Page */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Protected Mood Check-In Route */}
          <Route
            path={ROUTES.MOOD_CHECK_IN}
            element={
              <ProtectedRoute>
                <MoodCheckInPageWrapper />
              </ProtectedRoute>
            }
          />

          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AccessibilityProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
