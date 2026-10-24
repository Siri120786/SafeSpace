// The story script format (role-flow step 6). A story is data: scenes with a
// background, who is on stage, how they look and move, and the lines spoken
// in English and Telugu. The player animates it on the device; nothing is
// generated or downloaded at playback. The stories Edge Function validates
// every saved or Gemini-written script with validateStory before storing it.
// Shared by the web app (re-exported from apps/web/src/features/stories) and
// the Edge Functions, so: plain TypeScript, no imports.

export const STORY_CHARACTERS = ["kai", "jaya", "amma", "papa", "maya", "asha", "pip"] as const;
export type StoryCharacterId = (typeof STORY_CHARACTERS)[number];

export const CHARACTER_NAMES: Record<StoryCharacterId, { en: string; te: string }> = {
  kai: { en: "Kai", te: "కై" },
  jaya: { en: "Jaya", te: "జయ" },
  amma: { en: "Amma", te: "అమ్మ" },
  papa: { en: "Papa", te: "నాన్న" },
  maya: { en: "Dr. Maya", te: "డాక్టర్ మాయ" },
  asha: { en: "Ms. Asha", te: "ఆశా టీచర్" },
  pip: { en: "Pip", te: "పిప్" },
};

export const STORY_BACKGROUNDS = [
  "home", "front_door", "clinic_outside", "waiting_room", "dental_room", "doctor_room", "school", "classroom", "playground",
  "park", "shop", "bus_stop", "salon",
] as const;
export type StoryBackground = (typeof STORY_BACKGROUNDS)[number];

// Where someone stands, left to right.
export const STORY_SLOTS = ["left", "midleft", "center", "midright", "right"] as const;
export type StorySlot = (typeof STORY_SLOTS)[number];
export const SLOT_X: Record<StorySlot, number> = { left: 300, midleft: 560, center: 800, midright: 1040, right: 1300 };

export const STORY_EXPRESSIONS = ["calm", "happy", "worried", "surprised"] as const;
export type StoryExpression = (typeof STORY_EXPRESSIONS)[number];

// What someone does in the scene. Talking is automatic while their line plays.
// walk_out happens once the scene's lines are done.
export const STORY_ACTIONS = ["idle", "wave", "nod", "breathe", "walk_in", "walk_out", "raise_hand", "point", "hop"] as const;
export type StoryAction = (typeof STORY_ACTIONS)[number];

export const STORY_POSES = ["stand", "sit"] as const;
export type StoryPose = (typeof STORY_POSES)[number];

// Something held in the hand that moves.
export const STORY_PROPS = ["mirror", "toothbrush", "teddy", "stethoscope", "backpack"] as const;
export type StoryProp = (typeof STORY_PROPS)[number];

// How the scene is framed. "wide" shows the whole room (and gently leans
// towards whoever speaks); "medium" and "close" frame the focus character.
export const STORY_SHOTS = ["wide", "medium", "close"] as const;
export type StoryShot = (typeof STORY_SHOTS)[number];

// A calm overlay for the scene. "bell": a ringing bell, shown instead of
// playing a sound (school bells, a fire-drill alarm).
export const STORY_EFFECTS = ["none", "sparkles", "breathing", "bell"] as const;
export type StoryEffect = (typeof STORY_EFFECTS)[number];

export type StoryLang = "en" | "te";

export interface StoryCastMember {
  id: StoryCharacterId;
  slot: StorySlot;
  expression?: StoryExpression; // default calm
  action?: StoryAction;         // default idle
  pose?: StoryPose;             // default stand
  holding?: StoryProp;
}

export interface StoryLine {
  speaker: StoryCharacterId | "narrator";
  en: string;
  te: string;
}

export interface StoryScene {
  id: string;
  background: StoryBackground;
  cast: StoryCastMember[];
  lines: StoryLine[];
  camera?: { shot: StoryShot; focus?: StoryCharacterId }; // default wide
  effect?: StoryEffect;                                    // default none
}

export interface Story {
  id: string;
  title: { en: string; te: string };
  summary: { en: string; te: string };
  scenes: StoryScene[];
}

export const STORY_LIMITS = { scenes: 20, castPerScene: 4, linesPerScene: 6, lineChars: 200, titleChars: 80 } as const;

const has = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
const text = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max;

