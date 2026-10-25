/**
 * The Animals theme: Rusty on the home page, the bee on the tools page, the
 * animal cards, still-by-default pages, gentle motion and the media budget.
 * Run with: tsx apps/web/tests/animals-theme.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { CONDITION_TOOLS } from "../src/features/conditions/conditionTools.ts";
import { AnimalsFrame, AnimalsHome, AnimalsToolsHome, ANIMALS_PLAYBACK_RATE, BUBBLE_LETTERS_PER_SECOND } from "../src/features/themes/animals/AnimalsKit.tsx";
import { BEE_WING_BEATS, beeStops, beeTarget, lerpAngle, RUSTY_FLOAT_SECONDS, rustySpot } from "../src/features/themes/animals/critters.ts";
import { ANIMALS_CARD_CLIPS } from "../src/features/themes/animals/media.ts";
import { dayStatus } from "../src/pages/ChildHomePage.tsx";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`  FAIL ${name}`);
    throw e;
  }
}
const render = (el: React.ReactElement) => renderToStaticMarkup(React.createElement(StaticRouter, { location: "/" }, el));

test("home: Rusty greets by name, the day on a light panel, tiles, still by default", () => {
  const html = render(
    React.createElement(AnimalsHome, {
      eyebrow: "My space",
      greeting: "Hi Leo!",
      line: "Here's your day.",
      status: "2 steps left today. You've got this!",
      tiles: [{ to: "/child/music", label: "Music", emoji: "🎵" }],
      tilesLabel: "My tools",
      children: React.createElement("p", null, "today"),
    }),
  );
  assert.match(html, /<span>Hi Leo!<\/span><span class="an-u an-indent">I&#x27;m Rusty<\/span>/);
  assert.match(html, /class="an-panel an-stack"><p>today<\/p>/);
  // Every page as a paw print matching the theme.
  assert.match(html, /<nav aria-label="My tools" class="an-tiles"><a class="an-tile an-tile--0" href="\/child\/music"><span class="an-paw">/);
  assert.match(html, /aria-pressed="false"[^>]*>.*Play/);
  assert.doesNotMatch(html, /<video|<audio|autoplay/i);
});

test("tools page: every tool has an animal card; opens still with no video", () => {
  const items = CONDITION_TOOLS.map((tool, i) => ({ tool, mine: i < 2 }));
  const html = render(
    React.createElement(AnimalsToolsHome, { items, pathFor: (k: string) => `/tools/${k}`, eyebrow: "My tools", backTo: "/dashboard", backLabel: "Dashboard" }),
  );
  for (const t of CONDITION_TOOLS) {
    assert.match(html, new RegExp(`href="/tools/${t.key}"`));
    assert.ok(ANIMALS_CARD_CLIPS[t.key].still);
  }
  assert.match(html, /Pick a tool/);
  assert.match(html, /Your tool/);
  assert.match(html, /More tools/);
  assert.doesNotMatch(html, /<video|<audio|autoplay/i);
  assert.equal((html.match(/data-bee-stop/g) ?? []).length, 3);
});

test("no names or credits of other platforms on screen", () => {
  const html =
    render(React.createElement(AnimalsHome, { eyebrow: "x", greeting: "Hi", line: "x", tiles: [], tilesLabel: "x", children: "x" })) +
    render(React.createElement(AnimalsToolsHome, { items: [], pathFor: () => "/", eyebrow: "x", backTo: "/", backLabel: "x" })) +
    render(React.createElement(AnimalsFrame, { eyebrow: "x", title: "Routines", children: "x" }));
  assert.doesNotMatch(html, /fennec|melli|nomi|buzz in|agent|cloudfront|youtube|instagram|dribbble|made by/i);
});

test("motion is gentle: slow clips, a slow float, a soft wing flutter, slow typing", () => {
  assert.ok(ANIMALS_PLAYBACK_RATE > 0 && ANIMALS_PLAYBACK_RATE < 1);
  assert.ok(RUSTY_FLOAT_SECONDS >= 4, "a slow float");
  assert.ok(BEE_WING_BEATS <= 5, "no fast flicker from the wings");
  assert.ok(BUBBLE_LETTERS_PER_SECOND <= 20);
});

test("the bee rests beside each part and dips a little between them", () => {
  for (const w of [1280, 375]) {
    const stops = beeStops(w);
    assert.equal(stops.length, 3);
    const at0 = beeTarget(stops, 0);
    assert.equal(at0.x, stops[0].x);
    assert.equal(at0.moving, 0);
    const rest = beeTarget(stops, 1.05);
    assert.equal(rest.x, stops[1].x, "rests at the start of a part");
    const mid = beeTarget(stops, 0.5);
    assert.ok(mid.moving > 0.9 && mid.y < (stops[0].y + stops[1].y) / 2, "dips mid-flight");
    for (const p of [-3, Number.NaN, 99]) {
      const t = beeTarget(stops, p);
      assert.ok(Number.isFinite(t.x) && Number.isFinite(t.y));
    }
  }
  assert.equal(lerpAngle(350, 10, 0.5), 360);
  assert.equal(lerpAngle(10, 350, 0.5), 0);
});

test("Rusty stands beside the greeting on wide screens and above it on phones", () => {
  assert.ok(rustySpot(1280).x > 0.3);
  assert.equal(rustySpot(375).x, 0);
  assert.ok(rustySpot(375).y > 0);
});

test("Rusty's word about the day", () => {
  assert.equal(dayStatus(null), undefined);
  assert.match(dayStatus({ steps: [], allDone: false })!, /Nothing planned/);
  assert.match(dayStatus({ steps: [{ done: true } as never], allDone: true })!, /All done/);
  assert.equal(dayStatus({ steps: [{ done: false } as never, { done: true } as never], allDone: false }), "1 step left today. You've got this!");
});

test("the media stays small and every file is used", () => {
  const dir = fileURLToPath(new URL("../src/features/themes/animals/media/", import.meta.url));
  const files = readdirSync(dir);
  const total = files.reduce((n, f) => n + statSync(dir + f).size, 0);
  assert.ok(total < 6 * 1024 * 1024, `media is ${total} bytes`);
  for (const f of files) assert.ok(statSync(dir + f).size < 2 * 1024 * 1024, f);
  const used = readFileSync(new URL("../src/features/themes/animals/media.ts", import.meta.url), "utf8");
  for (const f of files) assert.ok(used.includes(f.replace(/\.(webp|mp4|glb)$/, "")), `${f} is used`);
});

console.log(`animals-theme: ${passed} passed`);
