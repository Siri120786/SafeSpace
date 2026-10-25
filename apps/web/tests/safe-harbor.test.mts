/**
 * Safe Harbor (PTSD): the rainy-window page, its toolkit, My calm plan and
 * the adult learning topics. Run with: tsx apps/web/tests/safe-harbor.test.mts
 * (part of `pnpm test`).
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { SafeHarbor } from "../src/features/wellness-modules/components/ModuleScreens.tsx";
import { addItem, EMPTY_PLAN, MAX_ITEMS, planIsEmpty, removeItem, sanitizePlan } from "../src/features/conditions/ptsd/harbor/calmPlan.ts";
import { allHarborTexts, TOOLS, TOPICS } from "../src/features/conditions/ptsd/harbor/content.ts";
import { isBodyNeutral } from "../src/features/wellness-modules/lib/cycleCare.ts";

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
const adult = { lowSensory: false, onExit: () => {} };
const child = { ...adult, paths: { base: "/child/modules" } };
const esc = (t: string) => t.replace(/'/g, "&#x27;");

test("calm plan: add trims, refuses empty, duplicate, long and full lists; remove; clean saved data", () => {
  const r = addItem(EMPTY_PLAN, "helps", "  A warm drink ");
  assert.ok(r.ok);
  const plan = r.ok ? r.plan : EMPTY_PLAN;
  assert.deepEqual(plan.helps, ["A warm drink"]);
  assert.equal(addItem(plan, "helps", "a warm drink").ok, false);
  assert.equal(addItem(plan, "helps", "   ").ok, false);
  assert.equal(addItem(plan, "helps", "x".repeat(121)).ok, false);
  const full = { ...EMPTY_PLAN, signs: Array.from({ length: MAX_ITEMS }, (_, i) => `s${i}`) };
  assert.equal(addItem(full, "signs", "one more").ok, false);
  assert.deepEqual(removeItem(plan, "helps", 0).helps, []);
  assert.deepEqual(sanitizePlan({ signs: ["ok", 5, "ok"], other: ["x"] }), { ...EMPTY_PLAN, signs: ["ok"] });
  assert.ok(planIsEmpty(sanitizePlan(null)));
});

test("wording: calm, non-blaming and body-neutral", () => {
  const SHAMING = /lazy|weak(?!ness)|failed|failure|your fault|should have|overreact|get over it/i;
  for (const t of allHarborTexts()) {
    assert.ok(isBodyNeutral(t), `not body-neutral: ${t}`);
    assert.doesNotMatch(t, SHAMING, t);
  }
});

test("adults: still by default, with the toolkit, the calm plan and the four topics", () => {
  const html = render(React.createElement(SafeHarbor, adult));
  assert.match(html, /data-still="true"/);
  assert.doesNotMatch(html, /<video|<audio|autoplay/i);
  for (const t of TOOLS) assert.ok(html.includes(esc(t.name)), t.name);
  assert.match(html, /My calm plan/);
  assert.match(html, /only you can see it/);
  for (const t of TOPICS) assert.ok(html.includes(esc(t.title)), t.title);
  assert.match(html, /aria-expanded="false"/);
});

test("children: the toolkit, the calm plan, only the gentler topics, and the sharing rule explained", () => {
  const html = render(React.createElement(SafeHarbor, child));
  for (const t of TOOLS) assert.ok(html.includes(esc(t.name)), t.name);
  assert.match(html, /My calm plan/);
  assert.match(html, /Your grown-ups can see it, unless you&#x27;re 15 or older/);
  for (const t of TOPICS) {
    const shown = t.id === "memories" || t.id === "sleep";
    assert.equal(html.includes(esc(t.title)), shown, t.title);
  }
  assert.match(html, /sleep-child\.webp/);
  assert.match(html, /plan-child\.webp/);
  assert.match(html, /href="\/child\/modules\/calm-space\/grounding"/);
});

test("low-sensory: no rain option at all", () => {
  assert.doesNotMatch(render(React.createElement(SafeHarbor, { ...adult, lowSensory: true })), /Let the rain fall/);
});

console.log(`\n${passed} Safe Harbor tests passed.`);
