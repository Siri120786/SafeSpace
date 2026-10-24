// supabase/functions/stories/index.ts
// Caregiver-made stories Edge Function: wiring only. Request logic lives in
// ./handler.ts. The service role writes stories and story_children (clients
// have read-only RLS access); adults are identified by their JWT, children by
// the signed child-session token.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { childSessionVerifier, sessionVersionLookup } from "../_shared/childSession.ts";
import { createStoriesHandler, type StoriesStore, type StoryRow } from "./handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Signature, expiry AND session version (a PIN reset ends sessions).
const verifyChildToken = childSessionVerifier(sessionVersionLookup(admin));

const COLUMNS = "id, author_id, title, script, source, template_key, telugu_checked, created_at, updated_at";

const log = (event: string, detail?: string) =>
  console.error(`stories: ${event}${detail ? ` (${detail})` : ""}`);

async function authenticateAdult(authorization: string): Promise<string | null> {
  const asCaller = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await asCaller.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

const store: StoriesStore = {
  async listForAdult(userId) {
    const { data: links, error: linkError } = await admin.from("child_caregivers").select("child_id").eq("caregiver_id", userId);
    if (linkError) throw linkError;
    const childIds = (links ?? []).map((l: { child_id: string }) => l.child_id);
    let shared: string[] = [];
    if (childIds.length) {
      const { data, error } = await admin.from("story_children").select("story_id").in("child_id", childIds);
      if (error) throw error;
      shared = [...new Set((data ?? []).map((r: { story_id: string }) => r.story_id))];
    }
    let query = admin.from("stories").select(COLUMNS);
    query = shared.length ? query.or(`author_id.eq.${userId},id.in.(${shared.join(",")})`) : query.eq("author_id", userId);
    const { data, error } = await query.order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as StoryRow[];
  },

  async getStory(storyId) {
    const { data, error } = await admin.from("stories").select(COLUMNS).eq("id", storyId).maybeSingle();
    if (error) throw error;
    return (data as StoryRow) ?? null;
  },

  async childrenOf(storyId) {
    const { data, error } = await admin.from("story_children").select("child_id").eq("story_id", storyId);
    if (error) throw error;
    return (data ?? []).map((r: { child_id: string }) => r.child_id);
  },

  async countByAuthor(authorId) {
    const { count, error } = await admin.from("stories").select("id", { count: "exact", head: true }).eq("author_id", authorId);
    if (error) throw error;
    return count ?? 0;
  },

  async insertStory(authorId, fields) {
    const { data, error } = await admin.from("stories").insert({ author_id: authorId, ...fields }).select("id").single();
    if (error || !data) throw error ?? new Error("story_insert_failed");
    return data.id as string;
  },

  async updateStory(storyId, fields) {
    const { error } = await admin.from("stories").update(fields).eq("id", storyId);
    if (error) throw error;
  },

  // Remove first, then add: if the second step fails, the story is published
  // to fewer children, never to the wrong ones.
  async setChildren(storyId, childIds) {
    const { error } = await admin.from("story_children").delete().eq("story_id", storyId);
    if (error) throw error;
    if (childIds.length) {
      const { error: insertError } = await admin.from("story_children")
        .insert(childIds.map((child_id) => ({ story_id: storyId, child_id })));
      if (insertError) throw insertError;
    }
  },

  async deleteStory(storyId) {
    const { error } = await admin.from("stories").delete().eq("id", storyId);
    if (error) throw error;
  },

  async isCaregiverOf(userId, childId) {
    const { data, error } = await admin.rpc("caregiver_role_for_child", { p_child_id: childId, p_caregiver_id: userId });
    if (error) throw error;
    return data !== null;
  },

  async listForChild(childId, limit) {
    const { data: links, error: linkError } = await admin.from("story_children").select("story_id")
      .eq("child_id", childId).order("published_at", { ascending: false }).limit(limit);
    if (linkError) throw linkError;
    const ids = (links ?? []).map((l: { story_id: string }) => l.story_id);
    if (!ids.length) return [];
    const { data, error } = await admin.from("stories").select(COLUMNS).in("id", ids);
    if (error) throw error;
    const byId = new Map((data ?? []).map((r: StoryRow) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is StoryRow => !!r);
  },
};

serve(createStoriesHandler({ store, authenticateAdult, verifyChildToken, log }));
