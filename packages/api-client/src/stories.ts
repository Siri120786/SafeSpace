// packages/api-client/src/stories.ts
// Caregiver-made animated stories (role-flow 6b). Everything goes through two
// Edge Functions: `stories` (save, publish, list; the only writer, and it
// validates every script) and `story-writer` (Gemini drafts a script; nothing
// is stored until the adult saves it). Scripts are the format in
// supabase/functions/_shared/storyScript.ts; this layer passes them through
// untyped (S) so it doesn't depend on the player's types.

import { ContractError, invokeEdge } from "./edge";
import type { AppSession } from "@safespace/shared-types";

export type StorySource = "template" | "ai" | "manual";
export type StoryAgeBand = "young" | "middle" | "teen";

export interface StorySummary {
  id: string;
  title: string;
  source: StorySource;
  templateKey: string | null;
  teluguChecked: boolean;
  mine: boolean;          // false: a co-caregiver's story published to my child
  childIds: string[];     // who it's published to; [] = draft
  scenes: number;
  updatedAt: string;
}

export interface SaveStoryInput<S> {
  storyId?: string;
  script: S;
  source: StorySource;
  templateKey?: string | null;
  teluguChecked?: boolean;
}

export const listStories = () =>
  invokeEdge<{ stories: StorySummary[] }>("stories", { action: "list" }).then((d) => d.stories);

export const getStory = <S>(storyId: string) =>
  invokeEdge<{ story: StorySummary & { script: S } }>("stories", { action: "get", story_id: storyId }).then((d) => d.story);

export const saveStory = <S>(input: SaveStoryInput<S>) =>
  invokeEdge<{ storyId: string }>("stories", {
    action: "save",
    story_id: input.storyId ?? null,
    script: input.script,
    source: input.source,
    template_key: input.templateKey ?? null,
    telugu_checked: input.teluguChecked ?? false,
  }).then((d) => d.storyId);

// [] takes it back from every child.
export const publishStory = (storyId: string, childIds: string[]) =>
  invokeEdge<{ childIds: string[] }>("stories", { action: "publish", story_id: storyId, child_ids: childIds }).then((d) => d.childIds);

export const deleteStory = (storyId: string) =>
  invokeEdge<{ deleted: boolean }>("stories", { action: "delete", story_id: storyId }).then(() => undefined);

// Gemini's draft for the editor. Errors: not_suitable, daily_limit_reached, ai_unavailable.
export const draftStoryWithAi = <S>(prompt: string, ageBand: StoryAgeBand = "young") =>
  invokeEdge<{ script: S }>("story-writer", { prompt, age_band: ageBand }).then((d) => d.script);

// Child session only: the stories published to this child.
export async function listMyStories<S>(session: AppSession): Promise<S[]> {
  if (session?.kind !== "child") throw new ContractError("unsupported_session");
  const data = await invokeEdge<{ stories: S[] }>("stories", {
    action: "child_list",
    child_session_token: session.childSessionToken,
  });
  return data.stories;
}
