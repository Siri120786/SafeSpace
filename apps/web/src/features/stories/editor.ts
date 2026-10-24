// Pure edits for the caregiver story editor (role-flow 6b). Each returns a
// new script and leaves the old one untouched, so React state stays simple.
// No React here, so apps/web/tests/stories.test.mts can check them. The
// stories Edge Function validates the result again before saving.

import {
  CHARACTER_NAMES,
  STORY_CHARACTERS,
  STORY_LIMITS,
  STORY_SLOTS,
  type Story,
  type StoryCastMember,
  type StoryCharacterId,
  type StoryLine,
  type StoryScene,
} from "./storyScript";

const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function updateScene(story: Story, i: number, change: (s: StoryScene) => StoryScene): Story {
  const next = copy(story);
  next.scenes[i] = change(next.scenes[i]);
  return next;
}

export function moveScene(story: Story, i: number, by: -1 | 1): Story {
  const j = i + by;
  if (j < 0 || j >= story.scenes.length) return story;
  const next = copy(story);
  [next.scenes[i], next.scenes[j]] = [next.scenes[j], next.scenes[i]];
  return next;
}

export function removeScene(story: Story, i: number): Story {
  if (story.scenes.length <= 1) return story;
  const next = copy(story);
  next.scenes.splice(i, 1);
  return next;
}

// A new scene after `after`, in the same place, with Kai and one narrator line.
export function addScene(story: Story, after: number): Story {
  if (story.scenes.length >= STORY_LIMITS.scenes) return story;
  const next = copy(story);
  const base = next.scenes[after] ?? next.scenes[next.scenes.length - 1];
  const ids = new Set(next.scenes.map((s) => s.id));
  let n = next.scenes.length + 1;
  while (ids.has(`scene-${n}`)) n++;
  next.scenes.splice(after + 1, 0, {
    id: `scene-${n}`,
    background: base?.background ?? "home",
    cast: [{ id: "kai", slot: "center" }],
    lines: [{ speaker: "narrator", en: "", te: "" }],
  });
  return next;
}

export function addLine(scene: StoryScene): StoryScene {
  if (scene.lines.length >= STORY_LIMITS.linesPerScene) return scene;
  return { ...scene, lines: [...scene.lines, { speaker: "narrator", en: "", te: "" }] };
}

export function removeLine(scene: StoryScene, j: number): StoryScene {
  if (scene.lines.length <= 1) return scene;
  return { ...scene, lines: scene.lines.filter((_, k) => k !== j) };
}

export function updateLine(scene: StoryScene, j: number, change: Partial<StoryLine>): StoryScene {
  return { ...scene, lines: scene.lines.map((l, k) => (k === j ? { ...l, ...change } : l)) };
}

// Who isn't in the scene yet, and which places are free.
export const freeCharacters = (scene: StoryScene) => STORY_CHARACTERS.filter((c) => !scene.cast.some((m) => m.id === c));
export const freeSlots = (scene: StoryScene) => STORY_SLOTS.filter((s) => !scene.cast.some((m) => m.slot === s));

export function addCast(scene: StoryScene, id: StoryCharacterId): StoryScene {
  const slot = freeSlots(scene)[0];
  if (!slot || scene.cast.length >= STORY_LIMITS.castPerScene || scene.cast.some((m) => m.id === id)) return scene;
  return { ...scene, cast: [...scene.cast, { id, slot }] };
}

// Their lines become the narrator's, so the scene stays valid.
export function removeCast(scene: StoryScene, id: StoryCharacterId): StoryScene {
  const camera = scene.camera?.focus === id ? undefined : scene.camera;
  return {
    ...scene,
    camera,
    cast: scene.cast.filter((m) => m.id !== id),
    lines: scene.lines.map((l) => (l.speaker === id ? { ...l, speaker: "narrator" } : l)),
  };
}

// Moving someone onto a taken place swaps the two.
export function updateCast(scene: StoryScene, id: StoryCharacterId, change: Partial<StoryCastMember>): StoryScene {
  const me = scene.cast.find((m) => m.id === id);
  if (!me) return scene;
  const taken = change.slot && change.slot !== me.slot ? scene.cast.find((m) => m.slot === change.slot) : undefined;
  return {
    ...scene,
    cast: scene.cast.map((m) => {
      if (m.id === id) return clean({ ...m, ...change });
      if (taken && m.id === taken.id) return { ...m, slot: me.slot };
      return m;
    }),
  };
}

