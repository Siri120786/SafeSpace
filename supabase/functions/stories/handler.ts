// supabase/functions/stories/handler.ts
// Caregiver-made animated stories (role-flow 6b). The only writer of the
// stories and story_children tables: every script is checked (format and the
// crisis screen, _shared/stories.ts) before it's stored.
//
// Adults (Supabase JWT in the Authorization header):
//   list      {}                                  own stories + ones published to my children
//   get       { story_id }                        author or a caregiver of a child it's published to
//   save      { story_id?, script, source, template_key?, telugu_checked? }   author only
//   publish   { story_id, child_ids }             author only, and only to children they care for;
//                                                 [] takes it back from every child
//   delete    { story_id }                        author only
// Children (signed child-session token in the body):
//   child_list { child_session_token }            stories published to that child
//
// No Deno or esm.sh imports; index.ts wires the real dependencies and
// supabase/tests/stories_handler.test.mts wires fakes.

import { json, preflight } from "../_shared/http.ts";
import { errorSummary } from "../_shared/errors.ts";
import { CHILD_LIST_LIMIT, MAX_STORIES_PER_AUTHOR, parseStoriesRequest, type StorySource } from "../_shared/stories.ts";
import type { Story } from "../_shared/storyScript.ts";

export interface StoryRow {
  id: string;
  author_id: string;
  title: string;
  script: Story;
  source: StorySource;
  template_key: string | null;
  telugu_checked: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoryFields {
  title: string;
  script: Story;
  source: StorySource;
  template_key: string | null;
  telugu_checked: boolean;
}

export interface StoriesStore {
  // The author's stories plus any published to children the user cares for.
  listForAdult(userId: string): Promise<StoryRow[]>;
  getStory(storyId: string): Promise<StoryRow | null>;
  childrenOf(storyId: string): Promise<string[]>;
  countByAuthor(authorId: string): Promise<number>;
  insertStory(authorId: string, fields: StoryFields): Promise<string>;
  updateStory(storyId: string, fields: StoryFields): Promise<void>;
  // Replaces the set of children the story is published to.
  setChildren(storyId: string, childIds: string[]): Promise<void>;
  deleteStory(storyId: string): Promise<void>;
  isCaregiverOf(userId: string, childId: string): Promise<boolean>;
  listForChild(childId: string, limit: number): Promise<StoryRow[]>;
}

export interface StoriesDeps {
  store: StoriesStore;
  authenticateAdult(authorizationHeader: string): Promise<string | null>;
  verifyChildToken(token: string): Promise<string | null>;
  log(event: string, detail?: string): void;
}

export const MAX_BODY_BYTES = 200_000;

function toSummary(row: StoryRow, userId: string, childIds: string[]) {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    templateKey: row.template_key,
    teluguChecked: row.telugu_checked,
    mine: row.author_id === userId,
    childIds,
    scenes: Array.isArray(row.script?.scenes) ? row.script.scenes.length : 0,
    updatedAt: row.updated_at,
  };
}

// The stored id is the row's, whatever the script said.
const withId = (row: StoryRow): Story => ({ ...row.script, id: row.id });

export function createStoriesHandler(deps: StoriesDeps) {
  const { store, log } = deps;

  // Readable by the author, or a caregiver of a child it's published to.
  async function canRead(userId: string, row: StoryRow, childIds: string[]) {
    if (row.author_id === userId) return true;
    for (const c of childIds) if (await store.isCaregiverOf(userId, c)) return true;
    return false;
  }

  return async function handle(req: Request): Promise<Response> {
    const pre = preflight(req); if (pre) return pre;
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    try {
      const declared = Number(req.headers.get("Content-Length") ?? 0);
      if (declared > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      const text = await req.text();
      if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
      let raw: unknown;
      try { raw = JSON.parse(text); } catch { return json({ error: "invalid_request" }, 400); }
      const parsed = parseStoriesRequest(raw);
      if (!parsed.ok) return json({ error: parsed.error, ...(parsed.details ? { details: parsed.details } : {}) }, parsed.status);
      const request = parsed.value;

      if (request.action === "child_list") {
        const childId = await deps.verifyChildToken(request.childSessionToken);
        if (!childId) return json({ error: "invalid_session" }, 401);
        const rows = await store.listForChild(childId, CHILD_LIST_LIMIT);
        return json({ stories: rows.map(withId) });
      }

      const auth = req.headers.get("Authorization");
      const userId = auth ? await deps.authenticateAdult(auth) : null;
      if (!userId) return json({ error: "unauthorized" }, 401);

      if (request.action === "list") {
        const rows = await store.listForAdult(userId);
        const stories = [];
        for (const row of rows) stories.push(toSummary(row, userId, await store.childrenOf(row.id)));
        return json({ stories });
      }

      if (request.action === "save") {
        const fields: StoryFields = {
          title: request.script.title.en.trim(),
          script: request.script,
          source: request.source,
          template_key: request.templateKey,
          telugu_checked: request.teluguChecked,
        };
        if (request.storyId === null) {
          if ((await store.countByAuthor(userId)) >= MAX_STORIES_PER_AUTHOR) return json({ error: "too_many_stories" }, 409);
          const id = await store.insertStory(userId, fields);
          return json({ storyId: id });
        }
        const row = await store.getStory(request.storyId);
        if (!row || row.author_id !== userId) return json({ error: "not_found" }, 404);
        await store.updateStory(row.id, fields);
        return json({ storyId: row.id });
      }

      const row = await store.getStory(request.storyId);
      const childIds = row ? await store.childrenOf(row.id) : [];
      if (!row || !(await canRead(userId, row, childIds))) return json({ error: "not_found" }, 404);

      if (request.action === "get") {
        return json({ story: { ...toSummary(row, userId, childIds), script: withId(row) } });
      }
      // publish and delete: the author only. Others can see it but get not_found.
      if (row.author_id !== userId) return json({ error: "not_found" }, 404);

      if (request.action === "delete") {
        await store.deleteStory(row.id);
        return json({ deleted: true });
      }

      for (const c of request.childIds) {
        if (!(await store.isCaregiverOf(userId, c))) return json({ error: "not_found" }, 404);
      }
      await store.setChildren(row.id, request.childIds);
      return json({ storyId: row.id, childIds: request.childIds });
    } catch (e) {
      log("unhandled_exception", errorSummary(e));
      return json({ error: "internal_error" }, 500);
    }
  };
}
