// supabase/functions/focus-tools/index.ts
// The ADHD and autism tools for a signed-in child: wiring only. Request logic
// lives in ./handler.ts. Uses the service role, scoped to the child_id derived
// from the verified child-session token.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { childSessionVerifier, sessionVersionLookup } from "../_shared/childSession.ts";
import { createFocusToolsHandler, type FocusToolsStore } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Signature, expiry AND session version (a PIN reset ends sessions).
const verifyChildToken = childSessionVerifier(sessionVersionLookup(admin));

const log = (event: string, detail?: string) =>
  console.error(`focus-tools: ${event}${detail ? ` (${detail})` : ""}`);

const SESSION_COLS = "id, ended_at, duration_seconds, mode, phase, completed, activity_label";
const TASK_COLS = "id, title, steps, is_archived, created_at, updated_at";
const HABIT_COLS = "id, title, icon, is_archived, created_at";

// Throws on any database error; the handler turns known ones into 400/409.
const must = <T,>({ data, error }: { data: T; error: unknown }): T => {
  if (error) throw error;
  return data;
};

const store: FocusToolsStore = {
  async listSessions(childId, sinceIso) {
    return must(await admin.from("focus_sessions").select(SESSION_COLS)
      .eq("child_id", childId).gte("ended_at", sinceIso).order("ended_at", { ascending: false }).limit(500)) ?? [];
  },
  async addSession(childId, row) {
    return must(await admin.from("focus_sessions").insert({ child_id: childId, ...row }).select(SESSION_COLS).single());
  },

  async listTasks(childId) {
    return must(await admin.from("focus_tasks").select(TASK_COLS).eq("child_id", childId).order("created_at", { ascending: false })) ?? [];
  },
  async createTask(childId, title, steps) {
    return must(await admin.from("focus_tasks").insert({ child_id: childId, title, steps }).select(TASK_COLS).single());
  },
  async updateTask(childId, taskId, fields) {
    return must(await admin.from("focus_tasks").update(fields).eq("id", taskId).eq("child_id", childId).select(TASK_COLS).maybeSingle());
  },
  async deleteTask(childId, taskId) {
    const rows = must(await admin.from("focus_tasks").delete().eq("id", taskId).eq("child_id", childId).select("id"));
    return (rows ?? []).length > 0;
  },

  async listHabits(childId) {
    return must(await admin.from("habits").select(HABIT_COLS).eq("child_id", childId).order("created_at", { ascending: true })) ?? [];
  },
  async listChecks(childId, sinceDay) {
    const rows = must(await admin.from("habit_checks").select("habit_id, day, habits!inner(child_id)")
      .eq("habits.child_id", childId).gte("day", sinceDay)) ?? [];
    return (rows as { habit_id: string; day: string }[]).map((r) => ({ habit_id: r.habit_id, day: r.day }));
  },
  async addHabit(childId, title, icon) {
    return must(await admin.from("habits").insert({ child_id: childId, title, icon }).select(HABIT_COLS).single());
  },
  async archiveHabit(childId, habitId) {
    const rows = must(await admin.from("habits").update({ is_archived: true }).eq("id", habitId).eq("child_id", childId).select("id"));
    return (rows ?? []).length > 0;
  },
  async childOwnsHabit(childId, habitId) {
    return !!must(await admin.from("habits").select("id").eq("id", habitId).eq("child_id", childId).maybeSingle());
  },
  async setCheck(habitId, day, checked) {
    if (checked) {
      must(await admin.from("habit_checks").upsert({ habit_id: habitId, day }, { onConflict: "habit_id,day", ignoreDuplicates: true }));
    } else {
      must(await admin.from("habit_checks").delete().eq("habit_id", habitId).eq("day", day));
    }
  },

  async listStars(childId) {
    return must(await admin.from("star_events").select("kind, stars").eq("child_id", childId)) ?? [];
  },
  async getGoal(childId) {
    return must(await admin.from("star_goals").select("title, target_stars, icon").eq("child_id", childId).maybeSingle());
  },
  async awardStars(childId, eventKey, stars) {
    const rows = must(await admin.from("star_events")
      .upsert({ child_id: childId, event_key: eventKey, kind: "award", stars }, { onConflict: "child_id,event_key", ignoreDuplicates: true })
      .select("id"));
    return (rows ?? []).length > 0;
  },
  async claimGoal(childId) {
    return must(await admin.rpc("claim_child_star_goal", { p_child_id: childId })) as { claimed: boolean; currentStars: number };
  },

  async listEmotions(childId, limit) {
    return must(await admin.from("emotion_choices").select("id, card_id, created_at")
      .eq("child_id", childId).order("created_at", { ascending: false }).limit(limit)) ?? [];
  },
  async addEmotion(childId, cardId) {
    return must(await admin.from("emotion_choices").insert({ child_id: childId, card_id: cardId }).select("id, card_id, created_at").single());
  },

  async getSettings(childId) {
    return must(await admin.from("tool_settings")
      .select("transition_preset, aac_labels, music_enabled, music_volume_max, music_sleep_minutes").eq("child_id", childId).maybeSingle());
  },

  async listFavorites(childId) {
    const rows = must(await admin.from("music_favorites").select("track_id")
      .eq("child_id", childId).order("created_at", { ascending: false })) ?? [];
    return (rows as { track_id: string }[]).map((r) => r.track_id);
  },
  async addFavorite(childId, trackId) {
    must(await admin.from("music_favorites")
      .upsert({ child_id: childId, track_id: trackId }, { onConflict: "child_id,track_id", ignoreDuplicates: true }));
  },
  async removeFavorite(childId, trackId) {
    must(await admin.from("music_favorites").delete().eq("child_id", childId).eq("track_id", trackId));
  },

  async getCalmPlan(childId) {
    const row = must(await admin.from("calm_plans").select("plan").eq("child_id", childId).maybeSingle());
    return (row as { plan: unknown } | null)?.plan ?? null;
  },
  async saveCalmPlan(childId, plan) {
    must(await admin.from("calm_plans").upsert({ child_id: childId, plan }, { onConflict: "child_id" }));
  },
};

serve(createFocusToolsHandler({ store, verifyChildToken, log }));
