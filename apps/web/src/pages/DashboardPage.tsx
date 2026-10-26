import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RoleNotice, useAuth } from "../features/auth";
import { getSupportPreferences } from "@safespace/api-client";
import type { ModuleKey } from "@safespace/shared-types";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import { SessionPlayerModal } from "../components/ui/SessionPlayerModal";
import { TodayCard } from "../features/my-tools";
import { ROUTES } from "../routes";
import { individualToolPath, splitConditionTools } from "../features/conditions";
import { ThemedHome, ToolThemePicker, themeMascot, useAppTheme, type ThemeTile } from "../features/themes";
import { MeadowPage } from "../features/landing/hero/MeadowPage";
import { TryNext } from "../features/recommendations/TryNext";

const SUPPORT_LABELS: Record<ModuleKey, string> = {
  autism: "Autism & Routine Support",
  adhd: "ADHD & Executive Function",
  anxiety: "Anxiety & Calming Support",
  depression: "Depression & Low-Energy Support",
  ptsd: "PTSD & Safety Grounding",
  pcos_pcod: "PCOS / PCOD Wellbeing",
};

// Where each "Try this next" suggestion goes (no Stories for Individuals).
const TRY_NEXT_ROUTES = {
  mood_check_in: ROUTES.MOOD_CHECK_IN,
  calm_space: ROUTES.CALM_SPACE,
  routines: ROUTES.ROUTINES,
  journal: ROUTES.JOURNAL,
  music: ROUTES.MUSIC,
  games: ROUTES.GAMES,
  companion: ROUTES.COMPANION,
};

// Every tool, as tiles on the home tab (the mobile bottom bar only has four tabs).
const TOOL_TILES = [
  { to: ROUTES.MOOD_CHECK_IN, label: "Mood check-in", icon: "🌱" },
  { to: ROUTES.ROUTINES, label: "Routines", icon: "✅" },
  { to: ROUTES.JOURNAL, label: "Journal", icon: "📓" },
  { to: ROUTES.REMINDERS, label: "Reminders", icon: "⏰" },
  { to: ROUTES.CALM_SPACE, label: "Calm Space", icon: "🌊" },
  { to: ROUTES.GAMES, label: "Games Corner", icon: "🎲" },
  { to: ROUTES.MUSIC, label: "Music", icon: "🎵" },
  { to: ROUTES.MODULES, label: "Wellness modules", icon: "🌈" },
  { to: ROUTES.COMPANION, label: "AI Companion", icon: "💬" },
  { to: ROUTES.NUTRITION, label: "NutritionGuide", icon: "🥕" },
];

const SESSIONS_RECOMMENDED = [
  { id: "breathe_reset", title: "Breathe & reset", duration: 5, category: "Breathing", icon: "💨" },
  { id: "evening_wind_down", title: "Evening wind-down", duration: 10, category: "Relaxation", icon: "🌙" },
  { id: "body_reset", title: "Body reset", duration: 7, category: "Mindfulness", icon: "🧘" },
];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, logout, loading } = useAuth();
  const [supportAreas, setSupportAreas] = useState<ModuleKey[]>([]);
  // The meadow look (the landing page's boy and puppy) for everyone; with the
  // ADHD or autism module, their chosen theme.
  const theme = useAppTheme();
  const look = theme.active === "plain" ? "calm" : theme.active;

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
        const sup = await getSupportPreferences(profileId).catch(() => null);
        if (mounted && sup?.supportAreas) setSupportAreas(sup.supportAreas);
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
      <MeadowPage>
        <div className="rounded-full bg-white/90 px-5 py-2.5 text-[#2f5a30] font-semibold text-sm flex items-center gap-2 shadow-[0_8px_20px_rgba(20,60,100,0.18)]">
          <svg className="animate-spin h-5 w-5 text-olive-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading your safe space...</span>
        </div>
      </MeadowPage>
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

  const conditionTools = splitConditionTools(supportAreas);
  const tiles: ThemeTile[] = [
    // Tools for their support areas first, the rest under More tools (role-flow 8c).
    ...conditionTools.mine.map((t) => ({ to: individualToolPath(t.key), label: t.label, emoji: t.emoji })),
    ...TOOL_TILES.map((t) => ({ to: t.to, label: t.label, emoji: t.icon })),
    // Always a way to the tools page; named for what it adds.
    {
      to: ROUTES.TOOLS,
      label: conditionTools.more.length === 0 ? "All my tools" : conditionTools.mine.length ? "More tools" : "Focus & feelings",
      emoji: "🧰",
    },
  ];

  const homeView = (
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

      <TodayCard session={session} routinesPath={ROUTES.ROUTINES} remindersPath={ROUTES.REMINDERS} />


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
          <img src={themeMascot(look)} alt="" aria-hidden="true" className="h-[110px] w-[110px] shrink-0 rounded-3xl object-cover" />
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
          <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.CALM_SPACE)}>
            Open Calm Space
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/modules")}>
            Open modules
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
  );

  const player = (
    <SessionPlayerModal
      isOpen={activeSession.isOpen}
      onClose={closePlayer}
      title={activeSession.title}
      durationMinutes={activeSession.duration}
      category={activeSession.category}
    />
  );

  // The dashboard: the greeting, the day on a light panel, and every page as
  // a tile (Profile included). Low-sensory mode keeps it still.
  return (
    <>
      <ThemedHome
        theme={look}
        stillOnly={theme.lowSensory}
        eyebrow="Your space"
        greeting={`Hi, ${displayName}`}
        line="Welcome back. Take your time, breathe, and explore."
        onSignOut={logout}
        status="Glad you're here. One small step at a time."
        picker={theme.canChoose ? <ToolThemePicker look="bold" value={theme.chosen} onChange={theme.choose} /> : undefined}
        tiles={[...tiles, { to: ROUTES.PROFILE, label: "Profile", emoji: "👤" }]}
        tilesLabel="Your tools"
      >
        <RoleNotice />
        {session && <TryNext session={session} routes={TRY_NEXT_ROUTES} />}
        {homeView}
      </ThemedHome>
      {player}
    </>
  );
};

export default DashboardPage;
