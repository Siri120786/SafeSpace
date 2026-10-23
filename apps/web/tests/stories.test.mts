/**
 * Social stories: the script format, its validator and timing (role-flow 6a).
 * Run with: tsx apps/web/tests/stories.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import {
  estimateStorySeconds,
  facesLeft,
  frameAround,
  lineDurationMs,
  lookTowards,
  speakerLabel,
  validateStory,
  type Story,
} from "../src/features/stories/storyScript.ts";
import { DENTIST_STORY } from "../src/features/stories/library/dentist.ts";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (e) {
    console.log(`FAIL ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

const clone = (): Story => JSON.parse(JSON.stringify(DENTIST_STORY));

test("the dentist story is a valid script", () => {
  assert.deepEqual(validateStory(DENTIST_STORY), []);
});

test("it runs about 2 to 3.5 minutes in either language", () => {
  for (const lang of ["en", "te"] as const) {
    const s = estimateStorySeconds(DENTIST_STORY, lang);
    assert.ok(s >= 120 && s <= 210, `${lang}: ${s}s`);
  }
});

test("it includes the coping step: raising a hand to pause", () => {
  const actions = DENTIST_STORY.scenes.flatMap((sc) => sc.cast.map((c) => c.action));
  assert.ok(actions.includes("raise_hand"));
});

test("unknown characters, backgrounds, actions and places are refused", () => {
  const s = clone();
  (s.scenes[0] as any).background = "space_station";
  (s.scenes[0].cast[0] as any).id = "dragon";
  (s.scenes[1].cast[0] as any).action = "fly";
  (s.scenes[2].cast[0] as any).slot = "upstairs";
  const errors = validateStory(s).join(" | ");
  assert.match(errors, /Scene 1: unknown background/);
  assert.match(errors, /Scene 1: unknown character/);
  assert.match(errors, /Scene 2: unknown action/);
  assert.match(errors, /Scene 3: unknown place on stage/);
});

test("a speaker must be on stage (or the narrator)", () => {
  const s = clone();
  s.scenes[0].lines[0].speaker = "maya";
  assert.match(validateStory(s).join(" "), /Scene 1, line 1: the speaker isn't in the scene/);
});

test("every line needs both languages and a sensible length", () => {
  const s = clone();
  s.scenes[0].lines[0].te = "";
  s.scenes[0].lines[1].en = "x".repeat(201);
  const errors = validateStory(s);
  assert.equal(errors.filter((e) => /needs English and Telugu/.test(e)).length, 2);
});

test("two characters can't share a place, nor appear twice", () => {
  const s = clone();
  s.scenes[0].cast[1].slot = s.scenes[0].cast[0].slot;
  s.scenes[1].cast[1].id = s.scenes[1].cast[0].id;
  const errors = validateStory(s).join(" | ");
  assert.match(errors, /two characters in the same place/);
  assert.match(errors, /appears twice/);
});

test("limits: at least one scene, no more than 20; garbage is refused", () => {
  const s = clone();
  s.scenes = [];
  assert.match(validateStory(s).join(" "), /at least one scene/);
  const big = clone();
  big.scenes = Array.from({ length: 21 }, () => DENTIST_STORY.scenes[0]);
  assert.match(validateStory(big).join(" "), /up to 20 scenes/);
  assert.deepEqual(validateStory(null), ["The story is missing."]);
});

test("line timing grows with length, within 2.2 to 9 seconds", () => {
  assert.equal(lineDurationMs("Hi"), 2200);
  assert.ok(lineDurationMs("one two three four five six seven eight") > lineDurationMs("one two three"));
  assert.equal(lineDurationMs("word ".repeat(100)), 9000);
});

test("speaker names in each language; the narrator has none", () => {
  assert.equal(speakerLabel({ speaker: "maya", en: "", te: "" }, "en"), "Dr. Maya");
  assert.equal(speakerLabel({ speaker: "amma", en: "", te: "" }, "te"), "అమ్మ");
  assert.equal(speakerLabel({ speaker: "narrator", en: "", te: "" }, "en"), null);
});

test("characters on the right face left, towards the middle", () => {
  assert.equal(facesLeft("right"), true);
  assert.equal(facesLeft("left"), false);
  assert.equal(facesLeft("center"), false);
});

test("the dentist story uses the camera, effects, props and walking", () => {
  const scenes = DENTIST_STORY.scenes;
  assert.ok(scenes.some((sc) => sc.camera?.shot === "close"));
  assert.ok(scenes.some((sc) => sc.effect === "breathing") && scenes.some((sc) => sc.effect === "sparkles"));
  const cast = scenes.flatMap((sc) => sc.cast);
  assert.ok(cast.some((c) => c.holding === "mirror") && cast.some((c) => c.action === "walk_in") && cast.some((c) => c.action === "walk_out"));
});

test("a close or medium shot needs someone in the scene to frame", () => {
  const s = clone();
  s.scenes[0].camera = { shot: "close" };
  assert.match(validateStory(s).join(" "), /Scene 1: the camera needs someone/);
  s.scenes[0].camera = { shot: "close", focus: "maya" };
  assert.match(validateStory(s).join(" "), /Scene 1: the camera needs someone/);
  s.scenes[0].camera = { shot: "close", focus: "kai" };
  assert.deepEqual(validateStory(s), []);
});

test("unknown shots, effects and things to hold are refused", () => {
  const s = clone();
  (s.scenes[0] as any).camera = { shot: "drone" };
  (s.scenes[1] as any).effect = "fireworks";
  (s.scenes[2].cast[0] as any).holding = "sword";
  const errors = validateStory(s).join(" | ");
  assert.match(errors, /Scene 1: unknown camera shot/);
  assert.match(errors, /Scene 2: unknown effect/);
  assert.match(errors, /Scene 3: unknown thing to hold/);
});

test("listeners look towards the speaker; nobody looks at themselves", () => {
  assert.equal(lookTowards("left", "right"), 1);
  assert.equal(lookTowards("right", "midleft"), -1);
  assert.equal(lookTowards("center", "center"), 0);
  assert.equal(lookTowards("center", null), 0);
});

test("the camera zooms around a point but never shows past the edges", () => {
  assert.deepEqual(frameAround(800, 450, 1, 1600, 900), { scale: 1, x: 0, y: 0 });
  const mid = frameAround(800, 450, 2, 1600, 900);
  assert.deepEqual(mid, { scale: 2, x: -800, y: -450 });
  const corner = frameAround(0, 0, 2, 1600, 900);
  assert.deepEqual(corner, { scale: 2, x: 0, y: 0 });
  const far = frameAround(1600, 900, 2, 1600, 900);
  assert.deepEqual(far, { scale: 2, x: -1600, y: -900 });
});

console.log(`${passed} stories checks`);
