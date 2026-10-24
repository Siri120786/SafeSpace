// Imagine & Create helpers. There is no single correct answer, so the only
// rules are "enough was chosen to count as finished". What the player makes
// (including any text they type) stays on this device; only "one round
// finished" is ever saved to the account.
import { imagineContent, text } from "./content";

export interface CharacterDraft {
  body: string | null;
  colorId: string | null;
  accessory: string | null;
  powerKey: string | null;
  name: string;
}

export interface SceneDraft {
  backdropId: string | null;
  /** Sticker per grid cell, row by row; null = empty. */
  cells: (string | null)[];
}

export interface StoryDraft {
  starterId: string | null;
  nextKey: string | null;
  endKey: string | null;
  ownText: string;
}

export const emptyCharacter = (): CharacterDraft => ({ body: null, colorId: null, accessory: null, powerKey: null, name: "" });
export const emptyScene = (): SceneDraft => ({
  backdropId: null,
  cells: Array(imagineContent.scene.grid.columns * imagineContent.scene.grid.rows).fill(null),
});
export const emptyStory = (): StoryDraft => ({ starterId: null, nextKey: null, endKey: null, ownText: "" });

export function characterIsComplete(c: CharacterDraft): boolean {
  const chosen = [c.body, c.colorId, c.accessory, c.powerKey].filter(Boolean).length;
  return !!c.body && chosen >= imagineContent.character.minChoices;
}

export const stickerCount = (s: SceneDraft) => s.cells.filter(Boolean).length;
export const sceneIsComplete = (s: SceneDraft) => !!s.backdropId && stickerCount(s) >= imagineContent.scene.minStickers;

export function storyIsComplete(s: StoryDraft): boolean {
  return !!s.starterId && (!!s.nextKey || s.ownText.trim().length > 0) && (!!s.endKey || s.ownText.trim().length > 0);
}

/** Trims, collapses whitespace and limits length. Never sent to the server. */
export function cleanOwnText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, imagineContent.story.maxOwnTextLength);
}

export function placeSticker(scene: SceneDraft, cell: number, sticker: string | null): SceneDraft {
  if (cell < 0 || cell >= scene.cells.length) return scene;
  const cells = scene.cells.slice();
  cells[cell] = sticker;
  return { ...scene, cells };
}

export function characterIntro(c: CharacterDraft, lang = "en"): string {
  const name = c.name.trim() || text("ic.character.unnamed", {}, lang);
  const power = c.powerKey ? ` ${name} ${text(c.powerKey, {}, lang)}.` : "";
  return `${text("ic.character.intro", { name }, lang)}${power}`;
}

/** The whole story as one string, for reading aloud. */
export function composeStory(s: StoryDraft, lang = "en"): string {
  const starter = imagineContent.story.starters.find((x) => x.id === s.starterId);
  if (!starter) return "";
  const parts = [text(starter.textKey, {}, lang)];
  if (s.nextKey) parts.push(text(s.nextKey, {}, lang));
  const own = cleanOwnText(s.ownText);
  if (own) parts.push(own);
  if (s.endKey) parts.push(text(s.endKey, {}, lang));
  return parts.join(" ");
}

export interface Creation {
  id: string;
  kind: "character" | "scene" | "story";
  createdAt: string;
  character?: CharacterDraft;
  scene?: SceneDraft;
  story?: StoryDraft;
}

export const MAX_CREATIONS = 12;

/** Newest first, capped, so local storage never grows without limit. */
export function keepCreation(list: Creation[], c: Creation): Creation[] {
  return [c, ...list.filter((x) => x.id !== c.id)].slice(0, MAX_CREATIONS);
}
