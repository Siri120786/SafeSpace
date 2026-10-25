/**
 * Dino World: Arlo's valley home with the dino friends and egg tiles, the
 * fern-forest tools page with one baby per tool, still-by-default pages,
 * colours that blend from part to part, and the media budget.
 * Run with: tsx apps/web/tests/dino-theme.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { CONDITION_TOOLS } from "../src/features/conditions/conditionTools.ts";
import { DINO_PLAYBACK_RATE, DinoFrame, DinoHome, DinoToolsHome } from "../src/features/themes/dinosaurs/DinoKit.tsx";
import { DINO_CARD_CLIPS, DINO_FRIENDS } from "../src/features/themes/dinosaurs/media.ts";
import { TOOL_THEME_LABELS } from "../src/features/themes/toolThemes.ts";

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
const css = readFileSync(new URL("../src/features/themes/dinosaurs/dino.css", import.meta.url), "utf8");

test("home: Arlo's greeting, the day, the dino friends, every page as an egg; still by default", () => {
  const html = render(
    React.createElement(DinoHome, {
      eyebrow: "My space",
      greeting: "Hi Leo!",
      line: "Here's your day.",
      status: "2 steps left today. You've got this!",
      tiles: [
        { to: "/child/music", label: "Music", emoji: "🎵" },
        { to: "/child/stories", label: "Stories", emoji: "📖" },
      ],
      tilesLabel: "My tools",
      children: React.createElement("p", null, "today"),
    }),
  );
  assert.match(html, /Hi Leo!<span>Arlo is happy you&#x27;re here\.<\/span>/);
  assert.match(html, /2 steps left today/);
  assert.match(html, /class="dn-panel dn-stack"><p>today<\/p>/);
  for (const f of DINO_FRIENDS) assert.ok(html.includes(`<span>${f.name}</span>`), f.name);
  assert.match(html, /<nav aria-label="My tools" class="dn-eggs"><a class="dn-egg dn-egg--0" href="\/child\/music">/);
  assert.match(html, /class="dn-egg dn-egg--1" href="\/child\/stories"/);
  assert.doesNotMatch(html, /<video|<audio|autoplay/i);
  assert.equal(TOOL_THEME_LABELS.dinosaurs, "Dino World");
});

test("tools page: the footprint path and one baby dinosaur per tool, still with no video", () => {
  const items = CONDITION_TOOLS.map((tool, i) => ({ tool, mine: i < 2 }));
  const html = render(
    React.createElement(DinoToolsHome, { items, pathFor: (k: string) => `/tools/${k}`, eyebrow: "My tools", backTo: "/dashboard", backLabel: "Dashboard" }),
  );
  for (const t of CONDITION_TOOLS) {
    assert.match(html, new RegExp(`href="/tools/${t.key}"`));
    assert.ok(DINO_CARD_CLIPS[t.key].still && DINO_CARD_CLIPS[t.key].loop);
  }
  assert.match(html, /Follow the footprints<span>to your dino tools\.<\/span>/);
  assert.match(html, /class="dn-trail"/);
  assert.doesNotMatch(html, /<video|<audio|autoplay/i);
});

test("no names, characters or credits of other platforms on screen", () => {
  const html =
    render(React.createElement(DinoHome, { eyebrow: "x", greeting: "Hi", line: "x", tiles: [], tilesLabel: "x", children: "x" })) +
    render(React.createElement(DinoToolsHome, { items: [], pathFor: () => "/", eyebrow: "x", backTo: "/", backLabel: "x" })) +
    render(React.createElement(DinoFrame, { eyebrow: "x", title: "Routines", children: "x" }));
  assert.doesNotMatch(html, /manus|milo|my activities|roar|volcano|cloudfront/i);
});

test("colours blend: grass into golden evening into the sunset; forest floor into fern and the same evening", () => {
  assert.match(css, /\.dn-hero--valley \.dn-hero-shade \{\s*background: linear-gradient\(180deg, rgba\(93, 112, 57, 0\) 66%, var\(--dn-grass\) 96%, var\(--dn-grass\) 100%\)/);
  assert.match(css, /\.dn-day \{[^}]*linear-gradient\(180deg, var\(--dn-grass\) 0, var\(--dn-grass\) 40px,[^)]*var\(--dn-gold\) 100%\)/);
  assert.match(css, /\.dn-hero--forest \.dn-hero-shade \{\s*background: linear-gradient\(180deg, rgba\(69, 87, 45, 0\) 64%, var\(--dn-floor\) 96%, var\(--dn-floor\) 100%\)/);
  assert.match(css, /\.dn-cards \{[^}]*linear-gradient\(180deg, var\(--dn-floor\) 0, var\(--dn-floor\) 40px,[^;]*var\(--dn-gold\) 100%\)/);
  assert.match(css, /\.dn-closing \{[^}]*linear-gradient\(180deg, var\(--dn-gold\) 0,[^;]*var\(--dn-dusk\) var\(--dn-eve\)/);
  assert.match(css, /\.dn-closing \.dn-closing-media \{[^}]*mask-image: linear-gradient\(180deg, transparent 0%, #000 22%\)/);
  for (const part of ["dn-day", "dn-cards", "dn-closing"]) assert.match(css, new RegExp(`\.${part} \{[^}]*margin-top: -1px`), part);
  // The sampled colours: the valley's grass, the forest floor, the sunset sky.
  assert.match(css, /--dn-grass: #5d7039;/);
  assert.match(css, /--dn-floor: #45572d;/);
  assert.match(css, /--dn-dusk: #bbabbc;/);
});

test("motion is gentle: clips at under normal speed, friends bob only while playing", () => {
  assert.ok(DINO_PLAYBACK_RATE > 0 && DINO_PLAYBACK_RATE < 1);
  assert.match(css, /\.dn\[data-playing="true"\] \.dn-friends li \{\s*animation: dn-bob/);
});

test("the media stays small and every file is used", () => {
  const dir = fileURLToPath(new URL("../src/features/themes/dinosaurs/media/", import.meta.url));
  const files = readdirSync(dir);
  const total = files.reduce((n, f) => n + statSync(dir + f).size, 0);
  assert.ok(total < 4 * 1024 * 1024, `media is ${total} bytes`);
  const used = readFileSync(new URL("../src/features/themes/dinosaurs/media.ts", import.meta.url), "utf8");
  for (const f of files) assert.ok(used.includes(`"${f.replace(/\.(webp|mp4)$/, "")}`), `${f} is used`);
});

console.log(`dino-theme: ${passed} passed`);
