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
import { useTranslation } from "react-i18next";

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

// Every tool, as tiles on the home tab. Labels are tiles.<key> in the locale files.
const TOOL_TILES = [
  { to: ROUTES.MOOD_CHECK_IN, key: "moodCheckIn", icon: "🌱" },
  { to: ROUTES.ROUTINES, key: "routines", icon: "✅" },
  { to: ROUTES.JOURNAL, key: "journal", icon: "📓" },
  { to: ROUTES.REMINDERS, key: "reminders", icon: "⏰" },
  { to: ROUTES.CALM_SPACE, key: "calmSpace", icon: "🌊" },
  { to: ROUTES.GAMES, key: "gamesCorner", icon: "🎲" },
  { to: ROUTES.MUSIC, key: "music", icon: "🎵" },
  { to: ROUTES.MODULES, key: "modules", icon: "🌈" },
  { to: ROUTES.COMPANION, key: "companion", icon: "💬" },
  { to: ROUTES.NUTRITION, key: "nutrition", icon: "🥕" },
];

// Titles and categories are home.individual.sessions.<id> / home.individual.categories.<category>.
const SESSIONS_RECOMMENDED = [
  { id: "breatheReset", duration: 5, category: "breathing", icon: "💨" },
  { id: "eveningWindDown", duration: 10, category: "relaxation", icon: "🌙" },
  { id: "bodyReset", duration: 7, category: "mindfulness", icon: "🧘" },
];

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
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
  const displayName = (session?.kind === "auth_user" && session.profile.displayName) || t("onboarding.user.friend");

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
          <span>{t("home.loading")}</span>
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
    ...conditionTools.mine.map((tool) => ({ to: individualToolPath(tool.key), label: t(`tiles.tool.${tool.key}`, { defaultValue: tool.label }), emoji: tool.emoji })),
    ...TOOL_TILES.map((tile) => ({ to: tile.to, label: t(`tiles.${tile.key}`), emoji: tile.icon })),
    // Always a way to the tools page; named for what it adds.
    {
      to: ROUTES.TOOLS,
      label: t(conditionTools.more.length === 0 ? "tiles.allMyTools" : conditionTools.mine.length ? "tiles.moreTools" : "tiles.focusFeelings"),
      emoji: "🧰",
    },
  ];

  const homeView = (
    <>
      {/* Active Support Preferences Summary */}
      <Card className="p-6 md:p-8 space-y-4 border border-white">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-deepGreen bg-deepGreen-50 px-3 py-1 rounded-full">
            {t("home.individual.areasTitle")}
          </span>
          <p className="text-xs text-textMuted font-light mt-2">
            {t("home.individual.areasText")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 pt-1">
          {supportAreas.length > 0 ? (
            supportAreas.map((area) => (
              <Chip
                key={area}
                label={t(`onboarding.areas.${area}.label`, { defaultValue: area })}
                variant="olive"
                size="md"
              />
            ))
          ) : (
            <p className="text-xs text-textMuted italic">{t("home.individual.noAreas")}</p>
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
            <h4 className="font-display text-base font-medium text-textHeading">{t("home.individual.moodTitle")}</h4>
            <p className="text-xs text-textMuted font-light">{t("home.individual.moodText")}</p>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate(ROUTES.MOOD_CHECK_IN)}
        >
          {t("home.individual.checkIn")}
        </Button>
      </Card>

      {/* Insight Card: Meditating Mascot */}
      <Card className="p-6 md:p-8 bg-gradient-to-r from-olive-50/80 via-white to-paleLime/40 border border-olive-200/60 shadow-card flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <img src={themeMascot(look)} alt="" aria-hidden="true" className="h-[110px] w-[110px] shrink-0 rounded-3xl object-cover" />
          <div className="space-y-1 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-deepGreen bg-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
              {t("home.individual.breathingTag")}
            </span>
            <h3 className="font-display text-xl font-medium text-textHeading">
              {t("home.individual.restQuote")}
            </h3>
            <p className="text-xs text-textMuted font-light">
              {t("home.individual.restText")}
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => openPlayer(t("home.individual.deepCalm"), 5, t("home.individual.categories.breathing"))}
          className="shrink-0"
        >
          {t("home.individual.startSession")}
        </Button>
      </Card>

      {/* Guided Reset Exercises */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-medium text-textHeading">
            {t("home.individual.resetsTitle")}
          </h3>
          <span className="text-xs text-textMuted font-light">{t("home.individual.exercises", { count: SESSIONS_RECOMMENDED.length })}</span>
          <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.CALM_SPACE)}>
            {t("home.individual.openCalm")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/modules")}>
            {t("home.individual.openModules")}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SESSIONS_RECOMMENDED.map((s) => ({ ...s, title: t(`home.individual.sessions.${s.id}`), category: t(`home.individual.categories.${s.category}`) })).map((sess) => (
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
                    {t("home.individual.minutes", { count: sess.duration })} • {sess.category}
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
        eyebrow={t("home.individual.eyebrow")}
        greeting={t("home.greeting", { name: displayName })}
        line={t("home.individual.line")}
        onSignOut={logout}
        status={t("home.individual.status")}
        picker={theme.canChoose ? <ToolThemePicker look="bold" value={theme.chosen} onChange={theme.choose} /> : undefined}
        tiles={[...tiles, { to: ROUTES.PROFILE, label: t("tiles.profile"), emoji: "👤" }]}
        tilesLabel={t("home.individual.tilesLabel")}
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
