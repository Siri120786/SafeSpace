import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, RoleRoute, GuestRoute } from "./features/auth";
import { AccessibilityProvider } from "./features/profile";
import { CalmToolsRoutes } from "./features/calm-tools";
import { ModulesRoutes } from "./features/wellness-modules";
import { StoryWorkflowRoute } from "./features/story-workflow";
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
import CaregiverAlertsPage from "./pages/CaregiverAlertsPage";
import CaregiverAddChildPage from "./pages/CaregiverAddChildPage";
import CaregiverJoinPage from "./pages/CaregiverJoinPage";
import CaregiverChildPage from "./pages/CaregiverChildPage";
import CaregiverRoutinesPage from "./pages/CaregiverRoutinesPage";
import CaregiverRemindersPage from "./pages/CaregiverRemindersPage";
import { MoodCheckInPage } from "./features/mood";

function MoodCheckInPageWrapper() {
  const navigate = useNavigate();
  return <MoodCheckInPage onBack={() => navigate(-1)} />;
}

// Every signed-in route says which roles it is for (docs/role-flow/CONTRACT.md
// section 3). RoleRoute sends everyone else to the right place.
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AccessibilityProvider>
          <Routes>
            {/* Public */}
            <Route path={ROUTES.HOME} element={<RoleChoicePage />} />
            <Route path={ROUTES.LOGIN} element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path={ROUTES.SIGNUP} element={<GuestRoute><SignupPage /></GuestRoute>} />
            <Route path={ROUTES.FORGOT_PASSWORD} element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
            <Route path={ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />

            {/* Adults (Individual and Caregiver) */}
            <Route
              path={ROUTES.ONBOARDING}
              element={<RoleRoute allow={["individual", "caregiver"]}><OnboardingPage /></RoleRoute>}
            />
            <Route
              path={ROUTES.PROFILE}
              element={<RoleRoute allow={["individual", "caregiver"]}><ProfilePage /></RoleRoute>}
            />

            {/* Individual */}
            <Route path={ROUTES.DASHBOARD} element={<RoleRoute allow={["individual"]}><DashboardPage /></RoleRoute>} />
            <Route
              path={ROUTES.MOOD_CHECK_IN}
              element={<RoleRoute allow={["individual"]}><MoodCheckInPageWrapper /></RoleRoute>}
            />
            <Route
              path={`${ROUTES.CALM_TOOLS}/*`}
              element={
                <RoleRoute allow={["individual"]}>
                  <CalmToolsRoutes basePath={ROUTES.CALM_TOOLS} homePath={ROUTES.DASHBOARD} />
                </RoleRoute>
              }
            />

            {/* Caregiver */}
            <Route
              path={ROUTES.CAREGIVER_HOME}
              element={<RoleRoute allow={["caregiver"]}><CaregiverDashboardPage /></RoleRoute>}
            />
            <Route
              path={ROUTES.CAREGIVER_ALERTS}
              element={<RoleRoute allow={["caregiver"]}><CaregiverAlertsPage /></RoleRoute>}
            />
            <Route
              path={ROUTES.CAREGIVER_ADD_CHILD}
              element={<RoleRoute allow={["caregiver"]}><CaregiverAddChildPage /></RoleRoute>}
            />
            <Route
              path={ROUTES.CAREGIVER_JOIN}
              element={<RoleRoute allow={["caregiver"]}><CaregiverJoinPage /></RoleRoute>}
            />
            <Route
              path={ROUTES.CAREGIVER_CHILD}
              element={<RoleRoute allow={["caregiver"]}><CaregiverChildPage /></RoleRoute>}
            />
            <Route
              path={ROUTES.CAREGIVER_CHILD_ROUTINES}
              element={<RoleRoute allow={["caregiver"]}><CaregiverRoutinesPage /></RoleRoute>}
            />
            <Route
              path={ROUTES.CAREGIVER_CHILD_REMINDERS}
              element={<RoleRoute allow={["caregiver"]}><CaregiverRemindersPage /></RoleRoute>}
            />
            <Route path="/caregiver/dashboard" element={<Navigate to={ROUTES.CAREGIVER_HOME} replace />} />

            {/* Child (family code + PIN) */}
            <Route
              path={ROUTES.CHILD_PIN}
              element={
                <ChildPinPage
                  onBack={() => window.history.back()}
                  onVerified={() => window.location.assign(ROUTES.CHILD_HOME)}
                />
              }
            />
            <Route
              path={ROUTES.CHILD_HOME}
              element={
                <RoleRoute allow={["child"]}>
                  <UserViewPage onLogOut={() => window.location.assign(ROUTES.HOME)} />
                </RoleRoute>
              }
            />
            <Route path="/child/dashboard" element={<Navigate to={ROUTES.CHILD_HOME} replace />} />
            <Route path={ROUTES.CHILD_MOOD} element={<RoleRoute allow={["child"]}><MoodCheckInPageWrapper /></RoleRoute>} />
            <Route
              path={`${ROUTES.CHILD_CALM_TOOLS}/*`}
              element={
                <RoleRoute allow={["child"]}>
                  <CalmToolsRoutes basePath={ROUTES.CHILD_CALM_TOOLS} homePath={ROUTES.CHILD_HOME} />
                </RoleRoute>
              }
            />

            {/* Sprint 3 prototypes: wellness modules and story workflow (signed-in adults, as before) */}
            <Route
              path="/modules/*"
              element={<RoleRoute allow={["individual", "caregiver"]}><ModulesRoutes /></RoleRoute>}
            />
            <Route
              path="/story-workflow"
              element={<RoleRoute allow={["individual", "caregiver"]}><StoryWorkflowRoute /></RoleRoute>}
            />

            <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
          </Routes>
        </AccessibilityProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