// Defaults are left out of the stored script.
function clean(m: StoryCastMember): StoryCastMember {
  const out = { ...m };
  if (!out.expression || out.expression === "calm") delete out.expression;
  if (!out.action || out.action === "idle") delete out.action;
  if (!out.pose || out.pose === "stand") delete out.pose;
  if (!out.holding) delete out.holding;
  return out;
}

// A one-scene story, to preview a single scene in the player.
export const singleScene = (story: Story, i: number): Story => ({ ...story, scenes: [story.scenes[i]] });

export const characterLabel = (id: StoryCharacterId | "narrator") => (id === "narrator" ? "Narrator" : CHARACTER_NAMES[id].en);

// Friendly names for the editor's menus.
export const BACKGROUND_LABELS: Record<StoryScene["background"], string> = {
  home: "Home",
  front_door: "Front door",
  clinic_outside: "Outside the clinic",
  waiting_room: "Waiting room",
  dental_room: "Dentist's room",
  doctor_room: "Doctor's room",
  school: "School gate",
  classroom: "Classroom",
  playground: "Playground",
};

export const SLOT_LABELS: Record<StoryCastMember["slot"], string> = {
  left: "Left",
  midleft: "Left of middle",
  center: "Middle",
  midright: "Right of middle",
  right: "Right",
};

export const ACTION_LABELS: Record<NonNullable<StoryCastMember["action"]>, string> = {
  idle: "Just stands",
  wave: "Waves",
  nod: "Nods",
  breathe: "Breathes slowly",
  walk_in: "Walks in",
  walk_out: "Walks out (at the end)",
  raise_hand: "Raises a hand",
  point: "Points",
  hop: "Hops for joy",
};

export const PROP_LABELS: Record<NonNullable<StoryCastMember["holding"]>, string> = {
  mirror: "Dentist's mirror",
  toothbrush: "Toothbrush",
  teddy: "Teddy",
  stethoscope: "Stethoscope",
  backpack: "Backpack",
};

export const EFFECT_LABELS: Record<NonNullable<StoryScene["effect"]>, string> = {
  none: "None",
  sparkles: "Sparkles",
  breathing: "Breathing circle",
  bell: "Ringing bell (no sound)",
};

// Friendly text for the stories functions' error codes.
const STORY_ERRORS: Record<string, string> = {
  invalid_script: "Some parts of the story need fixing first (see the list).",
  too_many_stories: "You have 100 stories. Delete one to make another.",
  not_found: "This story isn't yours to change, or it was deleted.",
  unauthorized: "Please sign in again.",
};

export function storyErrorText(err: unknown): string {
  const code = err instanceof Error ? err.message : "";
  return STORY_ERRORS[code] ?? "That didn't save. Please try again.";
}

// The Gemini draft form (story-writer). Same limits as the function.
export const AI_PROMPT_MIN = 10;
export const AI_PROMPT_MAX = 600;
export const AGE_BAND_LABELS = { young: "About 4 to 7", middle: "About 8 to 11", teen: "About 12 to 17" } as const;

const AI_ERRORS: Record<string, string> = {
  not_suitable:
    "SafeSpace can't write a story about that. If you're worried your child might hurt themselves, please talk to a doctor. In India you can call Tele-MANAS on 14416, or 112 in an emergency.",
  daily_limit_reached: "You've made 10 drafts in the last day. Try again tomorrow, or start from a template.",
  ai_unavailable: "The story writer isn't available right now. Try again in a little while, or start from a template.",
  invalid_input: `Describe the situation in ${AI_PROMPT_MIN} to ${AI_PROMPT_MAX} characters.`,
  unauthorized: "Please sign in again.",
};

export function aiDraftErrorText(err: unknown): string {
  const code = err instanceof Error ? err.message : "";
  return AI_ERRORS[code] ?? AI_ERRORS.ai_unavailable;
}
