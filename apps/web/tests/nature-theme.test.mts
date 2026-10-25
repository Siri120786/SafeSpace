/**
 * The Nature theme: the cherry-blossom valley home with kind steps, the
 * hidden-garden tools page, still-by-default pages, colours that blend from
 * part to part, and the media budget.
 * Run with: tsx apps/web/tests/nature-theme.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { CONDITION_TOOLS } from "../src/features/conditions/conditionTools.ts";
import { NATURE_PLAYBACK_RATE, NATURE_STEPS, NatureFrame, NatureHome, NatureToolsHome } from "../src/features/themes/nature/NatureKit.tsx";
import { NATURE_CARD_CLIPS } from "../src/features/themes/nature/media.ts";

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
const css = readFileSync(new URL("../src/features/themes/nature/nature.css", import.meta.url), "utf8");
const home = () =>
  render(
    React.createElement(NatureHome, {
      eyebrow: "My space",
      greeting: "Hi Leo!",
      line: "Here's your day.",
      status: "2 steps left today. You've got this!",
      tiles: [{ to: "/child/music", label: "Music", emoji: "🎵" }],
      tilesLabel: "My tools",
      children: React.createElement("p", null, "today"),
    }),
  );

test("home: greeting over the valley, the day on a panel, tickets, three kind steps; still by default", () => {
  const html = home();
  assert.match(html, /Hi Leo!<br\/>Here&#x27;s your <em>gentle day\.<\/em>/);
  assert.match(html, /2 steps left today/);
  assert.match(html, /class="nt-panel-box nt-stack"><p>today<\/p>/);
  assert.match(html, /<nav aria-label="My tools" class="nt-tickets"><a class="nt-ticket" href="\/child\/music">/);
  for (const s of NATURE_STEPS) assert.ok(html.includes(s.title.replace("'", "&#x27;")), s.title);
  assert.equal((html.match(/class="nt-panel is-active"/g) ?? []).length, 1, "one step open at a time");
  assert.doesNotMatch(html, /<video|<audio|autoplay/i);
  assert.doesNotMatch(html, /nt-petal"|nt-drift-/, "no petals or drifting clouds until Play");
});

test("tools page: the hidden garden and a card per tool, still with no video", () => {
  const items = CONDITION_TOOLS.map((tool, i) => ({ tool, mine: i < 2 }));
  const html = render(
    React.createElement(NatureToolsHome, { items, pathFor: (k: string) => `/tools/${k}`, eyebrow: "My tools", backTo: "/dashboard", backLabel: "Dashboard" }),
  );
  for (const t of CONDITION_TOOLS) {
    assert.match(html, new RegExp(`href="/tools/${t.key}"`));
    assert.ok(NATURE_CARD_CLIPS[t.key].still && NATURE_CARD_CLIPS[t.key].loop);
  }
  assert.match(html, /Your hidden<br\/>garden/);
  assert.doesNotMatch(html, /<video|<audio|autoplay/i);
});

test("no names, logos or credits of other platforms on screen", () => {
  const html =
    home() +
    render(React.createElement(NatureToolsHome, { items: [], pathFor: () => "/", eyebrow: "x", backTo: "/", backLabel: "x" })) +
    render(React.createElement(NatureFrame, { eyebrow: "x", title: "Routines", children: "x" }));
  assert.doesNotMatch(html, /petalyx|organic visions|ai staff|start for \$0|slack|zapier|dropbox|hubspot|notion|cloudfront|begin the experience/i);
});

test("colours blend: no part meets another with a line", () => {
  // The valley fades in from the white sky and back into white below.
  assert.match(css, /\.nt-hero-media \{[^}]*mask-image: linear-gradient\(to bottom, transparent 0, #000 24%, #000 76%, transparent 100%\)/);
  // The tree's flat base fades out.
  assert.match(css, /\.nt-tree \{[^}]*mask-image: linear-gradient\(#000 70%, transparent 100%\)/);
  // Home's white parts are all white.
  for (const part of ["nt-hero", "nt-day", "nt-steps", "nt-closing--light"]) assert.match(css, new RegExp(`\.${part} \{[^}]*background: #fff`), part);
  // The night valley fades in from above; on the dark page a veil hides its bright sky.
  assert.match(css, /\.nt-closing-img \{[^}]*mask-image: linear-gradient\(to bottom, transparent 0, #000 26%\)/);
  assert.match(css, /\.nt-closing--dark \.nt-closing-img::after \{[^}]*linear-gradient\(180deg, #000 0%/);
  // Tools: the dome ends on black, the cards start and end on black.
  assert.match(css, /\.nt-realm::after \{[^}]*linear-gradient\(180deg, rgba\(0, 0, 0, 0\) 78%, #000 98%, #000 100%\)/);
  assert.match(css, /\.nt-cards \{[^}]*margin-top: -1px;[^}]*linear-gradient\(180deg, #000 0, #000 40px, var\(--nt-forest\) 50%, #000 100%\)/);
});

test("motion is gentle: clips at under normal speed", () => {
  assert.ok(NATURE_PLAYBACK_RATE > 0 && NATURE_PLAYBACK_RATE < 1);
});

test("the media stays small and every file is used", () => {
  const dir = fileURLToPath(new URL("../src/features/themes/nature/media/", import.meta.url));
  const files = readdirSync(dir);
  const total = files.reduce((n, f) => n + statSync(dir + f).size, 0);
  assert.ok(total < 4 * 1024 * 1024, `media is ${total} bytes`);
  for (const f of files) assert.ok(statSync(dir + f).size < 1024 * 1024, f);
  const used = readFileSync(new URL("../src/features/themes/nature/media.ts", import.meta.url), "utf8");
  for (const f of files) assert.ok(used.includes(`"${f.replace(/\.(webp|mp4)$/, "")}`), `${f} is used`);
});

console.log(`nature-theme: ${passed} passed`);
