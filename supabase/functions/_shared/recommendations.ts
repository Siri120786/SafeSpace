// supabase/functions/_shared/recommendations.ts
// Rule-based "try this next" suggestions for an Individual's or a child's
// home. Pure: no Deno APIs, no AI, no network. Inputs are the wellness
// summary (counts only), the person's modules and their local hour.
//
// Every reason is gentle and non-diagnostic: it can mention what the person
// told us ("you said you felt stressed") or what is waiting (routine steps),
// never a score, a label or a guess about their mental state. It suggests
// tools only; it never decides anything about safety (that stays with the
// crisis screens and "I need help" alerts).

export const RECOMMENDATION_KEYS = [
  "mood_check_in",
  "calm_space",
  "routines",
  "journal",
  "music",
  "games",
  "companion",
  "stories",
] as const;

export type RecommendationKey = (typeof RECOMMENDATION_KEYS)[number];

export interface Recommendation {
  key: RecommendationKey;
  reason: string;
}

export type Audience = "individual" | "child";

// The parts of a WellnessSummary the rules read.
export interface SummaryCounts {
  mood: {
    daysWithCheckin: number;
    latest: { mood: string; createdAt: string } | null;
  };
  routines: { scheduledSteps: number; completedSteps: number };
  journal: { entries: number };
}

export interface RecommendationInput {
  audience: Audience;
  modules: string[];
  summary: SummaryCounts;
  localHour: number;   // 0-23 on the person's device
  now: Date;
}

export const MAX_RECOMMENDATIONS = 3;
// A check-in older than this counts as "not today" for the nudge.
const STALE_CHECKIN_MS = 18 * 60 * 60 * 1000;

type Copy = Record<Audience, string>;
const copy = (individual: string, child: string): Copy => ({ individual, child });

const REASONS = {
  firstCheckin: copy("A quick mood check-in helps you notice how your week is going.", "How are you feeling? Tap to tell us."),
  checkinToday: copy("You haven't checked in today. It only takes a moment.", "You haven't said how you feel today."),
  calmAfterStress: copy("You said you felt stressed. A slow breath in Calm Space can help.", "Feeling a bit much? Calm Space has slow breathing."),
  calmAfterOverwhelmed: copy("You said things felt like a lot. Calm Space can help you slow down.", "Feeling a bit much? Calm Space has slow breathing."),
  musicAfterSad: copy("You said you felt low. A gentle playlist might be nice right now.", "Some gentle music might feel nice."),
  companionAfterSad: copy("Want to talk it through? The AI Companion is here to listen.", "Want to chat? The AI Companion is here."),
  routinesWaiting: copy("A few routine steps are waiting. One small step counts.", "Some routine steps are waiting for you."),
  routinesStart: copy("A simple routine can make the day feel more predictable.", "A routine can help you know what comes next."),
  journalStart: copy("Write a line or two about your day.", "Want to draw or write about your day?"),
  eveningMusic: copy("Wind down with something calm before bed.", "Calm music for bedtime."),
  music: copy("Put on something calm for a few minutes.", "Listen to some calm music."),
  dayGame: copy("A short game is a nice little break.", "Time for a quick game?"),
  stories: copy("Settle in with a story.", "Read a story with a friend."),
  calmModule: copy("Calm Space is there whenever you need a pause.", "Calm Space is there whenever you need it."),
} satisfies Record<string, Copy>;

function isEvening(hour: number): boolean {
  return hour >= 20 || hour < 5;
}

/** Up to MAX_RECOMMENDATIONS suggestions, most relevant first, no repeats. */
export function recommend(input: RecommendationInput): Recommendation[] {
  const { audience, modules, summary, localHour, now } = input;
  const out: Recommendation[] = [];
  const add = (key: RecommendationKey, reason: Copy) => {
    if (out.length < MAX_RECOMMENDATIONS && !out.some((r) => r.key === key)) {
      out.push({ key, reason: reason[audience] });
    }
  };

  // 1. What they told us most recently.
  const latest = summary.mood.latest;
  const latestAge = latest ? now.getTime() - Date.parse(latest.createdAt) : Infinity;
  const recent = latest && latestAge >= 0 && latestAge < STALE_CHECKIN_MS;
  if (recent && latest.mood === "stressed") add("calm_space", REASONS.calmAfterStress);
  if (recent && latest.mood === "overwhelmed") add("calm_space", REASONS.calmAfterOverwhelmed);
  if (recent && latest.mood === "sad") {
    add("music", REASONS.musicAfterSad);
    add("companion", REASONS.companionAfterSad);
  }

  // 2. A check-in nudge when there's none today.
  if (summary.mood.daysWithCheckin === 0) add("mood_check_in", REASONS.firstCheckin);
  else if (!recent) add("mood_check_in", REASONS.checkinToday);

  // 3. Routine steps waiting, or a first routine for structure-seeking modules.
  const { scheduledSteps, completedSteps } = summary.routines;
  if (scheduledSteps > 0 && completedSteps < scheduledSteps / 2) add("routines", REASONS.routinesWaiting);
  else if (scheduledSteps === 0 && (modules.includes("adhd") || modules.includes("autism"))) {
    add("routines", REASONS.routinesStart);
  }

  // 4. Modules that lean on calm.
  if (modules.includes("anxiety") || modules.includes("ptsd")) add("calm_space", REASONS.calmModule);

  // 5. Time of day, then gentle defaults.
  if (isEvening(localHour)) add(audience === "child" ? "stories" : "music", audience === "child" ? REASONS.stories : REASONS.eveningMusic);
  if (summary.journal.entries === 0) add("journal", REASONS.journalStart);
  add("games", REASONS.dayGame);
  add(audience === "child" ? "stories" : "music", audience === "child" ? REASONS.stories : REASONS.music);
  return out;
}
