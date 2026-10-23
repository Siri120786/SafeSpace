import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RoleNotice, useAuth } from "../features/auth";
import { getSupportPreferences, getAccessibilityPreferences } from "@safespace/api-client";
import type { ModuleKey, ProfileAccessibilityPreferences } from "@safespace/shared-types";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import { BottomNav, type NavTab } from "../components/ui/BottomNav";
import { BrainMascot } from "../components/vectors/BrainMascot";
import { LeafCluster } from "../components/vectors/LeafFrame";
import { SessionPlayerModal } from "../components/ui/SessionPlayerModal";
import { ChatWindow } from "../features/ai-companion";
import { ROUTES } from "../routes";

const SUPPORT_LABELS: Record<ModuleKey, string> = {
  autism: "Autism & Routine Support",
  adhd: "ADHD & Executive Function",
  anxiety: "Anxiety & Calming Support",
  depression: "Depression & Low-Energy Support",
  ptsd: "PTSD & Safety Grounding",
  pcos_pcod: "PCOS / PCOD Wellbeing",
};

const SESSIONS_RECOMMENDED = [
  { id: "breathe_reset", title: "Breathe & reset", duration: 5, category: "Breathing", icon: "💨" },
  { id: "evening_wind_down", title: "Evening wind-down", duration: 10, category: "Relaxation", icon: "🌙" },
  { id: "body_reset", title: "Body reset", duration: 7, category: "Mindfulness", icon: "🧘" },
];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, logout, loading } = useAuth();
  const [supportAreas, setSupportAreas] = useState<ModuleKey[]>([]);
  const [accessibility, setAccessibility] = useState<ProfileAccessibilityPreferences | null>(null);

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<NavTab>("home");

  // Guided Breathing Session Player State
  const [activeSession, setActiveSession] = useState<{
    isOpen: boolean;
    title: string;
    duration: number;
    category: string;
  }>({
    isOpen: false,
    title: "Deep Calm",
    duration: 5,
    category: "Breathing",
  });

  const profileId = session?.kind === "auth_user" ? session.profile.id : null;
  const displayName = session?.kind === "auth_user" ? session.profile.displayName || "friend" : "friend";

  useEffect(() => {
    if (!profileId) return;
    let mounted = true;
    async function loadData() {
      if (!profileId) return;
      try {
        const [sup, acc] = await Promise.all([
          getSupportPreferences(profileId).catch(() => null),
          getAccessibilityPreferences(profileId).catch(() => null),
        ]);
        if (mounted) {
          if (sup?.supportAreas) setSupportAreas(sup.supportAreas);
          if (acc) setAccessibility(acc);
        }
      } catch {
        // Handled gracefully
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [profileId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] font-sans">
        <div className="text-deepGreen font-medium text-sm flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-olive-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading your safe space...</span>
        </div>
      </div>
    );
  }

  // RoleRoute only lets Individuals in.
  if (!session || session.kind !== "auth_user") return null;

  const openPlayer = (title: string, duration: number, category: string) => {
    setActiveSession({
      isOpen: true,
      title,
      duration,
      category,
    });
  };

  const closePlayer = () => {
    setActiveSession((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-[#FAF7F2] to-paleLime/30 text-textHeading font-sans pb-24 relative overflow-x-hidden">
      {/* Decorative Corner Framing */}
      <LeafCluster position="bottom-left" size={180} className="fixed bottom-0 left-0 opacity-40 pointer-events-none" />
      <LeafCluster position="top-right" size={180} className="fixed top-0 right-0 opacity-40 pointer-events-none" />

      {/* WEB DESKTOP SIDEBAR + MAIN CONTENT LAYOUT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Web Desktop Left Navigation Sidebar */}
          <aside className="hidden lg:block lg:col-span-3 space-y-6 sticky top-6">
            <Card className="p-6 space-y-6 border border-white">
              {/* User Profile Card Header */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-olive-500 to-deepGreen text-white font-display font-medium text-lg flex items-center justify-center shadow-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-display text-base font-medium text-textHeading">{displayName}</h2>
                  <span className="text-xs text-textMuted">Individual account</span>
                </div>
              </div>

              {/* Desktop Nav Items */}
              <nav className="space-y-1 text-sm font-medium">
                {[
                  { id: "home", label: "Home", icon: "🏠" },
                  { id: "companion", label: "AI Companion", icon: "💬" },
                  { id: "sessions", label: "Guided Breathing", icon: "🎧" },
                  { id: "mood", label: "Mood Check-in", icon: "🌱", route: ROUTES.MOOD_CHECK_IN },
                  { id: "calm", label: "Calm Tools", icon: "🍃", route: "/calm-tools" },
                  { id: "profile", label: "Profile Settings", icon: "👤", route: "/profile" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.route) {
                        navigate(item.route);
                      } else {
                        setActiveTab(item.id as NavTab);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                      activeTab === item.id
                        ? "bg-darkBtn text-white shadow-pill font-semibold"
                        : "text-textBody hover:bg-olive-50 hover:text-deepGreen"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>

              {/* Sign Out Button */}
              <div className="pt-4 border-t border-olive-100">
                <button
                  onClick={logout}
                  className="w-full text-left text-xs font-medium text-red-500 hover:text-red-700 flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Sign Out</span>
                </button>
              </div>
            </Card>
          </aside>

          {/* MAIN DASHBOARD CONTENT AREA */}
          <main className="lg:col-span-9 space-y-8">
            <RoleNotice />
            
            {/* Top Bar for Mobile Greeting */}
            <div className="flex items-center justify-between lg:hidden pt-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-olive-500 text-white font-display font-medium flex items-center justify-center text-sm shadow-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="font-display text-xl font-medium text-textHeading">Hi, {displayName} 👋</h1>
                  <p className="text-xs text-textMuted font-light">Welcome to your SafeSpace</p>
                </div>
              </div>
              <button onClick={logout} className="text-xs font-medium text-red-500 underline">
                Sign Out
              </button>
            </div>

            {/* Desktop Main Header */}
            <div className="hidden lg:block bg-white/70 p-6 rounded-3xl border border-white shadow-card backdrop-blur-sm">
              <h1 className="font-display text-3xl font-medium text-textHeading">Hi, {displayName} 👋</h1>
              <p className="text-sm text-textMuted font-light mt-1">
                Welcome back to your safe space. Take your time, breathe, and explore.
              </p>
            </div>

            {/* TAB: HOME VIEW */}
            {activeTab === "home" && (
              <>
                {/* Active Support Preferences Summary */}
                <Card className="p-6 md:p-8 space-y-4 border border-white">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
                      Your Selected Support Areas
                    </span>
                    <p className="text-xs text-textMuted font-light mt-2">
                      Personalized focus areas configured during onboarding.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {supportAreas.length > 0 ? (
                      supportAreas.map((area) => (
                        <Chip
                          key={area}
                          label={SUPPORT_LABELS[area] || area}
                          variant="olive"
                          size="md"
                        />
                      ))
                    ) : (
                      <p className="text-xs text-textMuted italic">No support areas selected yet.</p>
                    )}
                  </div>
                </Card>

                {/* Daily Mood Check-In Entry Card */}
                <Card className="p-5 border border-olive-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-olive-50 text-deepGreen flex items-center justify-center text-xl shrink-0">
                      🌱
                    </div>
                    <div>
                      <h4 className="font-display text-base font-medium text-textHeading">Daily Mood Check-in</h4>
                      <p className="text-xs text-textMuted font-light">How are you feeling right now?</p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(ROUTES.MOOD_CHECK_IN)}
                  >
                    Check in
                  </Button>
                </Card>

                {/* Insight Card: Meditating Mascot */}
                <Card className="p-6 md:p-8 bg-gradient-to-r from-olive-50/80 via-white to-paleLime/40 border border-olive-200/60 shadow-card flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <BrainMascot stance="meditating" size={110} />
                    <div className="space-y-1 text-left">
                      <span className="text-xs font-bold uppercase tracking-wider text-deepGreen bg-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                        Guided Breathing
                      </span>
                      <h3 className="font-display text-xl font-medium text-textHeading">
                        "Rest is productive too."
                      </h3>
                      <p className="text-xs text-textMuted font-light">
                        Taking 5 minutes to reset clears mental clutter and restores calm.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => openPlayer("Deep Calm", 5, "Breathing")}
                    className="shrink-0"
                  >
                    Start a quick session
                  </Button>
                </Card>

                {/* Guided Reset Exercises */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-medium text-textHeading">
                      Guided Calming Resets
                    </h3>
                    <span className="text-xs text-textMuted font-light">3 exercises</span>
                    <Button variant="outline" size="sm" onClick={() => navigate("/calm-tools")}>
                      Open calm tools
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {SESSIONS_RECOMMENDED.map((sess) => (
                      <Card
                        key={sess.id}
                        hoverable
                        onClick={() => openPlayer(sess.title, sess.duration, sess.category)}
                        className="p-5 flex flex-col justify-between border border-olive-100/80 hover:border-olive-300 gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-olive-50 text-deepGreen flex items-center justify-center text-lg shrink-0">
                            {sess.icon}
                          </div>
                          <div>
                            <h4 className="font-display text-base font-medium text-textHeading">
                              {sess.title}
                            </h4>
                            <p className="text-xs text-textMuted font-light">
                              {sess.duration} min • {sess.category}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <div className="w-8 h-8 rounded-full bg-darkBtn text-white flex items-center justify-center text-xs shadow-pill">
                            ▶
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* TAB: SESSIONS VIEW */}
            {activeTab === "sessions" && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-2xl font-medium text-textHeading">Guided Resets & Breathing</h3>
                  <Chip label="Self-Paced" variant="olive" size="sm" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SESSIONS_RECOMMENDED.map((sess) => (
                    <Card
                      key={sess.id}
                      hoverable
                      onClick={() => openPlayer(sess.title, sess.duration, sess.category)}
                      className="p-6 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-deepGreen-50 text-deepGreen text-2xl flex items-center justify-center">
                          {sess.icon}
                        </div>
                        <div>
                          <h4 className="font-display text-lg font-medium text-textHeading">{sess.title}</h4>
                          <p className="text-xs text-textMuted">{sess.duration} minutes • {sess.category}</p>
                        </div>
                      </div>
                      <Button variant="primary" size="sm">Start</Button>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* TAB: COMPANION VIEW */}
            {activeTab === "companion" && (
              <section className="space-y-6">
                <ChatWindow session={session} />
              </section>
            )}

            {/* TAB: PROFILE VIEW */}
            {activeTab === "profile" && (
              <section className="space-y-6">
                <h3 className="font-display text-2xl font-medium text-textHeading">Profile & Accessibility Settings</h3>
                <Card className="p-6 space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-textHeading">Account Details</h4>
                    <p className="text-xs text-textMuted mt-1">Display Name: <span className="font-medium text-textHeading">{displayName}</span></p>
                    <p className="text-xs text-textMuted mt-0.5">Account Role: <span className="font-medium text-textHeading">Individual</span></p>
                  </div>

                  <div className="pt-4 border-t border-olive-100">
                    <h4 className="text-sm font-semibold text-textHeading">Configured Support Preferences</h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {supportAreas.length > 0 ? (
                        supportAreas.map((area) => (
                          <Chip key={area} label={SUPPORT_LABELS[area] || area} variant="olive" size="sm" />
                        ))
                      ) : (
                        <p className="text-xs text-textMuted">No specific support preferences configured.</p>
                      )}
                    </div>
                  </div>

                  {accessibility && (
                    <div className="pt-4 border-t border-olive-100">
                      <h4 className="text-sm font-semibold text-textHeading">Accessibility Settings</h4>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-textBody">
                        <div className={`p-2.5 rounded-xl border ${accessibility.reducedSensoryStimulation ? "bg-olive-50 border-olive-300" : "bg-gray-50"}`}>
                          Reduced Sensory: {accessibility.reducedSensoryStimulation ? "Enabled ✓" : "Off"}
                        </div>
                        <div className={`p-2.5 rounded-xl border ${accessibility.largerText ? "bg-olive-50 border-olive-300" : "bg-gray-50"}`}>
                          Larger Text: {accessibility.largerText ? "Enabled ✓" : "Off"}
                        </div>
                        <div className={`p-2.5 rounded-xl border ${accessibility.readAloud ? "bg-olive-50 border-olive-300" : "bg-gray-50"}`}>
                          Read Aloud: {accessibility.readAloud ? "Enabled ✓" : "Off"}
                        </div>
                        <div className={`p-2.5 rounded-xl border ${accessibility.simplifiedPresentation ? "bg-olive-50 border-olive-300" : "bg-gray-50"}`}>
                          Simplified Layout: {accessibility.simplifiedPresentation ? "Enabled ✓" : "Off"}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-olive-100">
                    <Button variant="ghost" size="md" onClick={logout} className="text-red-500">
                      Sign Out of SafeSpace
                    </Button>
                  </div>
                </Card>
              </section>
            )}

          </main>
        </div>
      </div>

      {/* Floating Pill Bottom Navigation (Mobile Only) */}
      <div className="lg:hidden">
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Guided Breathing Session Player Modal */}
      <SessionPlayerModal
        isOpen={activeSession.isOpen}
        onClose={closePlayer}
        title={activeSession.title}
        durationMinutes={activeSession.duration}
        category={activeSession.category}
      />
    </div>
  );
};

export default DashboardPage;
