/**
 * The Ocean theme: calm water and Aurelia's jellyfish on the home page (only
 * on Play), the sea cave on the tools page, still-by-default pages, colours
 * that blend from part to part, and the media budget.
 * Run with: tsx apps/web/tests/ocean-theme.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { CONDITION_TOOLS } from "../src/features/conditions/conditionTools.ts";
import { OCEAN_PLAYBACK_RATE, OceanFrame, OceanHome, OceanToolsHome } from "../src/features/themes/ocean/OceanKit.tsx";
import { OCEAN_CARD_CLIPS } from "../src/features/themes/ocean/media.ts";

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
const css = readFileSync(new URL("../src/features/themes/ocean/ocean-theme.css", import.meta.url), "utf8");

test("home: the greeting over still water, the day on a light panel, tiles; no jellyfish until Play", () => {
  const html = render(
    React.createElement(OceanHome, {
      eyebrow: "My space",
      greeting: "Hi Leo!",
      line: "Here's your day.",
      status: "2 steps left today. You've got this!",
      tiles: [{ to: "/child/music", label: "Music", emoji: "🎵" }],
      tilesLabel: "My tools",
      children: React.createElement("p", null, "today"),
    }),
  );
  assert.match(html, /Hi Leo!<br\/>Welcome to calm water\./);
  assert.match(html, /2 steps left today/);
  assert.match(html, /class="oc-still"/);
  assert.match(html, /class="ow-jelly" data-ready="false"/);
  assert.match(html, /class="ow-panel ow-stack"><p>today<\/p>/);
  // Every page as a little sub matching the theme.
  assert.match(html, /<nav aria-label="My tools" class="ow-tiles"><a class="ow-tile ow-tile--0" href="\/child\/music"><span class="ow-sub">/);
  assert.doesNotMatch(html, /<video|<audio|autoplay|<canvas/i);
});

test("tools page: the cave greeting and a card per tool, still with no video", () => {
  const items = CONDITION_TOOLS.map((tool, i) => ({ tool, mine: i < 2 }));
  const html = render(
    React.createElement(OceanToolsHome, { items, pathFor: (k: string) => `/tools/${k}`, eyebrow: "My tools", backTo: "/dashboard", backLabel: "Dashboard" }),
  );
  for (const t of CONDITION_TOOLS) {
    assert.match(html, new RegExp(`href="/tools/${t.key}"`));
    assert.ok(OCEAN_CARD_CLIPS[t.key].still && OCEAN_CARD_CLIPS[t.key].loop);
  }
  assert.match(html, /Small steps,<br\/>in calm water,<br\/>one at a time\./);
  assert.doesNotMatch(html, /<video|<audio|autoplay/i);
});

test("no names or credits of other platforms on screen", () => {
  const html =
    render(React.createElement(OceanHome, { eyebrow: "x", greeting: "Hi", line: "x", tiles: [], tilesLabel: "x", children: "x" })) +
    render(React.createElement(OceanToolsHome, { items: [], pathFor: () => "/", eyebrow: "x", backTo: "/", backLabel: "x" })) +
    render(React.createElement(OceanFrame, { eyebrow: "x", title: "Routines", children: "x" }));
  assert.doesNotMatch(html, /foldcraft|let's talk|explore work|studio|cloudfront|aurelia|holtsetio/i);
});

test("colours blend: each part starts on the colour the part before ends on", () => {
  // Home: still water ends on --ow-water; the day starts on it and ends on the abyss.
  assert.match(css, /\.ow-hero--water \.ow-hero-shade \{\s*background: linear-gradient\(180deg, rgba\(8, 42, 82, 0\) 60%, var\(--ow-water\) 95%, var\(--ow-water\) 100%\)/);
  assert.match(css, /\.ow-body \{[^}]*linear-gradient\(180deg, var\(--ow-water\) 0, var\(--ow-water\) 40px, var\(--ow-deep\) 38%, var\(--ow-abyss\) 100%\)/);
  // Tools: the cave ends on the abyss; the cards start and end on it.
  assert.match(css, /\.ow-hero--cave \.ow-hero-shade \{\s*background: linear-gradient\(180deg, rgba\(2, 4, 18, 0\) 58%, var\(--ow-abyss\) 95%, var\(--ow-abyss\) 100%\)/);
  assert.match(css, /\.ow-cards \{[^}]*linear-gradient\(180deg, var\(--ow-abyss\) 0, var\(--ow-abyss\) 40px, var\(--ow-deep\) 50%, var\(--ow-abyss\) 100%\)/);
  // The closing sits on the abyss and its clip fades in from it.
  assert.match(css, /\.ow-closing \{[^}]*background: var\(--ow-abyss\)/);
  assert.match(css, /mask-image: linear-gradient\(180deg, transparent 0%, #000 22%\)/);
  // Parts overlap by a pixel so no hairline shows between them.
  assert.match(css, /\.ow-body,\s*\.ow-cards,\s*\.ow-closing \{\s*margin-top: -1px;/);
  // The still water's own last colour is the one the day starts with.
  const still = readFileSync(new URL("../src/features/conditions/anxiety/ocean/ocean.css", import.meta.url), "utf8");
  assert.match(still, /#082a52 100%\)/);
  assert.match(css, /--ow-water: #082a52;/);
});

test("motion is gentle: clips at under normal speed", () => {
  assert.ok(OCEAN_PLAYBACK_RATE > 0 && OCEAN_PLAYBACK_RATE < 1);
});

test("the media stays small and every file is used", () => {
  const dir = fileURLToPath(new URL("../src/features/themes/ocean/media/", import.meta.url));
  const files = readdirSync(dir);
  const total = files.reduce((n, f) => n + statSync(dir + f).size, 0);
  assert.ok(total < 5 * 1024 * 1024, `media is ${total} bytes`);
  for (const f of files) assert.ok(statSync(dir + f).size < 1024 * 1024, f);
  const used = readFileSync(new URL("../src/features/themes/ocean/media.ts", import.meta.url), "utf8");
  for (const f of files) assert.ok(used.includes(`"${f.replace(/\.(webp|mp4)$/, "")}"`), `${f} is used`);
});

console.log(`ocean-theme: ${passed} passed`);
