/** SafeSpace Feature: animated social stories, played on the device (role-flow step 6). */
import { DENTIST_STORY } from "./library/dentist";
import type { Story } from "./storyScript";

export const STORIES_FEATURE_NAME = "stories";

export { StoryPlayer } from "./StoryPlayer";
export { StoryEditor } from "./StoryEditor";
export * from "./storyScript";
export * from "./editor";
export * from "./templates";
export * from "./voices";
export * from "./videoLibrary";
export { VideoStoryCard, VideoStoryPlayer } from "./VideoStoryPlayer";

// Stories built into the app. Caregiver-made stories join these in step 6b.
export const STORY_LIBRARY: readonly Story[] = [DENTIST_STORY];

export function findLibraryStory(id: string): Story | null {
  return STORY_LIBRARY.find((s) => s.id === id) ?? null;
}