// Every problem with a script, as plain sentences; empty when it's fine.
export function validateStory(story: unknown): string[] {
  const errors: string[] = [];
  const s = story as Partial<Story> | null;
  if (!s || typeof s !== "object") return ["The story is missing."];
  if (!text(s.id, 60)) errors.push("The story needs an id.");
  if (!text(s.title?.en, STORY_LIMITS.titleChars) || !text(s.title?.te, STORY_LIMITS.titleChars)) {
    errors.push("The story needs a title in English and Telugu.");
  }
  if (!Array.isArray(s.scenes) || s.scenes.length === 0) return [...errors, "The story needs at least one scene."];
  if (s.scenes.length > STORY_LIMITS.scenes) errors.push(`A story can have up to ${STORY_LIMITS.scenes} scenes.`);

  s.scenes.forEach((scene, i) => {
    const at = `Scene ${i + 1}`;
    if (!has(STORY_BACKGROUNDS, scene?.background)) errors.push(`${at}: unknown background.`);
    if (scene?.effect !== undefined && !has(STORY_EFFECTS, scene.effect)) errors.push(`${at}: unknown effect.`);
    const cast = Array.isArray(scene?.cast) ? scene.cast : [];
    if (cast.length > STORY_LIMITS.castPerScene) errors.push(`${at}: up to ${STORY_LIMITS.castPerScene} characters.`);
    const slots = new Set<string>();
    const ids = new Set<string>();
    for (const c of cast) {
      if (!has(STORY_CHARACTERS, c?.id)) errors.push(`${at}: unknown character.`);
      else if (ids.has(c.id)) errors.push(`${at}: ${CHARACTER_NAMES[c.id].en} appears twice.`);
      else ids.add(c.id);
      if (!has(STORY_SLOTS, c?.slot)) errors.push(`${at}: unknown place on stage.`);
      else if (slots.has(c.slot)) errors.push(`${at}: two characters in the same place.`);
      else slots.add(c.slot);
      if (c?.expression !== undefined && !has(STORY_EXPRESSIONS, c.expression)) errors.push(`${at}: unknown expression.`);
      if (c?.action !== undefined && !has(STORY_ACTIONS, c.action)) errors.push(`${at}: unknown action.`);
      if (c?.pose !== undefined && !has(STORY_POSES, c.pose)) errors.push(`${at}: unknown pose.`);
      if (c?.holding !== undefined && !has(STORY_PROPS, c.holding)) errors.push(`${at}: unknown thing to hold.`);
    }
    const cam = scene?.camera;
    if (cam !== undefined) {
      if (!has(STORY_SHOTS, cam?.shot)) errors.push(`${at}: unknown camera shot.`);
      if (cam?.shot !== "wide" && !ids.has(cam?.focus as string)) errors.push(`${at}: the camera needs someone in the scene to frame.`);
    }
    const lines = Array.isArray(scene?.lines) ? scene.lines : [];
    if (lines.length === 0) errors.push(`${at}: needs at least one line.`);
    if (lines.length > STORY_LIMITS.linesPerScene) errors.push(`${at}: up to ${STORY_LIMITS.linesPerScene} lines.`);
    lines.forEach((l, j) => {
      if (l?.speaker !== "narrator" && !ids.has(l?.speaker as string)) {
        errors.push(`${at}, line ${j + 1}: the speaker isn't in the scene.`);
      }
      if (!text(l?.en, STORY_LIMITS.lineChars) || !text(l?.te, STORY_LIMITS.lineChars)) {
        errors.push(`${at}, line ${j + 1}: needs English and Telugu text, up to ${STORY_LIMITS.lineChars} characters.`);
      }
    });
  });
  return errors;
}

// How long a line stays up when it isn't read aloud (or the device can't speak).
export function lineDurationMs(line: string): number {
  const words = line.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(9000, Math.max(2200, 1200 + words * 420));
}

export const SCENE_PAUSE_MS = 1200;

// Roughly how long the story takes, in seconds.
export function estimateStorySeconds(story: Story, lang: StoryLang): number {
  const ms = story.scenes.reduce(
    (sum, sc) => sum + SCENE_PAUSE_MS + sc.lines.reduce((s, l) => s + lineDurationMs(l[lang]) + 400, 0),
    0,
  );
  return Math.round(ms / 1000);
}

export function speakerLabel(line: StoryLine, lang: StoryLang): string | null {
  return line.speaker === "narrator" ? null : CHARACTER_NAMES[line.speaker][lang];
}

// Characters face the middle of the stage.
export function facesLeft(slot: StorySlot): boolean {
  return SLOT_X[slot] > SLOT_X.center;
}

// Where a listener looks: -1 left, 0 ahead, 1 right (on screen).
export function lookTowards(fromSlot: StorySlot, toSlot: StorySlot | null): -1 | 0 | 1 {
  if (!toSlot || toSlot === fromSlot) return 0;
  return SLOT_X[toSlot] > SLOT_X[fromSlot] ? 1 : -1;
}

export interface CameraView {
  scale: number;
  x: number; // translate, stage units
  y: number;
}

// The camera: zoom by `scale` around (fx, fy), keeping the picture filling
// the stage (no empty edges).
export function frameAround(fx: number, fy: number, scale: number, stageW: number, stageH: number): CameraView {
  if (scale <= 1) return { scale: 1, x: 0, y: 0 };
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    scale,
    x: clamp(stageW / 2 - scale * fx, stageW - scale * stageW, 0),
    y: clamp(stageH / 2 - scale * fy, stageH - scale * stageH, 0),
  };
}

export const SHOT_SCALE: Record<StoryShot, number> = { wide: 1, medium: 1.3, close: 1.7 };
export const SPEAKER_LEAN = 1.08; // the gentle lean towards a speaker in a wide shot
