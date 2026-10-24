// supabase/functions/_shared/stories.ts
// Request parsing and script checks for the stories and story-writer Edge
// Functions (role-flow 6b). Pure: no Deno or esm.sh imports, so the tests
// run it under Node.

import { validateStory, type Story } from "./storyScript.ts";
import { screenForCrisis } from "./aiCompanion.ts";

export const MAX_STORIES_PER_AUTHOR = 100;
export const MAX_CHILDREN_PER_STORY = 20;
export const CHILD_LIST_LIMIT = 50;
export const STORY_SOURCES = ["template", "ai", "manual"] as const;
export type StorySource = (typeof STORY_SOURCES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEMPLATE_KEY = /^[a-z_]{1,40}$/;

export type StoriesRequest =
  | { action: "list" }
  | { action: "get"; storyId: string }
  | { action: "save"; storyId: string | null; script: Story; source: StorySource; templateKey: string | null; teluguChecked: boolean }
  | { action: "publish"; storyId: string; childIds: string[] }
  | { action: "delete"; storyId: string }
  | { action: "child_list"; childSessionToken: string };

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string; status: number; details?: string[] };
const bad = (error = "invalid_input", details?: string[]): Parsed<never> => ({ ok: false, error, status: 400, details });

// Every line of a script, both languages, plus its title and summary.
export function storyText(story: Story): string[] {
  return [
    story.title?.en, story.title?.te, story.summary?.en, story.summary?.te,
    ...(story.scenes ?? []).flatMap((s) => (s.lines ?? []).flatMap((l) => [l.en, l.te])),
  ].filter((t): t is string => typeof t === "string");
}

// The script gate: the format (validateStory) and the existing crisis screen,
// used as is. A script that fails is never stored.
export function checkScript(script: unknown): string[] {
  const errors = validateStory(script);
  if (errors.length) return errors;
  if (storyText(script as Story).some(screenForCrisis)) return ["The story has words that aren't suitable for a social story."];
  return [];
}

export function parseStoriesRequest(raw: unknown): Parsed<StoriesRequest> {
  if (!raw || typeof raw !== "object") return bad("invalid_request");
  const r = raw as Record<string, unknown>;
  const id = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v.toLowerCase() : null);

  switch (r.action) {
    case "list":
      return { ok: true, value: { action: "list" } };
    case "get":
    case "delete": {
      const storyId = id(r.story_id);
      return storyId ? { ok: true, value: { action: r.action, storyId } } : bad();
    }
    case "child_list":
      return typeof r.child_session_token === "string" && r.child_session_token
        ? { ok: true, value: { action: "child_list", childSessionToken: r.child_session_token } }
        : { ok: false, error: "invalid_session", status: 401 };
    case "publish": {
      const storyId = id(r.story_id);
      if (!storyId || !Array.isArray(r.child_ids) || r.child_ids.length > MAX_CHILDREN_PER_STORY) return bad();
      const childIds = r.child_ids.map(id);
      if (childIds.some((c) => c === null)) return bad();
      return { ok: true, value: { action: "publish", storyId, childIds: [...new Set(childIds as string[])] } };
    }
    case "save": {
      const storyId = r.story_id === undefined || r.story_id === null ? null : id(r.story_id);
      if (r.story_id !== undefined && r.story_id !== null && !storyId) return bad();
      if (!(STORY_SOURCES as readonly unknown[]).includes(r.source)) return bad();
      const templateKey = r.template_key === undefined || r.template_key === null ? null : r.template_key;
      if (templateKey !== null && (typeof templateKey !== "string" || !TEMPLATE_KEY.test(templateKey))) return bad();
      if (r.telugu_checked !== undefined && typeof r.telugu_checked !== "boolean") return bad();
      // The stored id is the row's; give the validator a placeholder.
      const script = r.script && typeof r.script === "object" ? { ...(r.script as Story), id: storyId ?? "new" } : r.script;
      const errors = checkScript(script);
      if (errors.length) return bad("invalid_script", errors.slice(0, 10));
      return {
        ok: true,
        value: {
          action: "save", storyId, script: script as Story, source: r.source as StorySource,
          templateKey: templateKey as string | null, teluguChecked: r.telugu_checked === true,
        },
      };
    }
    default:
      return bad("invalid_request");
  }
}
