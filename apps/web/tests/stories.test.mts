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
  STORY_ACTIONS,
  STORY_BACKGROUNDS,
  STORY_EFFECTS,
  STORY_PROPS,
  type Story,
} from "../src/features/stories/storyScript.ts";
import { DENTIST_STORY } from "../src/features/stories/library/dentist.ts";
import { STORY_TEMPLATES, findTemplate, scriptFromTemplate } from "../src/features/stories/templates.ts";
import { checkScript } from "../../../supabase/functions/_shared/stories.ts";
import * as E from "../src/features/stories/editor.ts";

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

test("every template is a valid script the server would accept", () => {
  for (const t of STORY_TEMPLATES) {
    assert.deepEqual(validateStory(t.script), [], t.key);
    assert.deepEqual(checkScript(t.script), [], t.key);
    assert.match(t.key, /^[a-z_]{1,40}$/);
  }
  assert.equal(new Set(STORY_TEMPLATES.map((t) => t.key)).size, STORY_TEMPLATES.length);
});

test("every template has a coping step and a calm, proud ending, in 1 to 3.5 minutes", () => {
  for (const t of STORY_TEMPLATES) {
    const sc = t.script.scenes;
    const coping = sc.some((s) => s.effect === "breathing" || s.cast.some((c) => c.action === "raise_hand" || c.action === "breathe"));
    assert.ok(coping, `${t.key}: coping step`);
    assert.equal(sc.at(-1)?.effect, "sparkles", `${t.key}: ending`);
    for (const lang of ["en", "te"] as const) {
      const secs = estimateStorySeconds(t.script, lang);
      assert.ok(secs >= 60 && secs <= 210, `${t.key} ${lang}: ${secs}s`);
    }
  }
});

test("the new places, the teacher and the bell are used by the templates", () => {
  const scenes = STORY_TEMPLATES.flatMap((t) => t.script.scenes);
  for (const bg of ["classroom", "playground", "doctor_room"]) assert.ok(scenes.some((s) => s.background === bg), bg);
  assert.ok(scenes.some((s) => s.cast.some((c) => c.id === "asha")));
  assert.ok(scenes.some((s) => s.effect === "bell"));
});

test("a template copy can be edited without changing the template", () => {
  const t = findTemplate("new_school")!;
  const copy = scriptFromTemplate(t);
  copy.scenes[0].lines[0].en = "Changed";
  assert.notEqual(t.script.scenes[0].lines[0].en, "Changed");
  assert.equal(findTemplate("nope"), undefined);
});

test("editor: scenes move, delete and add without touching the original", () => {
  const base = clone();
  const moved = E.moveScene(base, 0, 1);
  assert.equal(moved.scenes[0].id, base.scenes[1].id);
  assert.equal(base.scenes[0].id, DENTIST_STORY.scenes[0].id);
  assert.equal(E.moveScene(base, 0, -1), base);
  assert.equal(E.removeScene(base, 2).scenes.length, base.scenes.length - 1);
  const one = { ...base, scenes: [base.scenes[0]] };
  assert.equal(E.removeScene(one, 0).scenes.length, 1);
  const added = E.addScene(base, 0);
  assert.equal(added.scenes[1].background, base.scenes[0].background);
  assert.equal(new Set(added.scenes.map((x) => x.id)).size, added.scenes.length);
  assert.match(validateStory(added).join(" "), /Scene 2, line 1: needs English and Telugu/);
});

test("editor: removing someone hands their lines to the narrator and drops the camera on them", () => {
  const sc = clone().scenes[9]; // a-break: camera close on Kai
  const out = E.removeCast(sc, "kai");
  assert.ok(out.lines.every((l) => l.speaker !== "kai"));
  assert.equal(out.camera, undefined);
  assert.deepEqual(validateStory({ ...clone(), scenes: [out] }), []);
});

test("editor: moving onto a taken place swaps; defaults stay out of the script", () => {
  const sc = clone().scenes[0]; // amma left, kai center, papa right
  const out = E.updateCast(sc, "kai", { slot: "left" });
  assert.equal(out.cast.find((m) => m.id === "kai")?.slot, "left");
  assert.equal(out.cast.find((m) => m.id === "amma")?.slot, "center");
  const calm = E.updateCast(sc, "amma", { expression: "calm", action: "idle", pose: "stand", holding: undefined });
  assert.deepEqual(calm.cast.find((m) => m.id === "amma"), { id: "amma", slot: "left" });
});

test("editor: adding people and lines respects the limits", () => {
  let sc = clone().scenes[0];
  sc = E.addCast(sc, "pip");
  assert.equal(sc.cast.length, 4);
  assert.equal(E.addCast(sc, "maya").cast.length, 4);
  assert.equal(E.addCast(sc, "pip"), sc);
  let lines = sc;
  for (let i = 0; i < 10; i++) lines = E.addLine(lines);
  assert.equal(lines.lines.length, 6);
  assert.equal(E.removeLine({ ...sc, lines: [sc.lines[0]] }, 0).lines.length, 1);
  assert.equal(E.singleScene(clone(), 3).scenes[0].id, DENTIST_STORY.scenes[3].id);
});

test("editor: every background, action, prop and effect has a friendly label", () => {
  for (const b of STORY_BACKGROUNDS) assert.ok(E.BACKGROUND_LABELS[b]);
  for (const a of STORY_ACTIONS) assert.ok(E.ACTION_LABELS[a]);
  for (const p of STORY_PROPS) assert.ok(E.PROP_LABELS[p]);
  for (const f of STORY_EFFECTS) assert.ok(E.EFFECT_LABELS[f]);
  assert.equal(E.storyErrorText(new Error("too_many_stories")), "You have 100 stories. Delete one to make another.");
  assert.equal(E.storyErrorText(new Error("weird")), "That didn't save. Please try again.");
});

console.log(`${passed} stories checks`);
