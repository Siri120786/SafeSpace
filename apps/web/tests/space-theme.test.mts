/**
 * The Space theme for the ADHD and autism tools: which theme shows, the slow
 * motion rules, the still-by-default pages and the media budget. Run with:
 * tsx apps/web/tests/space-theme.test.mts (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { CONDITION_TOOLS } from "../src/features/conditions/conditionTools.ts";
import { activeToolTheme, isToolTheme, themesOffered, TOOL_THEMES } from "../src/features/themes/toolThemes.ts";
import { DRIFT_PERIOD_MS, driftTarget, easeToward, headTarget, SPACE_PLAYBACK_RATE } from "../src/features/themes/space/spaceMotion.ts";
import { SpaceHome, SpaceToolFrame, SpaceToolsHome } from "../src/features/themes/space/SpaceTools.tsx";
import { ToolThemePicker } from "../src/features/themes/ToolThemePicker.tsx";
import { SPACE_CARD_CLIPS } from "../src/features/themes/space/media.ts";

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
const items = CONDITION_TOOLS.map((tool, i) => ({ tool, mine: i < 2 }));
const home = (picker?: React.ReactNode) =>
  render(
    React.createElement(SpaceToolsHome, {
      items,
      pathFor: (k: string) => `/tools/${k}`,
      eyebrow: "Focus and feelings tools",
      backTo: "/dashboard",
      backLabel: "Dashboard",
      picker,
    }),
  );

test("the seven themes; Calm is the default, low-sensory mode keeps the plain look", () => {
  assert.deepEqual([...TOOL_THEMES].sort(), ["animals", "calm", "dinosaurs", "nature", "ocean", "space", "trains"]);
  assert.equal(activeToolTheme("space", false), "space");
  assert.equal(activeToolTheme("space", true), "plain");
  assert.equal(activeToolTheme(null, false), "calm", "Calm is the default");
  // Themes still being designed show Calm, never a half-built one.
  assert.equal(activeToolTheme("animals", false), "animals");
  assert.equal(activeToolTheme("trains", false), "calm");
  assert.ok(isToolTheme("ocean") && !isToolTheme("pirates") && !isToolTheme(3));
});

test("themes are only for people with the ADHD or autism module", () => {
  assert.ok(themesOffered(["adhd"]) && themesOffered(["autism"]) && themesOffered(["anxiety", "autism"]));
  assert.ok(!themesOffered([]) && !themesOffered(["anxiety", "depression", "ptsd", "pcos_pcod"]));
  assert.equal(activeToolTheme("space", false, false), "plain");
  assert.equal(activeToolTheme(null, true, true), "plain");
  assert.equal(activeToolTheme("space", false, true), "space");
});

test("home and dashboard in Space: Nova greets by name, the day on a light panel, glass tiles, still by default", () => {
  const html = render(
    React.createElement(SpaceHome, {
      eyebrow: "My space",
      greeting: "Hi Sam!",
      line: "Here's your day.",
      tiles: [{ to: "/child/music", label: "Music", emoji: "🎵" }],
      tilesLabel: "My tools",
      children: React.createElement("p", null, "today"),
    }),
  );
  assert.match(html, /<span>Hi Sam!<\/span> <span>I&#x27;m Nova<\/span>/);
  assert.match(html, /Put Nova&#x27;s helmet on/);
  assert.match(html, /class="sp-panel sp-stack"><p>today<\/p>/);
  // Every page as a planet matching the theme.
  assert.match(html, /<nav aria-label="My tools" class="sp-tiles"><a class="sp-tile sp-tile--0" href="\/child\/music"><span class="sp-planet">/);
  assert.match(html, /aria-pressed="false"[^>]*>.*Play space/);
  assert.doesNotMatch(html, /<video|<audio|autoplay/i);
});

test("motion is slow: clips at under normal speed, the gaze eases and drifts gently", () => {
  assert.ok(SPACE_PLAYBACK_RATE > 0 && SPACE_PLAYBACK_RATE < 1);
  assert.equal(headTarget(0), 0);
  assert.equal(headTarget(0.5), 0.5);
  assert.equal(headTarget(1), 1);
  assert.equal(headTarget(0.14), 0);
  const step = easeToward(0, 1);
  assert.ok(step > 0 && step <= 0.1, "one frame moves the head only a little");
  assert.equal(easeToward(0.9999, 1), 1);
  // The same pace on a slow screen: one 100 ms frame = six 60 fps frames.
  let fast = 0;
  for (let i = 0; i < 6; i++) fast = easeToward(fast, 1, 1000 / 60);
  assert.ok(Math.abs(easeToward(0, 1, 100) - fast) < 1e-9);
  for (let t = 0; t < DRIFT_PERIOD_MS; t += 500) {
    const d = driftTarget(t);
    assert.ok(d >= 0.25 && d <= 0.75);
  }
  assert.ok(DRIFT_PERIOD_MS >= 10000, "a slow drift");
});

test("the tools page opens still: pictures, no video, no sound, nothing autoplays", () => {
  const html = home();
  assert.doesNotMatch(html, /<video|<audio|autoplay/i);
  assert.match(html, /aria-pressed="false"[^>]*>.*Play space/);
  for (const t of CONDITION_TOOLS) assert.match(html, new RegExp(`href="/tools/${t.key}"`));
  assert.match(html, /Pick a tool/);
  assert.doesNotMatch(html, /Nova/, "Nova greets on the home page");
  assert.match(html, /Your tool/);
  assert.match(html, /More tools/);
});

test("no names or credits of other platforms on screen", () => {
  const html = home() + render(React.createElement(SpaceToolFrame, {
    eyebrow: "Tools", title: "Focus Zone", backTo: "/tools", backLabel: "All tools", children: "x",
  }));
  assert.doesNotMatch(html, /lumora|orbis|nft|rarity|cloudfront|studio\.design|@/i);
});

test("one tool's page keeps the tool on a light panel, still by default", () => {
  const html = render(React.createElement(SpaceToolFrame, {
    eyebrow: "My tools", title: "Schedule", backTo: "/child/tools", backLabel: "My tools",
    children: React.createElement("p", null, "the tool"),
  }));
  assert.match(html, /class="sp-panel sp-stack"><p>the tool<\/p>/);
  assert.doesNotMatch(html, /<video|autoplay/i);
  assert.match(html, /href="\/child\/tools"/);
});

test("the theme picker: six themes ready, Trains marked Soon and not pickable", () => {
  const html = render(React.createElement(ToolThemePicker, { look: "plain", value: "space", onChange: () => {} }));
  assert.equal((html.match(/disabled=""/g) ?? []).length, 1);
  assert.equal((html.match(/Soon/g) ?? []).length, 1);
  assert.match(html, /aria-pressed="true"[^>]*>.*Space/);
  const low = render(React.createElement(ToolThemePicker, { look: "plain", value: "space", onChange: () => {}, lowSensory: true }));
  assert.match(low, /Low-sensory mode is on/);
});

test("every tool has a card picture; the media stays small and has no unused clips", () => {
  for (const t of CONDITION_TOOLS) assert.ok(SPACE_CARD_CLIPS[t.key], t.key);
  const dir = fileURLToPath(new URL("../src/features/themes/space/media/", import.meta.url));
  const files = readdirSync(dir);
  const total = files.reduce((n, f) => n + statSync(dir + f).size, 0);
  assert.ok(total < 6 * 1024 * 1024, `media is ${total} bytes`);
  for (const f of files) assert.ok(statSync(dir + f).size < 2.5 * 1024 * 1024, f);
  const used = readFileSync(new URL("../src/features/themes/space/media.ts", import.meta.url), "utf8");
  for (const f of files) assert.ok(used.includes(f.replace(/\.(webp|mp4)$/, "")), `${f} is used`);
});

console.log(`space-theme: ${passed} passed`);
