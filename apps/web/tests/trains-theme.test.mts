/**
 * The Trains theme: Peter and his engine friends at the island station, a
 * departure board, carriage tiles, a stop per tool, the quiet carriage at the
 * end, still-by-default pages, colours that blend, and the media budget.
 * Run with: tsx apps/web/tests/trains-theme.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { CONDITION_TOOLS } from "../src/features/conditions/conditionTools.ts";
import { TRAIN_PLAYBACK_RATE, TrainFrame, TrainHome, TrainToolsHome } from "../src/features/themes/trains/TrainKit.tsx";
import { TRAIN_CARD_CLIPS, TRAIN_FRIEND_NAMES } from "../src/features/themes/trains/media.ts";

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
const css = readFileSync(new URL("../src/features/themes/trains/trains.css", import.meta.url), "utf8");

test("home: the greeting, a departure board, the day, every page as a coupled carriage; still", () => {
  const html = render(
    React.createElement(TrainHome, {
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
  assert.match(html, /Hi Leo!<span>All aboard with Peter and friends!<\/span>/);
  assert.match(html, /class="tr-board"[^]*Next stop[^]*2 steps left today/);
  assert.match(html, /class="tr-panel tr-stack"><p>today<\/p>/);
  assert.match(html, /<nav aria-label="My tools" class="tr-train"><a class="tr-coach tr-coach--0" href="\/child\/music"><span class="tr-coach-body">/);
  assert.match(html, /class="tr-coach tr-coach--1" href="\/child\/stories"/);
  assert.doesNotMatch(html, /<video|<audio|autoplay/i);
});

test("tools page: each tool a station with its engine friend, still with no video", () => {
  const items = CONDITION_TOOLS.map((tool, i) => ({ tool, mine: i < 2 }));
  const html = render(
    React.createElement(TrainToolsHome, { items, pathFor: (k: string) => `/tools/${k}`, eyebrow: "My tools", backTo: "/dashboard", backLabel: "Dashboard" }),
  );
  for (const t of CONDITION_TOOLS) {
    assert.match(html, new RegExp(`href="/tools/${t.key}"`));
    assert.ok(TRAIN_CARD_CLIPS[t.key].still && TRAIN_CARD_CLIPS[t.key].loop);
    assert.ok(html.includes(`with ${TRAIN_FRIEND_NAMES[t.key]}`));
  }
  assert.match(html, /Choose your<span>next stop\.<\/span>/);
  assert.doesNotMatch(html, /<video|<audio|autoplay/i);
});

test("no names, characters or credits of other platforms on screen", () => {
  const html =
    render(React.createElement(TrainHome, { eyebrow: "x", greeting: "Hi", line: "x", tiles: [], tilesLabel: "x", children: "x" })) +
    render(React.createElement(TrainToolsHome, { items: [], pathFor: () => "/", eyebrow: "x", backTo: "/", backLabel: "x" })) +
    render(React.createElement(TrainFrame, { eyebrow: "x", title: "Routines", children: "x" }));
  assert.doesNotMatch(html, /thomas|percy|james|sodor|bluebell|safespace express|manus|cloudfront/i);
});

test("colours blend: grass into evening into the quiet carriage, on both pages", () => {
  assert.match(css, /\.tr-hero--station \.tr-hero-shade \{\s*background: linear-gradient\(180deg, rgba\(140, 164, 98, 0\) 68%, var\(--tr-grass\) 96%, var\(--tr-grass\) 100%\)/);
  assert.match(css, /\.tr-day \{[^}]*linear-gradient\(180deg, var\(--tr-grass\) 0, var\(--tr-grass\) 40px,[^;]*var\(--tr-night\) 100%\)/);
  assert.match(css, /\.tr-hero--platform \.tr-hero-shade \{\s*background: linear-gradient\(180deg, rgba\(158, 163, 94, 0\) 68%, var\(--tr-meadow\) 96%, var\(--tr-meadow\) 100%\)/);
  assert.match(css, /\.tr-cards \{[^}]*linear-gradient\(180deg, var\(--tr-meadow\) 0, var\(--tr-meadow\) 40px,[^;]*var\(--tr-night\) 100%\)/);
  assert.match(css, /\.tr-closing \{[^}]*background: var\(--tr-night\)/);
  assert.match(css, /\.tr-closing \.tr-closing-media \{[^}]*mask-image: linear-gradient\(180deg, transparent 0%, #000 16%\)/);
  for (const part of ["tr-day", "tr-cards", "tr-closing"]) assert.match(css, new RegExp(`\.${part} \{[^}]*margin-top: -1px`), part);
  assert.match(css, /--tr-grass: #8ca462;/);
  assert.match(css, /--tr-meadow: #9ea35e;/);
  assert.match(css, /--tr-night: #000;/);
});

test("motion is gentle: clips at under normal speed", () => {
  assert.ok(TRAIN_PLAYBACK_RATE > 0 && TRAIN_PLAYBACK_RATE < 1);
});

test("the media stays small and every file is used", () => {
  const dir = fileURLToPath(new URL("../src/features/themes/trains/media/", import.meta.url));
  const files = readdirSync(dir);
  const total = files.reduce((n, f) => n + statSync(dir + f).size, 0);
  assert.ok(total < 4 * 1024 * 1024, `media is ${total} bytes`);
  const used = readFileSync(new URL("../src/features/themes/trains/media.ts", import.meta.url), "utf8");
  for (const f of files) assert.ok(used.includes(`"${f.replace(/\.(webp|mp4)$/, "")}`), `${f} is used`);
});

console.log(`trains-theme: ${passed} passed`);
