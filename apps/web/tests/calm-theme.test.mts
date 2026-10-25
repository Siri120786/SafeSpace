/**
 * The Calm theme (the default): the meadow home with the boy and his puppy,
 * the moonlit camp tools page, still-by-default pages, colours that blend
 * from day into night and back, and the media budget.
 * Run with: tsx apps/web/tests/calm-theme.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { CONDITION_TOOLS } from "../src/features/conditions/conditionTools.ts";
import { CALM_PLAYBACK_RATE, CalmFrame, CalmHome, CalmToolsHome } from "../src/features/themes/calm/CalmKit.tsx";
import { CALM_CARD_PICTURES } from "../src/features/themes/calm/media.ts";
import { SCENE_PLATE } from "../src/features/landing/hero/heroScene.ts";

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
const css = readFileSync(new URL("../src/features/themes/calm/calm.css", import.meta.url), "utf8");

test("home: the meadow (the landing page's boy and puppy), the day, tiles, and the camp at night; still", () => {
  const html = render(
    React.createElement(CalmHome, {
      eyebrow: "My space",
      greeting: "Hi Leo!",
      line: "Here's your day.",
      status: "2 steps left today. You've got this!",
      tiles: [{ to: "/child/music", label: "Music", emoji: "🎵" }],
      tilesLabel: "My tools",
      children: React.createElement("p", null, "today"),
    }),
  );
  assert.ok(html.includes(SCENE_PLATE), "the landing page's meadow");
  assert.match(html, /<span>Hi Leo!<\/span><span>A gentle day<\/span>/);
  assert.match(html, /2 steps left today/);
  assert.match(html, /class="cm-panel cm-stack"><p>today<\/p>/);
  assert.match(html, /<nav aria-label="My tools" class="cm-tiles"><a class="cm-tile" href="\/child\/music">/);
  assert.match(html, /camp\.webp/);
  assert.doesNotMatch(html, /<video|<audio|autoplay/i);
});

test("tools page: the moonlit camp and a card per tool, still with no video", () => {
  const items = CONDITION_TOOLS.map((tool, i) => ({ tool, mine: i < 2 }));
  const html = render(
    React.createElement(CalmToolsHome, { items, pathFor: (k: string) => `/tools/${k}`, eyebrow: "My tools", backTo: "/dashboard", backLabel: "Dashboard" }),
  );
  for (const t of CONDITION_TOOLS) {
    assert.match(html, new RegExp(`href="/tools/${t.key}"`));
    assert.ok(CALM_CARD_PICTURES[t.key]);
  }
  assert.match(html, /<span>Your<\/span><span>Tools<\/span>/);
  assert.doesNotMatch(html, /<video|<audio|autoplay/i);
});

test("no names or credits of other platforms on screen", () => {
  const html =
    render(React.createElement(CalmHome, { eyebrow: "x", greeting: "Hi", line: "x", tiles: [], tilesLabel: "x", children: "x" })) +
    render(React.createElement(CalmToolsHome, { items: [], pathFor: () => "/", eyebrow: "x", backTo: "/", backLabel: "x" })) +
    render(React.createElement(CalmFrame, { eyebrow: "x", title: "Routines", children: "x" }));
  assert.doesNotMatch(html, /camper|overnight camp|sign up|travel|companions|cloudfront\.net\/[^"]*hf_2026/i);
});

test("colours blend: day into night on home, night into morning on the tools page", () => {
  // Home: the meadow ends on grass; the day starts on it and ends on night;
  // the camp sits on night and fades in from it.
  assert.match(css, /\.cm-hero--meadow \.cm-hero-shade \{\s*background: linear-gradient\(180deg, rgba\(58, 108, 39, 0\) 66%, var\(--cm-grass\) 96%, var\(--cm-grass\) 100%\)/);
  assert.match(css, /\.cm-day \{[^}]*linear-gradient\(180deg, var\(--cm-grass\) 0, var\(--cm-grass\) 40px,[^)]*var\(--cm-night\) 100%\)/);
  assert.match(css, /\.cm-closing--camp \{\s*background: var\(--cm-night\)/);
  // Tools: the camp ends on night; the cards start and end on it; the
  // closing lifts night into the meadow's own sky colour.
  assert.match(css, /\.cm-hero--camp \.cm-hero-shade \{\s*background: linear-gradient\(180deg, rgba\(11, 26, 43, 0\) 62%, var\(--cm-night\) 96%, var\(--cm-night\) 100%\)/);
  assert.match(css, /\.cm-cards \{[^}]*linear-gradient\(180deg, var\(--cm-night\) 0, var\(--cm-night\) 40px, #11283f 50%, var\(--cm-night\) 100%\)/);
  assert.match(css, /\.cm-closing--meadow \{[^}]*linear-gradient\(180deg, var\(--cm-night\) 0,[^;]*var\(--cm-sky\) var\(--cm-dawn\)/);
  // Each clip fades in from the colour above it, and parts overlap by a pixel.
  assert.match(css, /\.cm-closing \.cm-closing-media \{[^}]*mask-image: linear-gradient\(180deg, transparent 0%, #000 20%\)/);
  for (const part of ["cm-day", "cm-cards", "cm-closing"]) assert.match(css, new RegExp(`\.${part} \{[^}]*margin-top: -1px`), part);
  // The sampled colours: the meadow plate's grass and sky, the camp's night.
  assert.match(css, /--cm-grass: #3a6c27;/);
  assert.match(css, /--cm-sky: #368aca;/);
  assert.match(css, /--cm-night: #0b1a2b;/);
});

test("motion is gentle: clips at under normal speed", () => {
  assert.ok(CALM_PLAYBACK_RATE > 0 && CALM_PLAYBACK_RATE < 1);
});

test("the media stays small and every file is used", () => {
  const dir = fileURLToPath(new URL("../src/features/themes/calm/media/", import.meta.url));
  const files = readdirSync(dir);
  const total = files.reduce((n, f) => n + statSync(dir + f).size, 0);
  assert.ok(total < 2 * 1024 * 1024, `media is ${total} bytes`);
  const used = readFileSync(new URL("../src/features/themes/calm/media.ts", import.meta.url), "utf8");
  for (const f of files) assert.ok(used.includes(f), `${f} is used`);
});

console.log(`calm-theme: ${passed} passed`);
