import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
import { AuthProvider, RoleRoute, GuestRoute } from "./features/auth";
import { AccessibilityProvider } from "./features/profile";
import { CalmToolsRoutes } from "./features/calm-tools";
import { GamesRoutes } from "./features/games";
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
import CaregiverDashboardPage from "./pages/CaregiverDashboardPage";
import CaregiverAlertsPage from "./pages/CaregiverAlertsPage";
import CaregiverAddChildPage from "./pages/CaregiverAddChildPage";
import CaregiverJoinPage from "./pages/CaregiverJoinPage";
import CaregiverChildPage from "./pages/CaregiverChildPage";
import CaregiverRoutinesPage from "./pages/CaregiverRoutinesPage";
import CaregiverRemindersPage from "./pages/CaregiverRemindersPage";
import CaregiverChildSettingsPage from "./pages/CaregiverChildSettingsPage";
import CaregiverChildCaregiversPage from "./pages/CaregiverChildCaregiversPage";
import { MoodCheckInPage } from "./features/mood";
import { ChildSpaceProvider, SharingQuestionScreen } from "./features/child-space";
import ChildHomePage from "./pages/ChildHomePage";
import ChildSettingsPage from "./pages/ChildSettingsPage";
import ChildTalkPage from "./pages/ChildTalkPage";
import {
  IndividualCompanionPage,
  IndividualJournalPage,
  IndividualRemindersPage,
  IndividualRoutinesPage,
} from "./pages/IndividualToolPages";
import {
  ChildCompanionPage,
  ChildJournalPage,
  ChildModulesPage,
  ChildRemindersPage,
  ChildRoutinesPage,
} from "./pages/ChildToolPages";

function MoodCheckInPageWrapper() {
  const navigate = useNavigate();
  return <MoodCheckInPage onBack={() => navigate(-1)} />;
}

// Every child page shares one loaded profile, the 15+ sharing question and
// session-ended handling (docs/role-flow/CONTRACT.md section 10).
function ChildSpaceLayout() {
  return (
    <ChildSpaceProvider pinPath={ROUTES.CHILD_PIN} sharingQuestion={(answer) => <SharingQuestionScreen onAnswered={answer} />}>
      <Outlet />
    </ChildSpaceProvider>
  );
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

            <Route
              path={`${ROUTES.GAMES}/*`}
              element={
                <RoleRoute allow={["individual"]}>
                  <GamesRoutes basePath={ROUTES.GAMES} homePath={ROUTES.DASHBOARD} moodPath={ROUTES.MOOD_CHECK_IN} />
                </RoleRoute>
              }
            />

            <Route path={ROUTES.ROUTINES} element={<RoleRoute allow={["individual"]}><IndividualRoutinesPage /></RoleRoute>} />
            <Route path={ROUTES.JOURNAL} element={<RoleRoute allow={["individual"]}><IndividualJournalPage /></RoleRoute>} />
            <Route path={ROUTES.REMINDERS} element={<RoleRoute allow={["individual"]}><IndividualRemindersPage /></RoleRoute>} />
            <Route path={ROUTES.COMPANION} element={<RoleRoute allow={["individual"]}><IndividualCompanionPage /></RoleRoute>} />

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
            <Route
              path={ROUTES.CAREGIVER_CHILD_SETTINGS}
              element={<RoleRoute allow={["caregiver"]}><CaregiverChildSettingsPage /></RoleRoute>}
            />
            <Route
              path={ROUTES.CAREGIVER_CHILD_CAREGIVERS}
              element={<RoleRoute allow={["caregiver"]}><CaregiverChildCaregiversPage /></RoleRoute>}
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
            <Route path="/child/dashboard" element={<Navigate to={ROUTES.CHILD_HOME} replace />} />
            <Route path={ROUTES.CHILD_HOME} element={<RoleRoute allow={["child"]}><ChildSpaceLayout /></RoleRoute>}>
              <Route index element={<ChildHomePage />} />
              <Route path="mood" element={<MoodCheckInPageWrapper />} />
              <Route
                path="calm-tools/*"
                element={<CalmToolsRoutes basePath={ROUTES.CHILD_CALM_TOOLS} homePath={ROUTES.CHILD_HOME} />}
              />
              <Route
                path="games/*"
                element={<GamesRoutes basePath={ROUTES.CHILD_GAMES} homePath={ROUTES.CHILD_HOME} moodPath={ROUTES.CHILD_MOOD} />}
              />
              <Route path="settings" element={<ChildSettingsPage />} />
              <Route path="routines" element={<ChildRoutinesPage />} />
              <Route path="journal" element={<ChildJournalPage />} />
              <Route path="reminders" element={<ChildRemindersPage />} />
              <Route path="companion" element={<ChildCompanionPage />} />
              <Route path="modules/*" element={<ChildModulesPage />} />
              <Route path="talk" element={<ChildTalkPage />} />
            </Route>

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
